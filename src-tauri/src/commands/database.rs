use crate::api::client::SqldAdminClient;
use crate::core::models::{DatabaseNamespace, ProcessStatus};
use crate::crypto::keygen::generate_ed25519_keypair;
use crate::state::AppState;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_databases(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<Vec<DatabaseNamespace>, String> {
    state
        .storage
        .list_databases(&instance_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_database(
    state: State<'_, AppState>,
    instance_id: String,
    name: String,
    generate_key: bool,
) -> Result<DatabaseNamespace, String> {
    let clean_name = name.trim();
    if clean_name.is_empty() {
        return Err("Database name cannot be empty".into());
    }

    if !clean_name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Database name can only contain lowercase alphanumeric, underscores, and hyphens".into());
    }

    let instance = state
        .storage
        .get_instance(&instance_id)
        .map_err(|e| e.to_string())?;

    let status = state.process_manager.get_status(&instance).await;
    if status != ProcessStatus::Running {
        return Err(format!(
            "Instance '{}' is not running. Please start the instance first before creating a database.",
            instance.name
        ));
    }

    let client = SqldAdminClient::new(instance.admin_port, instance.admin_auth_key);

    let (pubkey, privkey) = if generate_key {
        let kp = generate_ed25519_keypair().map_err(|e| e.to_string())?;
        (Some(kp.public_key_pem), Some(kp.private_key_pem))
    } else {
        (None, None)
    };

    client
        .create_namespace(clean_name, pubkey.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let db = DatabaseNamespace {
        id: id.clone(),
        instance_id: instance_id.clone(),
        name: clean_name.to_string(),
        jwt_public_key: pubkey,
        created_at: Utc::now().to_rfc3339(),
    };

    state
        .storage
        .create_database(&db, privkey.as_deref())
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&instance_id),
        "database_created",
        &format!("Created database '{clean_name}' on instance '{}'", instance.name),
    );

    Ok(db)
}

#[tauri::command]
pub async fn delete_database(state: State<'_, AppState>, database_id: String) -> Result<(), String> {
    let db = state
        .storage
        .get_database(&database_id)
        .map_err(|e| e.to_string())?;

    let instance = state
        .storage
        .get_instance(&db.instance_id)
        .map_err(|e| e.to_string())?;

    let status = state.process_manager.get_status(&instance).await;
    if status == ProcessStatus::Running {
        let client = SqldAdminClient::new(instance.admin_port, instance.admin_auth_key);
        if let Err(e) = client.delete_namespace(&db.name).await {
            tracing::warn!("Failed to delete namespace on running sqld: {e}");
        }
    }

    state
        .storage
        .delete_database(&database_id)
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&instance.id),
        "database_deleted",
        &format!("Deleted database '{}' from instance '{}'", db.name, instance.name),
    );

    Ok(())
}

#[tauri::command]
pub async fn fork_database(
    state: State<'_, AppState>,
    database_id: String,
    target_name: String,
) -> Result<DatabaseNamespace, String> {
    let target_clean = target_name.trim();
    if target_clean.is_empty() {
        return Err("Target database name cannot be empty".into());
    }

    let source_db = state
        .storage
        .get_database(&database_id)
        .map_err(|e| e.to_string())?;

    let instance = state
        .storage
        .get_instance(&source_db.instance_id)
        .map_err(|e| e.to_string())?;

    let status = state.process_manager.get_status(&instance).await;
    if status != ProcessStatus::Running {
        return Err("Instance must be running to fork a database".into());
    }

    let client = SqldAdminClient::new(instance.admin_port, instance.admin_auth_key);
    client
        .fork_namespace(&source_db.name, target_clean)
        .await
        .map_err(|e| e.to_string())?;

    let source_privkey = state
        .storage
        .get_database_private_key(&database_id)
        .map_err(|e| e.to_string())?;

    let new_id = Uuid::new_v4().to_string();
    let new_db = DatabaseNamespace {
        id: new_id.clone(),
        instance_id: instance.id.clone(),
        name: target_clean.to_string(),
        jwt_public_key: source_db.jwt_public_key.clone(),
        created_at: Utc::now().to_rfc3339(),
    };

    state
        .storage
        .create_database(&new_db, source_privkey.as_deref())
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&instance.id),
        "database_forked",
        &format!("Forked database '{}' to '{target_clean}'", source_db.name),
    );

    Ok(new_db)
}

#[tauri::command]
pub async fn checkpoint_database(state: State<'_, AppState>, database_id: String) -> Result<(), String> {
    let db = state
        .storage
        .get_database(&database_id)
        .map_err(|e| e.to_string())?;

    let instance = state
        .storage
        .get_instance(&db.instance_id)
        .map_err(|e| e.to_string())?;

    let client = SqldAdminClient::new(instance.admin_port, instance.admin_auth_key);
    client
        .checkpoint_namespace(&db.name)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
