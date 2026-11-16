import { createSignal, createEffect, For, Show } from 'solid-js';
import type { ActivityLog } from '../lib/types';
import { api } from '../lib/tauri';
import { RefreshCw, Activity } from 'lucide-solid';

export function ActivityLogView() {
  const [activities, setActivities] = createSignal<ActivityLog[]>([]);
  const [loading, setLoading] = createSignal(false);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const list = await api.listActivities(50);
      setActivities(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    fetchActivities();
  });

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
            <Activity class="w-4 h-4 text-blue-400" />
            <span>Activity Log</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Audit history of server lifecycle, database provisioning, and token generation
          </p>
        </div>

        <button
          type="button"
          onClick={fetchActivities}
          disabled={loading()}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-xs rounded transition-colors"
        >
          <RefreshCw class={`w-3.5 h-3.5 ${loading() ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <Show
        when={activities().length > 0}
        fallback={
          <div class="p-12 text-center bg-slate-900/50 rounded-lg border border-slate-800 text-xs text-slate-500">
            No activity recorded yet.
          </div>
        }
      >
        <div class="bg-slate-900 rounded-lg border border-slate-800 divide-y divide-slate-800/80 overflow-hidden text-xs">
          <For each={activities()}>
            {(act) => (
              <div class="p-3.5 flex items-start justify-between gap-4 hover:bg-slate-850/40 transition-colors">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-950 text-slate-300 border border-slate-800">
                      {act.action}
                    </span>
                    <span class="text-slate-200 font-medium">{act.description}</span>
                  </div>
                </div>

                <div class="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                  {new Date(act.created_at).toLocaleDateString()}{' '}
                  {new Date(act.created_at).toLocaleTimeString()}
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
