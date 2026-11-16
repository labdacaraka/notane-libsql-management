use crate::core::models::{Instance, InstanceRuntimeState, ProcessStatus};
use crate::process::bundled_binary::ensure_sqld_binary;
use crate::process::health::{check_tcp_responding, is_port_free};
use crate::process::log_capture::LogBuffer;
use crate::process::proxy::start_proxy;
use crate::storage::database::Storage;
use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex};
use tracing::{info, warn};

fn find_free_internal_port(preferred: u16) -> u16 {
    if is_port_free(preferred) {
        return preferred;
    }
    std::net::TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(preferred)
}

fn pid_file_path(data_dir: &str) -> PathBuf {
    PathBuf::from(data_dir).join("sqld.pid")
}

fn write_pid_file(data_dir: &str, pid: u32) {
    let _ = std::fs::write(pid_file_path(data_dir), pid.to_string());
}

fn read_pid_file(data_dir: &str) -> Option<u32> {
    std::fs::read_to_string(pid_file_path(data_dir))
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
}

fn remove_pid_file(data_dir: &str) {
    let _ = std::fs::remove_file(pid_file_path(data_dir));
}

fn is_pid_alive(pid: u32) -> bool {
    #[cfg(unix)]
    unsafe {
        libc::kill(pid as i32, 0) == 0
    }
    #[cfg(not(unix))]
    false
}

async fn kill_process_pid(pid: u32) {
    #[cfg(unix)]
    unsafe {
        libc::kill(pid as i32, libc::SIGTERM);
    }

    // Wait up to 3 seconds for graceful exit
    for _ in 0..30 {
        if !is_pid_alive(pid) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    // Force kill if process refused SIGTERM
    #[cfg(unix)]
    unsafe {
        libc::kill(pid as i32, libc::SIGKILL);
    }
    tokio::time::sleep(Duration::from_millis(100)).await;
}

struct RunningInstance {
    data_dir: PathBuf,
    started_at: Instant,
    pid: Option<u32>,
    last_error: Option<String>,
    proxy_shutdown_tx: Option<oneshot::Sender<()>>,
}

#[derive(Clone)]
pub struct ProcessManager {
    instances: Arc<Mutex<HashMap<String, RunningInstance>>>,
    log_buffer: LogBuffer,
    storage: Storage,
}

impl ProcessManager {
    pub fn new(log_buffer: LogBuffer, storage: Storage) -> Self {
        Self {
            instances: Arc::new(Mutex::new(HashMap::new())),
            log_buffer,
            storage,
        }
    }

    pub fn get_log_buffer(&self) -> &LogBuffer {
        &self.log_buffer
    }

    pub async fn start(&self, instance: &Instance) -> Result<InstanceRuntimeState> {
        // 1. Check if already running in memory and still alive
        {
            let map = self.instances.lock().await;
            if let Some(existing) = map.get(&instance.id) {
                if let Some(pid) = existing.pid {
                    if is_pid_alive(pid) {
                        return Ok(InstanceRuntimeState {
                            instance_id: instance.id.clone(),
                            status: ProcessStatus::Running,
                            pid: Some(pid),
                            uptime_seconds: existing.started_at.elapsed().as_secs(),
                            database_count: 0,
                            last_error: None,
                        });
                    }
                }
            }
        }

        // 2. Clean up any orphaned process from a previous crash/reload
        if let Some(old_pid) = read_pid_file(&instance.data_dir) {
            if is_pid_alive(old_pid) {
                info!(
                    "Found previous running sqld PID {} for instance '{}'; stopping it first",
                    old_pid, instance.name
                );
                kill_process_pid(old_pid).await;
            }
            remove_pid_file(&instance.data_dir);
        }

        // 3. Wait for ports to become free if recently released
        for _ in 0..20 {
            if is_port_free(instance.http_port) && is_port_free(instance.admin_port) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        // 4. Validate ports
        if !is_port_free(instance.http_port) {
            return Err(anyhow!(
                "HTTP port {} is already in use by another application",
                instance.http_port
            ));
        }
        if !is_port_free(instance.admin_port) {
            return Err(anyhow!(
                "Admin port {} is already in use by another application",
                instance.admin_port
            ));
        }

        let binary_path = ensure_sqld_binary()?;
        std::fs::create_dir_all(&instance.data_dir)?;

        let internal_port = find_free_internal_port(instance.http_port.saturating_add(10000));

        let mut cmd = Command::new(&binary_path);
        cmd.arg("--http-listen-addr")
            .arg(format!("127.0.0.1:{}", internal_port))
            .arg("--admin-listen-addr")
            .arg(format!("{}:{}", instance.admin_listen_addr, instance.admin_port))
            .arg("--db-path")
            .arg(&instance.data_dir)
            .arg("--enable-namespaces")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(auth_key) = &instance.admin_auth_key {
            if !auth_key.trim().is_empty() {
                cmd.arg("--admin-auth-key").arg(auth_key);
            }
        }

        info!("Spawning sqld for instance '{}' (internal port: {})", instance.name, internal_port);
        let mut child = cmd
            .spawn()
            .map_err(|e| anyhow!("Failed to spawn sqld binary at {:?}: {e}", binary_path))?;

        let pid = child.id();
        if let Some(p) = pid {
            write_pid_file(&instance.data_dir, p);
        }

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let instance_id_clone = instance.id.clone();
        let log_buf_out = self.log_buffer.clone();
        if let Some(out) = stdout {
            tokio::spawn(async move {
                let mut reader = BufReader::new(out).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    log_buf_out.append(&instance_id_clone, line);
                }
            });
        }

        let instance_id_clone2 = instance.id.clone();
        let log_buf_err = self.log_buffer.clone();
        if let Some(err) = stderr {
            tokio::spawn(async move {
                let mut reader = BufReader::new(err).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    log_buf_err.append(&instance_id_clone2, format!("[ERR] {}", line));
                }
            });
        }

        // Start smart reverse proxy on instance.http_listen_addr:instance.http_port
        let proxy_res = start_proxy(
            &instance.http_listen_addr,
            instance.http_port,
            internal_port,
            self.storage.clone(),
            instance.id.clone(),
        )
        .await;

        let proxy_shutdown_tx = match proxy_res {
            Ok(tx) => Some(tx),
            Err(e) => {
                warn!(
                    "Failed to start reverse proxy on {}:{}: {e}",
                    instance.http_listen_addr, instance.http_port
                );
                None
            }
        };

        let running_instance = RunningInstance {
            data_dir: PathBuf::from(&instance.data_dir),
            started_at: Instant::now(),
            pid,
            last_error: None,
            proxy_shutdown_tx,
        };

        {
            let mut map = self.instances.lock().await;
            map.insert(instance.id.clone(), running_instance);
        }

        // Background monitor for child exit
        let inst_id = instance.id.clone();
        let data_dir_copy = instance.data_dir.clone();
        let instances_map = self.instances.clone();

        tokio::spawn(async move {
            let status = child.wait().await;
            warn!("sqld instance '{}' process exited: {:?}", inst_id, status);
            remove_pid_file(&data_dir_copy);

            let mut map = instances_map.lock().await;
            if let Some(inst) = map.get_mut(&inst_id) {
                inst.pid = None;
                inst.last_error = Some(format!("Process exited: {:?}", status));
            }
        });

        // Verify socket is responding
        let mut healthy = false;
        for _ in 0..15 {
            tokio::time::sleep(Duration::from_millis(150)).await;
            if check_tcp_responding("127.0.0.1", instance.admin_port, 200).await {
                healthy = true;
                break;
            }
        }

        if !healthy {
            warn!(
                "Instance '{}' started PID {:?}, but Admin API port {} is not responding yet.",
                instance.name, pid, instance.admin_port
            );
        }

        Ok(InstanceRuntimeState {
            instance_id: instance.id.clone(),
            status: ProcessStatus::Running,
            pid,
            uptime_seconds: 0,
            database_count: 0,
            last_error: None,
        })
    }

    pub async fn stop(&self, instance: &Instance) -> Result<()> {
        let mut map = self.instances.lock().await;
        let running_opt = map.remove(&instance.id);
        drop(map);

        if let Some(mut running) = running_opt {
            if let Some(tx) = running.proxy_shutdown_tx.take() {
                let _ = tx.send(());
            }
            if let Some(pid) = running.pid {
                kill_process_pid(pid).await;
            }
        }

        if let Some(pid) = read_pid_file(&instance.data_dir) {
            if is_pid_alive(pid) {
                kill_process_pid(pid).await;
            }
            remove_pid_file(&instance.data_dir);
        }

        // Wait briefly for proxy port release
        for _ in 0..10 {
            if is_port_free(instance.http_port) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }

        Ok(())
    }

    pub async fn restart(&self, instance: &Instance) -> Result<InstanceRuntimeState> {
        self.stop(instance).await?;
        tokio::time::sleep(Duration::from_millis(300)).await;
        self.start(instance).await
    }

    pub async fn get_status(&self, instance: &Instance) -> ProcessStatus {
        self.get_runtime_state(instance).await.status
    }

    pub async fn get_runtime_state(&self, instance: &Instance) -> InstanceRuntimeState {
        let mut map = self.instances.lock().await;
        if let Some(inst) = map.get(&instance.id) {
            let status = if let Some(pid) = inst.pid {
                if is_pid_alive(pid) {
                    ProcessStatus::Running
                } else {
                    ProcessStatus::Crashed
                }
            } else if inst.last_error.is_some() {
                ProcessStatus::Crashed
            } else {
                ProcessStatus::Stopped
            };

            return InstanceRuntimeState {
                instance_id: instance.id.clone(),
                status,
                pid: inst.pid,
                uptime_seconds: if inst.pid.is_some() {
                    inst.started_at.elapsed().as_secs()
                } else {
                    0
                },
                database_count: 0,
                last_error: inst.last_error.clone(),
            };
        }

        // If not in map, check if process was left running from a previous reload/session
        if let Some(pid) = read_pid_file(&instance.data_dir) {
            if is_pid_alive(pid) {
                let running = RunningInstance {
                    data_dir: PathBuf::from(&instance.data_dir),
                    started_at: Instant::now(),
                    pid: Some(pid),
                    last_error: None,
                    proxy_shutdown_tx: None,
                };
                map.insert(instance.id.clone(), running);

                return InstanceRuntimeState {
                    instance_id: instance.id.clone(),
                    status: ProcessStatus::Running,
                    pid: Some(pid),
                    uptime_seconds: 0,
                    database_count: 0,
                    last_error: None,
                };
            } else {
                remove_pid_file(&instance.data_dir);
            }
        }

        InstanceRuntimeState {
            instance_id: instance.id.clone(),
            status: ProcessStatus::Stopped,
            pid: None,
            uptime_seconds: 0,
            database_count: 0,
            last_error: None,
        }
    }

    pub async fn stop_all(&self) {
        let mut map = self.instances.lock().await;
        let instances: Vec<(String, Option<u32>, PathBuf)> = map
            .drain()
            .map(|(k, v)| (k, v.pid, v.data_dir))
            .collect();
        drop(map);

        for (_id, pid, data_dir) in instances {
            if let Some(p) = pid {
                kill_process_pid(p).await;
            }
            if let Some(path_str) = data_dir.to_str() {
                remove_pid_file(path_str);
            }
        }
    }
}
