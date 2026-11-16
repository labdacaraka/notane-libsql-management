use crate::core::models::{Instance, InstanceRuntimeState};
use crate::state::AppState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct InstanceWithState {
    #[serde(flatten)]
    pub instance: Instance,
    pub runtime: InstanceRuntimeState,
}

#[derive(Debug, Deserialize)]
pub struct CreateInstanceInput {
    pub name: String,
    pub http_listen_addr: Option<String>,
    pub http_port: u16,
    pub admin_listen_addr: Option<String>,
    pub admin_port: u16,
    pub data_dir: Option<String>,
    pub admin_auth_key: Option<String>,
    pub auto_start: bool,
    pub auto_restart: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInstanceInput {
    pub id: String,
    pub name: String,
    pub http_listen_addr: String,
    pub http_port: u16,
    pub admin_listen_addr: String,
    pub admin_port: u16,
    pub data_dir: String,
    pub admin_auth_key: Option<String>,
    pub auto_start: bool,
    pub auto_restart: bool,
}

#[tauri::command]
pub async fn list_instances(state: State<'_, AppState>) -> Result<Vec<InstanceWithState>, String> {
    let instances = state.storage.list_instances().map_err(|e| e.to_string())?;
    let mut result = Vec::with_capacity(instances.len());

    for inst in instances {
        let mut runtime = state.process_manager.get_runtime_state(&inst).await;
        if let Ok(dbs) = state.storage.list_databases(&inst.id) {
            runtime.database_count = dbs.len();
        }
        result.push(InstanceWithState {
            instance: inst,
            runtime,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_instance(
    state: State<'_, AppState>,
    input: CreateInstanceInput,
) -> Result<Instance, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("Instance name cannot be empty".into());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let data_dir = match input.data_dir {
        Some(d) if !d.trim().is_empty() => d.trim().to_string(),
        _ => {
            let base = dirs::data_local_dir()
                .or_else(dirs::data_dir)
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("notane-libsql")
                .join("instances")
                .join(name);
            base.to_string_lossy().to_string()
        }
    };

    let auth_key = match input.admin_auth_key {
        Some(k) if !k.trim().is_empty() => Some(k.trim().to_string()),
        _ => Some(Uuid::new_v4().to_string().replace('-', "")),
    };

    let instance = Instance {
        id: id.clone(),
        name: name.to_string(),
        http_listen_addr: input.http_listen_addr.unwrap_or_else(|| "0.0.0.0".into()),
        http_port: input.http_port,
        admin_listen_addr: input.admin_listen_addr.unwrap_or_else(|| "0.0.0.0".into()),
        admin_port: input.admin_port,
        data_dir,
        admin_auth_key: auth_key,
        auto_start: input.auto_start,
        auto_restart: input.auto_restart,
        created_at: now.clone(),
        updated_at: now,
    };

    state
        .storage
        .create_instance(&instance)
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&id),
        "instance_created",
        &format!("Created instance '{}' on port {}", instance.name, instance.http_port),
    );

    if instance.auto_start {
        if let Err(e) = state.process_manager.start(&instance).await {
            tracing::warn!("Auto-start for instance '{}' failed: {e}", instance.name);
        }
    }

    Ok(instance)
}

#[tauri::command]
pub async fn update_instance(
    state: State<'_, AppState>,
    input: UpdateInstanceInput,
) -> Result<(), String> {
    let existing = state
        .storage
        .get_instance(&input.id)
        .map_err(|e| e.to_string())?;

    let updated = Instance {
        id: existing.id.clone(),
        name: input.name.trim().to_string(),
        http_listen_addr: input.http_listen_addr.trim().to_string(),
        http_port: input.http_port,
        admin_listen_addr: input.admin_listen_addr.trim().to_string(),
        admin_port: input.admin_port,
        data_dir: input.data_dir.trim().to_string(),
        admin_auth_key: input.admin_auth_key.filter(|k| !k.trim().is_empty()),
        auto_start: input.auto_start,
        auto_restart: input.auto_restart,
        created_at: existing.created_at,
        updated_at: Utc::now().to_rfc3339(),
    };

    state
        .storage
        .update_instance(&updated)
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&existing.id),
        "instance_updated",
        &format!("Updated configuration for instance '{}'", updated.name),
    );

    Ok(())
}

#[tauri::command]
pub async fn delete_instance(
    state: State<'_, AppState>,
    id: String,
    delete_data: bool,
) -> Result<(), String> {
    let instance = state
        .storage
        .get_instance(&id)
        .map_err(|e| e.to_string())?;

    // Stop if running
    let _ = state.process_manager.stop(&instance).await;

    if delete_data {
        let path = std::path::Path::new(&instance.data_dir);
        if path.exists() {
            let _ = std::fs::remove_dir_all(path);
        }
    }

    state
        .storage
        .delete_instance(&id)
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        None,
        "instance_deleted",
        &format!("Deleted instance '{}' (delete_data={delete_data})", instance.name),
    );

    Ok(())
}

#[tauri::command]
pub async fn start_instance(
    state: State<'_, AppState>,
    id: String,
) -> Result<InstanceRuntimeState, String> {
    let instance = state
        .storage
        .get_instance(&id)
        .map_err(|e| e.to_string())?;

    let res = state
        .process_manager
        .start(&instance)
        .await
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&id),
        "instance_started",
        &format!("Started instance '{}'", instance.name),
    );

    Ok(res)
}

#[tauri::command]
pub async fn stop_instance(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let instance = state
        .storage
        .get_instance(&id)
        .map_err(|e| e.to_string())?;

    state
        .process_manager
        .stop(&instance)
        .await
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&id),
        "instance_stopped",
        &format!("Stopped instance '{}'", instance.name),
    );

    Ok(())
}

#[tauri::command]
pub async fn restart_instance(
    state: State<'_, AppState>,
    id: String,
) -> Result<InstanceRuntimeState, String> {
    let instance = state
        .storage
        .get_instance(&id)
        .map_err(|e| e.to_string())?;

    let res = state
        .process_manager
        .restart(&instance)
        .await
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&id),
        "instance_restarted",
        &format!("Restarted instance '{}'", instance.name),
    );

    Ok(res)
}

#[tauri::command]
pub async fn get_instance_logs(
    state: State<'_, AppState>,
    id: String,
    limit: Option<usize>,
) -> Result<Vec<String>, String> {
    Ok(state.process_manager.get_log_buffer().get_logs(&id, limit))
}

#[tauri::command]
pub async fn clear_instance_logs(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.process_manager.get_log_buffer().clear(&id);
    Ok(())
}
