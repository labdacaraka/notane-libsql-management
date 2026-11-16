import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type {
  CreateInstancePayload,
  DatabaseNamespace,
  Instance,
  InstanceWithState,
  UpdateInstancePayload,
} from './lib/types';
import { api } from './lib/tauri';
import { Navbar } from './components/Navbar';
import { InstanceCard } from './components/InstanceCard';
import { InstanceModal } from './components/InstanceModal';
import { DatabasesView } from './components/DatabasesView';
import { DatabaseModal } from './components/DatabaseModal';
import { TokenModal } from './components/TokenModal';
import { ForkModal } from './components/ForkModal';
import { LogViewerModal } from './components/LogViewerModal';
import { ActivityLogView } from './components/ActivityLogView';
import { SettingsView } from './components/SettingsView';
import { Plus, Server } from 'lucide-solid';
import './App.css';

export function App() {
  const [currentTab, setCurrentTab] = createSignal<'instances' | 'activity' | 'settings'>('instances');
  const [instances, setInstances] = createSignal<InstanceWithState[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [lanIp, setLanIp] = createSignal<string | null>(null);

  // Modals & Sub-views
  const [isInstanceModalOpen, setIsInstanceModalOpen] = createSignal(false);
  const [editingInstance, setEditingInstance] = createSignal<Instance | null>(null);

  const [selectedInstance, setSelectedInstance] = createSignal<InstanceWithState | null>(null);
  const [databases, setDatabases] = createSignal<DatabaseNamespace[]>([]);
  const [loadingDatabases, setLoadingDatabases] = createSignal(false);

  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = createSignal(false);
  const [tokenModalDb, setTokenModalDb] = createSignal<DatabaseNamespace | null>(null);
  const [forkModalDb, setForkModalDb] = createSignal<DatabaseNamespace | null>(null);
  const [logsModalInstance, setLogsModalInstance] = createSignal<InstanceWithState | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = createSignal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Instance action loading tracker
  const [actionLoading, setActionLoading] = createSignal<{
    id: string;
    action: 'start' | 'stop' | 'restart' | 'delete';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadInstances = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await api.listInstances();
      setInstances(data);

      // Keep selected instance synchronized if open
      const curr = selectedInstance();
      if (curr) {
        const found = data.find((i) => i.id === curr.id);
        if (found) setSelectedInstance(found);
      }
    } catch (e) {
      console.error('Failed to load instances:', e);
      if (!silent) showToast(`Error loading instances: ${e}`, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDatabasesForSelected = async () => {
    const inst = selectedInstance();
    if (!inst) return;
    setLoadingDatabases(true);
    try {
      const list = await api.listDatabases(inst.id);
      setDatabases(list);
    } catch (e) {
      console.error('Failed to load databases:', e);
      showToast(`Error loading databases: ${e}`, 'error');
    } finally {
      setLoadingDatabases(false);
    }
  };

  createEffect(() => {
    loadInstances();
    const updateNetwork = () => {
      api.getNetworkInfo().then((info) => {
        setLanIp(info.primary_lan_ip);
      }).catch(console.error);
    };
    updateNetwork();

    // Regular live poll for statuses and network IP changes
    const interval = setInterval(() => {
      loadInstances(true);
      updateNetwork();
    }, 3000);
    onCleanup(() => clearInterval(interval));
  });

  // Instance Actions
  const handleStartInstance = async (id: string) => {
    setActionLoading({ id, action: 'start' });
    try {
      await api.startInstance(id);
      showToast('Instance started successfully');
      await loadInstances(true);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopInstance = async (id: string) => {
    setActionLoading({ id, action: 'stop' });
    try {
      await api.stopInstance(id);
      showToast('Instance stopped');
      await loadInstances(true);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartInstance = async (id: string) => {
    setActionLoading({ id, action: 'restart' });
    try {
      await api.restartInstance(id);
      showToast('Instance restarted');
      await loadInstances(true);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteInstance = async (inst: InstanceWithState) => {
    setActionLoading({ id: inst.id, action: 'delete' });
    try {
      await api.deleteInstance(inst.id, true);
      showToast(`Instance '${inst.name}' deleted`);
      if (selectedInstance()?.id === inst.id) {
        setSelectedInstance(null);
      }
      await loadInstances(true);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateInstance = async (payload: CreateInstancePayload) => {
    await api.createInstance(payload);
    showToast(`Instance '${payload.name}' created`);
    await loadInstances(true);
  };

  const handleUpdateInstance = async (payload: UpdateInstancePayload) => {
    await api.updateInstance(payload);
    showToast(`Instance '${payload.name}' updated`);
    await loadInstances(true);
  };

  // Database Actions
  const handleOpenDatabases = async (inst: InstanceWithState) => {
    setSelectedInstance(inst);
    await loadDatabasesForSelected();
  };

  const handleCreateDatabase = async (name: string, generateKey: boolean) => {
    const inst = selectedInstance();
    if (!inst) return;
    await api.createDatabase(inst.id, name, generateKey);
    showToast(`Database '${name}' created`);
    await loadDatabasesForSelected();
    await loadInstances(true);
  };

  const handleDeleteDatabase = async (db: DatabaseNamespace) => {
    try {
      await api.deleteDatabase(db.id);
      showToast(`Database '${db.name}' deleted`);
      await loadDatabasesForSelected();
      await loadInstances(true);
    } catch (e) {
      showToast(String(e), 'error');
    }
  };

  const handleForkDatabase = async (databaseId: string, targetName: string) => {
    await api.forkDatabase(databaseId, targetName);
    showToast(`Forked database to '${targetName}'`);
    await loadDatabasesForSelected();
    await loadInstances(true);
  };

  const handleCheckpointDatabase = async (db: DatabaseNamespace) => {
    try {
      await api.checkpointDatabase(db.id);
      showToast(`WAL checkpoint executed for '${db.name}'`);
    } catch (e) {
      showToast(String(e), 'error');
    }
  };

  return (
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Navbar
        currentTab={currentTab()}
        onSelectTab={(tab) => {
          setSelectedInstance(null);
          setCurrentTab(tab);
        }}
        onNewInstance={() => {
          setEditingInstance(null);
          setIsInstanceModalOpen(true);
        }}
        onRefresh={() => {
          if (selectedInstance()) {
            loadDatabasesForSelected();
          }
          loadInstances();
        }}
        isRefreshing={refreshing()}
      />

      {/* Toast Notification Banner */}
      <Show when={toastMessage()}>
        <div
          class={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg border shadow-lg text-xs font-medium flex items-center gap-2 ${
            toastMessage()!.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-800'
              : 'bg-emerald-950 text-emerald-200 border-emerald-800'
          }`}
        >
          <span>{toastMessage()!.text}</span>
        </div>
      </Show>

      {/* Main Content View */}
      <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Show when={currentTab() === 'activity'}>
          <ActivityLogView />
        </Show>

        <Show when={currentTab() === 'settings'}>
          <SettingsView />
        </Show>

        <Show when={currentTab() === 'instances'}>
          <Show
            when={!selectedInstance()}
            fallback={
              <DatabasesView
                instance={selectedInstance()!}
                databases={databases()}
                lanIp={lanIp()}
                onBack={() => setSelectedInstance(null)}
                onRefresh={loadDatabasesForSelected}
                onOpenCreateModal={() => setIsCreateDbModalOpen(true)}
                onOpenTokenModal={(db) => setTokenModalDb(db)}
                onOpenForkModal={(db) => setForkModalDb(db)}
                onDeleteDatabase={handleDeleteDatabase}
                onCheckpoint={handleCheckpointDatabase}
                loading={loadingDatabases()}
              />
            }
          >
            <div>
              <div class="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div>
                  <h1 class="text-lg font-bold text-slate-100 tracking-tight">
                    Database Instances ({instances().length})
                  </h1>
                  <p class="text-xs text-slate-400 mt-0.5">
                    Self-hosted libSQL servers listening locally and on LAN
                  </p>
                </div>
              </div>

              <Show
                when={!loading() && instances().length === 0}
              >
                <div class="p-16 text-center bg-slate-900/40 rounded-lg border border-slate-800/80 max-w-lg mx-auto">
                  <div class="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                    <Server class="w-6 h-6" />
                  </div>
                  <h3 class="text-sm font-semibold text-slate-200">No database instances configured</h3>
                  <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Create your first local libSQL instance to automatically spawn the bundled sqld server and manage namespaces.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingInstance(null);
                      setIsInstanceModalOpen(true);
                    }}
                    class="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Plus class="w-4 h-4" />
                    <span>Create Your First Instance</span>
                  </button>
                </div>
              </Show>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <For each={instances()}>
                  {(inst) => (
                    <InstanceCard
                      instance={inst}
                      lanIp={lanIp()}
                      onStart={handleStartInstance}
                      onStop={handleStopInstance}
                      onRestart={handleRestartInstance}
                      onOpenDatabases={handleOpenDatabases}
                      onOpenLogs={(i) => setLogsModalInstance(i)}
                      onEdit={(i) => {
                        setEditingInstance(i);
                        setIsInstanceModalOpen(true);
                      }}
                      onDelete={handleDeleteInstance}
                      actionLoading={actionLoading()?.id === inst.id ? actionLoading()?.action : null}
                    />
                  )}
                </For>
              </div>
            </div>
          </Show>
        </Show>
      </main>

      {/* Modals */}
      <InstanceModal
        isOpen={isInstanceModalOpen()}
        onClose={() => setIsInstanceModalOpen(false)}
        onSubmitCreate={handleCreateInstance}
        onSubmitUpdate={handleUpdateInstance}
        editInstance={editingInstance()}
      />

      <DatabaseModal
        isOpen={isCreateDbModalOpen()}
        instanceName={selectedInstance()?.name || ''}
        onClose={() => setIsCreateDbModalOpen(false)}
        onSubmit={handleCreateDatabase}
      />

      <TokenModal
        isOpen={tokenModalDb() !== null}
        database={tokenModalDb()}
        instanceHost={selectedInstance()?.http_listen_addr || '127.0.0.1'}
        instancePort={selectedInstance()?.http_port || 8080}
        lanIp={lanIp()}
        onClose={() => setTokenModalDb(null)}
      />

      <ForkModal
        isOpen={forkModalDb() !== null}
        database={forkModalDb()}
        onClose={() => setForkModalDb(null)}
        onSubmit={handleForkDatabase}
      />

      <LogViewerModal
        isOpen={logsModalInstance() !== null}
        instance={logsModalInstance()}
        onClose={() => setLogsModalInstance(null)}
      />
    </div>
  );
}

export default App;
