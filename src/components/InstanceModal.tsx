import { createSignal, createEffect, Show } from 'solid-js';
import type { Instance, CreateInstancePayload, UpdateInstancePayload } from '../lib/types';
import { X, Key, Loader2 } from 'lucide-solid';

interface InstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCreate: (payload: CreateInstancePayload) => Promise<void>;
  onSubmitUpdate: (payload: UpdateInstancePayload) => Promise<void>;
  editInstance: Instance | null;
}

export function InstanceModal(props: InstanceModalProps) {
  const [name, setName] = createSignal('');
  const [httpPort, setHttpPort] = createSignal(8080);
  const [adminPort, setAdminPort] = createSignal(8082);
  const [listenAddr, setListenAddr] = createSignal('0.0.0.0');
  const [dataDir, setDataDir] = createSignal('');
  const [authKey, setAuthKey] = createSignal('');
  const [autoStart, setAutoStart] = createSignal(false);
  const [autoRestart, setAutoRestart] = createSignal(true);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.isOpen) {
      setError(null);
      if (props.editInstance) {
        setName(props.editInstance.name);
        setHttpPort(props.editInstance.http_port);
        setAdminPort(props.editInstance.admin_port);
        setListenAddr(props.editInstance.http_listen_addr);
        setDataDir(props.editInstance.data_dir);
        setAuthKey(props.editInstance.admin_auth_key || '');
        setAutoStart(props.editInstance.auto_start);
        setAutoRestart(props.editInstance.auto_restart);
      } else {
        setName('');
        setHttpPort(8080);
        setAdminPort(8082);
        setListenAddr('0.0.0.0');
        setDataDir('');
        setAuthKey('');
        setAutoStart(false);
        setAutoRestart(true);
      }
    }
  });

  const generateRandomKey = () => {
    const chars = 'abcdef0123456789';
    let res = '';
    for (let i = 0; i < 32; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    setAuthKey(res);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    if (!name().trim()) {
      setError('Instance name is required');
      return;
    }
    if (httpPort() <= 0 || httpPort() > 65535) {
      setError('Valid HTTP port (1-65535) is required');
      return;
    }
    if (adminPort() <= 0 || adminPort() > 65535) {
      setError('Valid Admin port (1-65535) is required');
      return;
    }
    if (httpPort() === adminPort()) {
      setError('HTTP port and Admin port must not be identical');
      return;
    }

    setLoading(true);
    try {
      if (props.editInstance) {
        await props.onSubmitUpdate({
          id: props.editInstance.id,
          name: name().trim(),
          http_listen_addr: listenAddr().trim() || '0.0.0.0',
          http_port: Number(httpPort()),
          admin_listen_addr: listenAddr().trim() || '0.0.0.0',
          admin_port: Number(adminPort()),
          data_dir: dataDir().trim() || props.editInstance.data_dir,
          admin_auth_key: authKey().trim() || undefined,
          auto_start: autoStart(),
          auto_restart: autoRestart(),
        });
      } else {
        await props.onSubmitCreate({
          name: name().trim(),
          http_listen_addr: listenAddr().trim() || '0.0.0.0',
          http_port: Number(httpPort()),
          admin_listen_addr: listenAddr().trim() || '0.0.0.0',
          admin_port: Number(adminPort()),
          data_dir: dataDir().trim() || undefined,
          admin_auth_key: authKey().trim() || undefined,
          auto_start: autoStart(),
          auto_restart: autoRestart(),
        });
      }
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
      <div class="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-base font-semibold text-slate-100">
            {props.editInstance ? 'Edit Instance' : 'Create New Instance'}
          </h3>
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
            <label class="block text-xs font-medium text-slate-300 mb-1">Instance Name</label>
            <input
              type="text"
              required
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. production-db, local-staging"
              class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">HTTP Port (Client)</label>
              <input
                type="number"
                required
                min="1"
                max="65535"
                value={httpPort()}
                onInput={(e) => setHttpPort(parseInt(e.currentTarget.value) || 8080)}
                class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 font-mono focus:border-blue-500"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Admin Port (API)</label>
              <input
                type="number"
                required
                min="1"
                max="65535"
                value={adminPort()}
                onInput={(e) => setAdminPort(parseInt(e.currentTarget.value) || 8082)}
                class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 font-mono focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">
              Listen Address (0.0.0.0 for LAN/WAN access)
            </label>
            <input
              type="text"
              value={listenAddr()}
              onInput={(e) => setListenAddr(e.currentTarget.value)}
              placeholder="0.0.0.0"
              class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 font-mono focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">
              Data Directory (Optional, defaults to app storage)
            </label>
            <input
              type="text"
              value={dataDir()}
              onInput={(e) => setDataDir(e.currentTarget.value)}
              placeholder="Leave blank for automatic location"
              class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:border-blue-500"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium text-slate-300">
                Admin Auth Key (Bearer Token)
              </label>
              <button
                type="button"
                onClick={generateRandomKey}
                class="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              >
                <Key class="w-3 h-3" />
                <span>Generate Secret</span>
              </button>
            </div>
            <input
              type="text"
              value={authKey()}
              onInput={(e) => setAuthKey(e.currentTarget.value)}
              placeholder="Leave blank for automatic generated key"
              class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:border-blue-500"
            />
          </div>

          <div class="pt-2 border-t border-slate-800 space-y-2">
            <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRestart()}
                onChange={(e) => setAutoRestart(e.currentTarget.checked)}
                class="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto-restart sqld process on unexpected exit</span>
            </label>

            <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoStart()}
                onChange={(e) => setAutoStart(e.currentTarget.checked)}
                class="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto-start instance when application launches</span>
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
              <span>{loading() ? 'Saving...' : props.editInstance ? 'Save Changes' : 'Create Instance'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Show>
  );
}
