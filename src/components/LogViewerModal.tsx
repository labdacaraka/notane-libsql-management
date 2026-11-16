import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { InstanceWithState } from '../lib/types';
import { api } from '../lib/tauri';
import { CopyButton } from './CopyButton';
import { X, Search, Trash2 } from 'lucide-solid';

interface LogViewerModalProps {
  isOpen: boolean;
  instance: InstanceWithState | null;
  onClose: () => void;
}

export function LogViewerModal(props: LogViewerModalProps) {
  const [logs, setLogs] = createSignal<string[]>([]);
  const [filter, setFilter] = createSignal('');
  const [autoScroll, setAutoScroll] = createSignal(true);
  let scrollContainer: HTMLDivElement | undefined;

  const fetchLogs = async () => {
    if (!props.instance) return;
    try {
      const lines = await api.getInstanceLogs(props.instance.id, 500);
      setLogs(lines);
      if (autoScroll() && scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  };

  createEffect(() => {
    if (props.isOpen && props.instance) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 1500);
      onCleanup(() => clearInterval(interval));
    }
  });

  const filteredLogs = () => {
    const q = filter().toLowerCase().trim();
    if (!q) return logs();
    return logs().filter((line) => line.toLowerCase().includes(q));
  };

  const handleClear = async () => {
    if (!props.instance) return;
    await api.clearInstanceLogs(props.instance.id);
    setLogs([]);
  };

  return (
    <Show when={props.isOpen && props.instance ? props.instance : undefined}>
      {(inst) => (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full h-[80vh] flex flex-col p-5 shadow-2xl">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-semibold text-slate-100">
                    Server Output: {inst().name}
                  </h3>
                  <span
                    class={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      inst().runtime.status === 'running'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {inst().runtime.status.toUpperCase()}
              </span>
            </div>
            <p class="text-xs text-slate-400 font-mono mt-0.5">
              Listening: {inst().http_listen_addr}:{inst().http_port}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors"
            >
              <Trash2 class="w-3.5 h-3.5 text-slate-400" />
              <span>Clear</span>
            </button>

            <CopyButton text={logs().join('\n')} label="Copy All" />

            <button
              type="button"
              onClick={props.onClose}
              aria-label="Close log viewer"
              class="text-slate-400 hover:text-slate-200 transition-colors ml-2"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div class="py-2.5 flex items-center justify-between gap-3 text-xs">
          <div class="relative flex-1 max-w-xs">
            <Search class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filter()}
              onInput={(e) => setFilter(e.currentTarget.value)}
              placeholder="Filter logs..."
              class="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 font-mono"
            />
          </div>

          <div class="flex items-center gap-3 text-slate-400">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll()}
                onChange={(e) => setAutoScroll(e.currentTarget.checked)}
                class="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto-scroll</span>
            </label>
            <span class="font-mono text-[11px] text-slate-500">
              {filteredLogs().length} lines
            </span>
          </div>
        </div>

        {/* Log Stream Container */}
        <div
          ref={scrollContainer}
          class="flex-1 bg-slate-950 rounded border border-slate-800 p-3 font-mono text-xs overflow-y-auto space-y-1"
        >
          <Show
            when={filteredLogs().length > 0}
            fallback={
              <div class="text-slate-600 italic text-center py-10">
                No log output recorded yet for this instance.
              </div>
            }
          >
            <For each={filteredLogs()}>
              {(line) => {
                const isErr = line.startsWith('[ERR]') || line.includes('ERROR');
                const isWarn = line.includes('WARN');
                return (
                  <div
                    class={`leading-relaxed break-all ${
                      isErr
                        ? 'text-rose-400'
                        : isWarn
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {line}
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
    )}
  </Show>
  );
}
