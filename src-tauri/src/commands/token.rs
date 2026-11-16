use crate::api::client::SqldAdminClient;
use crate::core::models::{ProcessStatus, TokenGenerationResult, TokenRecord};
use crate::crypto::jwt::create_jwt_token;
use crate::crypto::keygen::generate_ed25519_keypair;
use crate::state::AppState;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn generate_keypair_for_database(
    state: State<'_, AppState>,
    database_id: String,
) -> Result<String, String> {
    let db = state
        .storage
        .get_database(&database_id)
        .map_err(|e| e.to_string())?;

    let instance = state
        .storage
        .get_instance(&db.instance_id)
        .map_err(|e| e.to_string())?;

    let keypair = generate_ed25519_keypair().map_err(|e| e.to_string())?;

    let status = state.process_manager.get_status(&instance).await;
    if status == ProcessStatus::Running {
        let client = SqldAdminClient::new(instance.admin_port, instance.admin_auth_key);
        client
            .update_jwt_key(&db.name, &keypair.public_key_pem)
            .await
            .map_err(|e| e.to_string())?;
    }

    state
        .storage
        .update_database_keys(&database_id, &keypair.public_key_pem, &keypair.private_key_pem)
        .map_err(|e| e.to_string())?;

    let _ = state.storage.log_activity(
        Some(&instance.id),
        "keypair_regenerated",
        &format!("Regenerated JWT Ed25519 keypair for database '{}'", db.name),
    );

    Ok(keypair.public_key_pem)
}

#[tauri::command]
pub async fn generate_token(
    state: State<'_, AppState>,
    database_id: String,
    permission: String, // "rw" or "ro"
    duration_days: Option<u32>,
    label: Option<String>,
) -> Result<TokenGenerationResult, String> {
    let perm = permission.to_lowercase();
    if perm != "rw" && perm != "ro" {
        return Err("Permission must be either 'rw' (read-write) or 'ro' (read-only)".into());
    }

    let db = state
        .storage
        .get_database(&database_id)
        .map_err(|e| e.to_string())?;

    let instance = state
        .storage
        .get_instance(&db.instance_id)
        .map_err(|e| e.to_string())?;

    let privkey_opt = state
        .storage
        .get_database_private_key(&database_id)
        .map_err(|e| e.to_string())?;

    let privkey = match privkey_opt {
        Some(k) => k,
        None => {
            // Automatically generate keypair if none exists yet
            let kp = generate_ed25519_keypair().map_err(|e| e.to_string())?;
            let status = state.process_manager.get_status(&instance).await;
            if status == ProcessStatus::Running {
                let client = SqldAdminClient::new(instance.admin_port, instance.admin_auth_key.clone());
                let _ = client.update_jwt_key(&db.name, &kp.public_key_pem).await;
            }
            state
                .storage
                .update_database_keys(&database_id, &kp.public_key_pem, &kp.private_key_pem)
                .map_err(|e| e.to_string())?;
            kp.private_key_pem
        }
    };

    let token =
        create_jwt_token(&privkey, &perm, duration_days, Some(&db.name)).map_err(|e| e.to_string())?;

    let host = if instance.http_listen_addr == "0.0.0.0" {
        "127.0.0.1"
    } else {
        &instance.http_listen_addr
    };

    let connection_url_http = format!("http://{}:{}", host, instance.http_port);
    let connection_url_libsql =
        format!("libsql://{}:{}?authToken={}", host, instance.http_port, token);

    let lan_ip = crate::core::network::get_primary_lan_ip();
    let (lan_connection_url_http, lan_connection_url_libsql) = match lan_ip {
        Some(ip) if ip != host => (
            Some(format!("http://{}:{}", ip, instance.http_port)),
            Some(format!("libsql://{}:{}?authToken={}", ip, instance.http_port, token)),
        ),
        _ => (None, None),
    };

    let now = Utc::now();
    let expires_at = duration_days.map(|d| (now + chrono::Duration::days(d as i64)).to_rfc3339());

    let record = TokenRecord {
        id: Uuid::new_v4().to_string(),
        database_id: database_id.clone(),
        label: label.clone(),
        permission: perm.clone(),
        issued_at: now.to_rfc3339(),
        expires_at: expires_at.clone(),
        created_at: now.to_rfc3339(),
    };

    let _ = state.storage.record_token(&record);

    let _ = state.storage.log_activity(
        Some(&instance.id),
        "token_generated",
        &format!("Generated {perm} token for database '{}'", db.name),
    );

    Ok(TokenGenerationResult {
        token,
        connection_url_http,
        connection_url_libsql,
        lan_connection_url_http,
        lan_connection_url_libsql,
        permission: perm,
        expires_at,
    })
}

#[tauri::command]
pub async fn list_token_history(
    state: State<'_, AppState>,
    database_id: String,
) -> Result<Vec<TokenRecord>, String> {
    state
        .storage
        .list_token_history(&database_id)
        .map_err(|e| e.to_string())
}
