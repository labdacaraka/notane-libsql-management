import { createSignal, For, Show } from 'solid-js';
import type { DatabaseNamespace, InstanceWithState } from '../lib/types';
import { CopyButton } from './CopyButton';
import {
  ArrowLeft,
  Plus,
  Key,
  GitFork,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Network,
  Loader2,
  Check,
} from 'lucide-solid';

interface DatabasesViewProps {
  instance: InstanceWithState;
  databases: DatabaseNamespace[];
  lanIp?: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  onOpenTokenModal: (db: DatabaseNamespace) => void;
  onOpenForkModal: (db: DatabaseNamespace) => void;
  onDeleteDatabase: (db: DatabaseNamespace) => void | Promise<void>;
  onCheckpoint: (db: DatabaseNamespace) => void | Promise<void>;
  loading?: boolean;
}

export function DatabasesView(props: DatabasesViewProps) {
  const [deleteCandidate, setDeleteCandidate] = createSignal<DatabaseNamespace | null>(null);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [checkpointingId, setCheckpointingId] = createSignal<string | null>(null);
  const [checkpointSuccessId, setCheckpointSuccessId] = createSignal<string | null>(null);

  const handleCheckpoint = async (db: DatabaseNamespace) => {
    setCheckpointingId(db.id);
    try {
      await props.onCheckpoint(db);
      setCheckpointSuccessId(db.id);
      setTimeout(() => setCheckpointSuccessId(null), 2000);
    } finally {
      setCheckpointingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    const candidate = deleteCandidate();
    if (!candidate) return;
    setIsDeleting(true);
    try {
      await props.onDeleteDatabase(candidate);
      setDeleteCandidate(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={props.onBack}
            aria-label="Back to instances list"
            class="p-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft class="w-4 h-4" />
          </button>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-slate-100">{props.instance.name}</h2>
              <span
                class={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  props.instance.runtime.status === 'running'
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {props.instance.runtime.status === 'running' ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono mt-1">
              <span class="text-slate-400">
                Local: <span class="text-slate-200">127.0.0.1:{props.instance.http_port}</span>
              </span>
              <Show when={props.lanIp && props.instance.http_listen_addr === '0.0.0.0'}>
                <span class="text-slate-600 hidden sm:inline">•</span>
                <div class="flex items-center gap-1.5 text-blue-400">
                  <Network class="w-3.5 h-3.5 text-blue-400" />
                  <span>LAN IP: <strong class="text-blue-200">{props.lanIp}:{props.instance.http_port}</strong></span>
                  <CopyButton
                    text={`${props.lanIp}:${props.instance.http_port}`}
                    label="Copy"
                    className="!py-0.5 !px-1.5 !text-[10px]"
                  />
                </div>
              </Show>
              <span class="text-slate-600 hidden sm:inline">•</span>
              <span class="text-slate-400">Admin Port: {props.instance.admin_port}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={props.loading}
            aria-label="Refresh databases"
            class="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw class={`w-4 h-4 ${props.loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={props.onOpenCreateModal}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>Create Database</span>
          </button>
        </div>
      </div>

      <Show
        when={props.databases.length > 0}
        fallback={
          <div class="p-12 text-center bg-slate-900/50 rounded-lg border border-slate-800">
            <h3 class="text-sm font-semibold text-slate-300">No databases created yet</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create your first database (namespace) on this instance to start issuing access tokens.
            </p>
            <button
              type="button"
              onClick={props.onOpenCreateModal}
              class="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow-sm transition-colors"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Create Database</span>
            </button>
          </div>
        }
      >
        <div class="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-sm">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Database Name</th>
                <th class="py-3 px-4">Auth Status</th>
                <th class="py-3 px-4">Created Date</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80">
              <For each={props.databases}>
                {(db) => (
                  <tr class="hover:bg-slate-850/50 transition-colors">
                    <td class="py-3.5 px-4">
                      <div class="font-semibold text-slate-100 font-mono text-sm">{db.name}</div>
                      
                      <div class="flex flex-col gap-1 mt-1.5 text-[11px] font-mono">
                        {/* Localhost URL */}
                        <div class="flex items-center gap-2 text-slate-400">
                          <span class="text-slate-500 w-12 text-[10px] uppercase font-sans">Local</span>
                          <span class="text-slate-300 select-all truncate max-w-xs">
                            http://127.0.0.1:{props.instance.http_port}
                          </span>
                          <CopyButton
                            text={`http://127.0.0.1:${props.instance.http_port}`}
                            label="Copy"
                            className="!py-0.5 !px-1.5 !text-[10px]"
                          />
                        </div>

                        {/* LAN Network URL */}
                        <Show when={props.lanIp && props.instance.http_listen_addr === '0.0.0.0'}>
                          <div class="flex items-center gap-2 text-slate-400">
                            <span class="text-blue-400 w-12 text-[10px] uppercase font-sans font-medium">LAN IP</span>
                            <span class="text-blue-200 select-all truncate max-w-xs">
                              http://{props.lanIp}:{props.instance.http_port}
                            </span>
                            <CopyButton
                              text={`http://${props.lanIp}:${props.instance.http_port}`}
                              label="Copy LAN"
                              className="!py-0.5 !px-1.5 !text-[10px]"
                            />
                          </div>
                        </Show>
                      </div>
                    </td>

                    <td class="py-3 px-4">
                      {db.jwt_public_key ? (
                        <span class="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-900 px-2 py-0.5 rounded font-medium">
                          <CheckCircle2 class="w-3 h-3" />
                          <span>JWT Keypair Ready</span>
                        </span>
                      ) : (
                        <span class="text-slate-500 text-[11px]">Unauthenticated / No Key</span>
                      )}
                    </td>

                    <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(db.created_at).toLocaleDateString()}{' '}
                      {new Date(db.created_at).toLocaleTimeString()}
                    </td>

                    <td class="py-3 px-4 text-right">
                      <div class="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => props.onOpenTokenModal(db)}
                          class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded text-xs font-medium transition-colors"
                        >
                          <Key class="w-3 h-3" />
                          <span>Token</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCheckpoint(db)}
                          disabled={checkpointingId() === db.id}
                          class="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors border border-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Trigger WAL Checkpoint"
                        >
                          {checkpointingId() === db.id ? (
                            <>
                              <Loader2 class="w-3 h-3 animate-spin text-blue-400" />
                              <span>Checkpointing...</span>
                            </>
                          ) : checkpointSuccessId() === db.id ? (
                            <>
                              <Check class="w-3 h-3 text-emerald-400" />
                              <span class="text-emerald-400">Done</span>
                            </>
                          ) : (
                            <span>Checkpoint</span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => props.onOpenForkModal(db)}
                          class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                          title="Fork Database"
                          aria-label="Fork Database"
                        >
                          <GitFork class="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(db)}
                          class="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-colors border border-slate-700"
                          title="Delete Database"
                          aria-label="Delete Database"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      {/* Delete Database Confirmation */}
      <Show when={deleteCandidate()}>
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-5 shadow-2xl">
            <h4 class="text-slate-100 font-semibold text-base">
              Delete Database "{deleteCandidate()!.name}"?
            </h4>
            <p class="text-rose-300 text-xs mt-2 bg-rose-950/40 p-2.5 rounded border border-rose-900/60">
              Warning: This action is permanent. All tables and rows stored in this namespace will be purged.
            </p>
            <div class="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={isDeleting()}
                class="px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting()}
                class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Show when={isDeleting()}>
                  <Loader2 class="w-3.5 h-3.5 animate-spin" />
                </Show>
                <span>{isDeleting() ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
