export type ProcessStatus = 'running' | 'stopped' | 'crashed';

export interface InstanceRuntimeState {
  instance_id: string;
  status: ProcessStatus;
  pid: number | null;
  uptime_seconds: number;
  database_count: number;
  last_error: string | null;
}

export interface Instance {
  id: string;
  name: string;
  http_listen_addr: string;
  http_port: number;
  admin_listen_addr: string;
  admin_port: number;
  data_dir: string;
  admin_auth_key: string | null;
  auto_start: boolean;
  auto_restart: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstanceWithState extends Instance {
  runtime: InstanceRuntimeState;
}

export interface DatabaseNamespace {
  id: string;
  instance_id: string;
  name: string;
  jwt_public_key: string | null;
  created_at: string;
}

export interface TokenRecord {
  id: string;
  database_id: string;
  label: string | null;
  permission: 'rw' | 'ro';
  issued_at: string;
  expires_at: string | null;
  created_at: string;
}

export interface TokenGenerationResult {
  token: string;
  connection_url_http: string;
  connection_url_libsql: string;
  lan_connection_url_http?: string | null;
  lan_connection_url_libsql?: string | null;
  permission: string;
  expires_at: string | null;
}

export interface NetworkInfo {
  primary_lan_ip: string | null;
  all_lan_ips: string[];
}

export interface SystemStatus {
  sqld_bundled: boolean;
  sqld_version: string;
  sqld_path: string;
  total_instances: number;
  running_instances: number;
  total_databases: number;
  lan_ip?: string | null;
}

export interface ActivityLog {
  id: string;
  instance_id: string | null;
  action: string;
  description: string;
  created_at: string;
}

export interface CreateInstancePayload {
  name: string;
  http_listen_addr?: string;
  http_port: number;
  admin_listen_addr?: string;
  admin_port: number;
  data_dir?: string;
  admin_auth_key?: string;
  auto_start: boolean;
  auto_restart: boolean;
}

export interface UpdateInstancePayload {
  id: string;
  name: string;
  http_listen_addr: string;
  http_port: number;
  admin_listen_addr: string;
  admin_port: number;
  data_dir: string;
  admin_auth_key?: string;
  auto_start: boolean;
  auto_restart: boolean;
}
