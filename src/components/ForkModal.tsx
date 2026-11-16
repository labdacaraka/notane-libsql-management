import { createSignal, createEffect, Show } from 'solid-js';
import type { DatabaseNamespace } from '../lib/types';
import { X, GitFork, Loader2 } from 'lucide-solid';

interface ForkModalProps {
  isOpen: boolean;
  database: DatabaseNamespace | null;
  onClose: () => void;
  onSubmit: (databaseId: string, targetName: string) => Promise<void>;
}

export function ForkModal(props: ForkModalProps) {
  const [targetName, setTargetName] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.isOpen && props.database) {
      setTargetName(`${props.database.name}_copy`);
      setError(null);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!props.database) return;
    setError(null);
    const clean = targetName().trim();
    if (!clean) {
      setError('Target database name is required');
      return;
    }

    setLoading(true);
    try {
      await props.onSubmit(props.database.id, clean);
      props.onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.isOpen && props.database ? props.database : undefined}>
      {(db) => (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div class="flex items-center gap-2">
                <GitFork class="w-4 h-4 text-blue-400" />
                <h3 class="text-base font-semibold text-slate-100">Fork Database: {db().name}</h3>
              </div>
              <button
                type="button"
                onClick={props.onClose}
                aria-label="Close dialog"
                class="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            {error() && (
              <div class="mt-4 p-3 bg-rose-950/60 border border-rose-800 rounded text-rose-300 text-xs">
                {error()}
              </div>
            )}

            <form onSubmit={handleSubmit} class="mt-4 space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">
                  Source Database
                </label>
                <div class="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-sm font-mono text-slate-300">
                  {db().name}
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-300 mb-1">
                  Target Database Name (New Clone)
                </label>
                <input
                  type="text"
                  required
                  autofocus
                  value={targetName()}
                  onInput={(e) => setTargetName(e.currentTarget.value)}
                  placeholder="e.g. app_backup, test_fork"
                  class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:border-blue-500"
                />
              </div>

              <p class="text-xs text-slate-400">
                Forking creates a point-in-time snapshot and clone of the source database into an independent namespace.
              </p>

              <div class="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={props.onClose}
                  disabled={loading()}
                  class="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading()}
                  class="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded shadow-sm transition-colors"
                >
                  <Show when={loading()}>
                    <Loader2 class="w-3.5 h-3.5 animate-spin" />
                  </Show>
                  <span>{loading() ? 'Forking...' : 'Create Fork'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Show>
  );
}
