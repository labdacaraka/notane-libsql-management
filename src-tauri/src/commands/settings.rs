use crate::core::models::{ActivityLog, NetworkInfo, ProcessStatus, SystemStatus};
use crate::core::network::{get_primary_lan_ip, list_all_lan_ips};
use crate::process::bundled_binary::{ensure_sqld_binary, get_sqld_version, EMBEDDED_SQLD_BYTES};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_network_info() -> Result<NetworkInfo, String> {
    Ok(NetworkInfo {
        primary_lan_ip: get_primary_lan_ip(),
        all_lan_ips: list_all_lan_ips(),
    })
}

#[tauri::command]
pub async fn get_system_status(state: State<'_, AppState>) -> Result<SystemStatus, String> {
    let instances = state.storage.list_instances().unwrap_or_default();
    let total_instances = instances.len();

    let mut running_count = 0;
    let mut total_databases = 0;

    for inst in &instances {
        if state.process_manager.get_status(inst).await == ProcessStatus::Running {
            running_count += 1;
        }
        if let Ok(dbs) = state.storage.list_databases(&inst.id) {
            total_databases += dbs.len();
        }
    }

    let (binary_path, version) = match ensure_sqld_binary() {
        Ok(path) => {
            let ver = get_sqld_version(&path).unwrap_or_else(|_| "v0.24.25".into());
            (path.to_string_lossy().to_string(), ver)
        }
        Err(e) => ("Not found".to_string(), format!("Error: {e}")),
    };

    Ok(SystemStatus {
        sqld_bundled: !EMBEDDED_SQLD_BYTES.is_empty(),
        sqld_version: version,
        sqld_path: binary_path,
        total_instances,
        running_instances: running_count,
        total_databases,
        lan_ip: get_primary_lan_ip(),
    })
}

#[tauri::command]
pub async fn list_activities(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<ActivityLog>, String> {
    state
        .storage
        .list_activities(limit.unwrap_or(30))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_config(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, String> {
    state.storage.get_config(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_config(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    state.storage.set_config(&key, &value).map_err(|e| e.to_string())
}
