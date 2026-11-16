import { createSignal, Show } from 'solid-js';
import type { InstanceWithState } from '../lib/types';
import { CopyButton } from './CopyButton';
import {
  Play,
  Square,
  RotateCw,
  Database,
  Terminal,
  Settings2,
  Trash2,
  Network,
  Loader2,
} from 'lucide-solid';

interface InstanceCardProps {
  instance: InstanceWithState;
  lanIp?: string | null;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onOpenDatabases: (inst: InstanceWithState) => void;
  onOpenLogs: (inst: InstanceWithState) => void;
  onEdit: (inst: InstanceWithState) => void;
  onDelete: (inst: InstanceWithState) => void | Promise<void>;
  actionLoading?: 'start' | 'stop' | 'restart' | 'delete' | null;
}

export function InstanceCard(props: InstanceCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleteDataDir, setDeleteDataDir] = createSignal(false);

  const status = () => props.instance.runtime.status;
  const isRunning = () => status() === 'running';

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  return (
    <div class="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
      <div>
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-slate-100 text-base">{props.instance.name}</h3>
              <span
                class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${
                  props.actionLoading
                    ? 'bg-blue-950/70 text-blue-300 border-blue-700/80 animate-pulse'
                    : isRunning()
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                    : status() === 'crashed'
                    ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Show when={props.actionLoading}>
                  <Loader2 class="w-3 h-3 animate-spin text-blue-300" />
                </Show>
                <span>
                  {props.actionLoading === 'start'
                    ? 'Starting...'
                    : props.actionLoading === 'stop'
                    ? 'Stopping...'
                    : props.actionLoading === 'restart'
                    ? 'Restarting...'
                    : props.actionLoading === 'delete'
                    ? 'Deleting...'
                    : isRunning()
                    ? 'Running'
                    : status() === 'crashed'
                    ? 'Crashed'
                    : 'Stopped'}
                </span>
              </span>
            </div>
            <p class="text-xs text-slate-400 font-mono mt-1 break-all">
              {props.instance.data_dir}
            </p>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              disabled={Boolean(props.actionLoading)}
              onClick={() => props.onEdit(props.instance)}
              aria-label="Edit instance configuration"
              class="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Edit Configuration"
            >
              <Settings2 class="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={Boolean(props.actionLoading)}
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete instance"
              class="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Delete Instance"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono">
          <div class="bg-slate-950/50 p-2 rounded border border-slate-800/60">
            <span class="text-slate-500 block text-[10px] uppercase tracking-wider">HTTP Port</span>
            <span class="text-slate-200 font-medium">{props.instance.http_port}</span>
          </div>

          <div class="bg-slate-950/50 p-2 rounded border border-slate-800/60">
            <span class="text-slate-500 block text-[10px] uppercase tracking-wider">Admin Port</span>
            <span class="text-slate-200 font-medium">{props.instance.admin_port}</span>
          </div>

          <div class="bg-slate-950/50 p-2 rounded border border-slate-800/60">
            <span class="text-slate-500 block text-[10px] uppercase tracking-wider">Databases</span>
            <span class="text-slate-200 font-medium">{props.instance.runtime.database_count}</span>
          </div>
        </div>

        <Show when={props.lanIp && props.instance.http_listen_addr === '0.0.0.0'}>
          <div class="mt-2.5 px-2.5 py-1.5 bg-blue-950/30 border border-blue-900/50 rounded flex items-center justify-between text-xs font-mono">
            <span class="text-blue-300 text-[11px] flex items-center gap-1.5">
              <Network class="w-3.5 h-3.5 text-blue-400" />
              <span>LAN: <strong class="text-blue-200">{props.lanIp}:{props.instance.http_port}</strong></span>
            </span>
            <CopyButton
              text={`${props.lanIp}:${props.instance.http_port}`}
              label="Copy"
              className="!py-0.5 !px-1.5 !text-[10px]"
            />
          </div>
        </Show>

        <Show when={isRunning()}>
          <div class="flex items-center justify-between mt-3 text-xs text-slate-400 font-mono px-1">
            <span>PID: {props.instance.runtime.pid || '-'}</span>
            <span>Uptime: {formatUptime(props.instance.runtime.uptime_seconds)}</span>
          </div>
        </Show>

        <Show when={props.instance.runtime.last_error}>
          <div class="mt-3 p-2 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-xs font-mono">
            {props.instance.runtime.last_error}
          </div>
        </Show>
      </div>

      <div class="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <Show
            when={isRunning()}
            fallback={
              <button
                type="button"
                onClick={() => props.onStart(props.instance.id)}
                disabled={Boolean(props.actionLoading)}
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/80 disabled:opacity-75 disabled:cursor-not-allowed text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                <Show
                  when={props.actionLoading === 'start'}
                  fallback={<Play class="w-3.5 h-3.5 fill-current" />}
                >
                  <Loader2 class="w-3.5 h-3.5 animate-spin" />
                </Show>
                <span>{props.actionLoading === 'start' ? 'Starting...' : 'Start'}</span>
              </button>
            }
          >
            <button
              type="button"
              onClick={() => props.onStop(props.instance.id)}
              disabled={Boolean(props.actionLoading)}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-900/80 hover:text-rose-200 disabled:opacity-60 disabled:cursor-not-allowed text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors"
            >
              <Show
                when={props.actionLoading === 'stop'}
                fallback={<Square class="w-3.5 h-3.5 fill-current" />}
              >
                <Loader2 class="w-3.5 h-3.5 animate-spin text-rose-400" />
              </Show>
              <span>{props.actionLoading === 'stop' ? 'Stopping...' : 'Stop'}</span>
            </button>

            <button
              type="button"
              onClick={() => props.onRestart(props.instance.id)}
              disabled={Boolean(props.actionLoading)}
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors"
              title="Restart server process"
            >
              <Show
                when={props.actionLoading === 'restart'}
                fallback={<RotateCw class="w-3.5 h-3.5" />}
              >
                <Loader2 class="w-3.5 h-3.5 animate-spin text-blue-400" />
              </Show>
              <Show when={props.actionLoading === 'restart'}>
                <span class="text-xs text-blue-300">Restarting...</span>
              </Show>
            </button>
          </Show>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            disabled={Boolean(props.actionLoading)}
            onClick={() => props.onOpenDatabases(props.instance)}
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors"
          >
            <Database class="w-3.5 h-3.5 text-blue-400" />
            <span>Databases</span>
          </button>

          <button
            type="button"
            disabled={Boolean(props.actionLoading)}
            onClick={() => props.onOpenLogs(props.instance)}
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors"
          >
            <Terminal class="w-3.5 h-3.5 text-slate-400" />
            <span>Logs</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Show when={showDeleteConfirm()}>
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-5 shadow-xl">
            <h4 class="text-slate-100 font-semibold text-base">
              Delete Instance "{props.instance.name}"?
            </h4>
            <p class="text-slate-300 text-xs mt-2">
              This will remove the instance from your management list. If running, the process will be stopped first.
            </p>

            <div class="mt-4 p-3 bg-slate-950 rounded border border-slate-800">
              <label class="flex items-center gap-2.5 text-xs text-rose-300 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={props.actionLoading === 'delete'}
                  checked={deleteDataDir()}
                  onChange={(e) => setDeleteDataDir(e.currentTarget.checked)}
                  class="rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-rose-500"
                />
                <span>Also delete data directory on disk ({props.instance.data_dir})</span>
              </label>
            </div>

            <div class="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={props.actionLoading === 'delete'}
                onClick={() => setShowDeleteConfirm(false)}
                class="px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={props.actionLoading === 'delete'}
                onClick={async () => {
                  try {
                    await props.onDelete(props.instance);
                    setShowDeleteConfirm(false);
                  } catch {
                    setShowDeleteConfirm(false);
                  }
                }}
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                <Show when={props.actionLoading === 'delete'}>
                  <Loader2 class="w-3.5 h-3.5 animate-spin" />
                </Show>
                <span>{props.actionLoading === 'delete' ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
