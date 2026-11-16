use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
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
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Running,
    Stopped,
    Crashed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceRuntimeState {
    pub instance_id: String,
    pub status: ProcessStatus,
    pub pid: Option<u32>,
    pub uptime_seconds: u64,
    pub database_count: usize,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseNamespace {
    pub id: String,
    pub instance_id: String,
    pub name: String,
    pub jwt_public_key: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenRecord {
    pub id: String,
    pub database_id: String,
    pub label: Option<String>,
    pub permission: String, // "rw" or "ro"
    pub issued_at: String,
    pub expires_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenGenerationResult {
    pub token: String,
    pub connection_url_http: String,
    pub connection_url_libsql: String,
    pub lan_connection_url_http: Option<String>,
    pub lan_connection_url_libsql: Option<String>,
    pub permission: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub primary_lan_ip: Option<String>,
    pub all_lan_ips: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityLog {
    pub id: String,
    pub instance_id: Option<String>,
    pub action: String,
    pub description: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub sqld_bundled: bool,
    pub sqld_version: String,
    pub sqld_path: String,
    pub total_instances: usize,
    pub running_instances: usize,
    pub total_databases: usize,
    pub lan_ip: Option<String>,
}
