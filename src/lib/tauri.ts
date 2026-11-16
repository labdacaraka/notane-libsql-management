import { invoke } from '@tauri-apps/api/core';
import type {
  ActivityLog,
  CreateInstancePayload,
  DatabaseNamespace,
  Instance,
  InstanceRuntimeState,
  InstanceWithState,
  NetworkInfo,
  SystemStatus,
  TokenGenerationResult,
  TokenRecord,
  UpdateInstancePayload,
} from './types';

export const api = {
  // Instances
  listInstances: () => invoke<InstanceWithState[]>('list_instances'),
  createInstance: (input: CreateInstancePayload) =>
    invoke<Instance>('create_instance', { input }),
  updateInstance: (input: UpdateInstancePayload) =>
    invoke<void>('update_instance', { input }),
  deleteInstance: (id: string, deleteData: boolean) =>
    invoke<void>('delete_instance', { id, deleteData }),
  startInstance: (id: string) =>
    invoke<InstanceRuntimeState>('start_instance', { id }),
  stopInstance: (id: string) => invoke<void>('stop_instance', { id }),
  restartInstance: (id: string) =>
    invoke<InstanceRuntimeState>('restart_instance', { id }),
  getInstanceLogs: (id: string, limit?: number) =>
    invoke<string[]>('get_instance_logs', { id, limit }),
  clearInstanceLogs: (id: string) =>
    invoke<void>('clear_instance_logs', { id }),

  // Databases
  listDatabases: (instanceId: string) =>
    invoke<DatabaseNamespace[]>('list_databases', { instanceId }),
  createDatabase: (instanceId: string, name: string, generateKey: boolean) =>
    invoke<DatabaseNamespace>('create_database', { instanceId, name, generateKey }),
  deleteDatabase: (databaseId: string) =>
    invoke<void>('delete_database', { databaseId }),
  forkDatabase: (databaseId: string, targetName: string) =>
    invoke<DatabaseNamespace>('fork_database', { databaseId, targetName }),
  checkpointDatabase: (databaseId: string) =>
    invoke<void>('checkpoint_database', { databaseId }),

  // Tokens
  generateKeypair: (databaseId: string) =>
    invoke<string>('generate_keypair_for_database', { databaseId }),
  generateToken: (
    databaseId: string,
    permission: 'rw' | 'ro',
    durationDays?: number,
    label?: string
  ) =>
    invoke<TokenGenerationResult>('generate_token', {
      databaseId,
      permission,
      durationDays,
      label,
    }),
  listTokenHistory: (databaseId: string) =>
    invoke<TokenRecord[]>('list_token_history', { databaseId }),

  // Settings & System
  getSystemStatus: () => invoke<SystemStatus>('get_system_status'),
  getNetworkInfo: () => invoke<NetworkInfo>('get_network_info'),
  listActivities: (limit?: number) =>
    invoke<ActivityLog[]>('list_activities', { limit }),
  getConfig: (key: string) => invoke<string | null>('get_config', { key }),
  setConfig: (key: string, value: string) =>
    invoke<void>('set_config', { key, value }),
};
