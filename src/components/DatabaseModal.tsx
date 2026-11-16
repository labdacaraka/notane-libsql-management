import { createSignal, createEffect, Show } from 'solid-js';
import { X, ShieldCheck, Loader2 } from 'lucide-solid';

interface DatabaseModalProps {
  isOpen: boolean;
  instanceName: string;
  onClose: () => void;
  onSubmit: (name: string, generateKey: boolean) => Promise<void>;
}

export function DatabaseModal(props: DatabaseModalProps) {
  const [name, setName] = createSignal('');
  const [generateKey, setGenerateKey] = createSignal(true);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.isOpen) {
      setName('');
      setGenerateKey(true);
      setError(null);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    const clean = name().trim();
    if (!clean) {
      setError('Database name is required');
      return;
    }

    setLoading(true);
    try {
      await props.onSubmit(clean, generateKey());
      props.onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 class="text-base font-semibold text-slate-100">Create New Database</h3>
            <p class="text-xs text-slate-400 mt-0.5">Instance: {props.instanceName}</p>
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
            <label class="block text-xs font-medium text-slate-300 mb-1">
              Database Name (Namespace)
            </label>
            <input
              type="text"
              required
              autofocus
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. app_production, users_db"
              class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:border-blue-500"
            />
            <p class="text-[11px] text-slate-500 mt-1">
              Use lowercase alphanumeric characters, underscores, or hyphens.
            </p>
          </div>

          <div class="p-3 bg-slate-950 rounded border border-slate-800/80">
            <label class="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={generateKey()}
                onChange={(e) => setGenerateKey(e.currentTarget.checked)}
                class="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <span class="block text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
                  <span>Generate Ed25519 Keypair automatically</span>
                </span>
                <span class="block text-[11px] text-slate-400 mt-0.5">
                  Configures the database with an Ed25519 public key so you can immediately mint secure JWT auth tokens.
                </span>
              </div>
            </label>
          </div>

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
              <span>{loading() ? 'Creating...' : 'Create Database'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Show>
  );
}
