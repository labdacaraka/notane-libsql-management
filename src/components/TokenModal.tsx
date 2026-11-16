import { createSignal, createEffect, For, Show } from 'solid-js';
import type { DatabaseNamespace, TokenGenerationResult, TokenRecord } from '../lib/types';
import { api } from '../lib/tauri';
import { CopyButton } from './CopyButton';
import { X, Key, Shield, Clock, AlertTriangle, RefreshCw, Network, Laptop, Loader2 } from 'lucide-solid';

interface TokenModalProps {
  isOpen: boolean;
  database: DatabaseNamespace | null;
  instanceHost: string;
  instancePort: number;
  lanIp?: string | null;
  onClose: () => void;
}

export function TokenModal(props: TokenModalProps) {
  const [permission, setPermission] = createSignal<'rw' | 'ro'>('rw');
  const [duration, setDuration] = createSignal<number | 'never'>(30);
  const [label, setLabel] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [result, setResult] = createSignal<TokenGenerationResult | null>(null);
  const [history, setHistory] = createSignal<TokenRecord[]>([]);
  const [refreshingHistory, setRefreshingHistory] = createSignal(false);

  const loadHistory = async (dbId: string) => {
    setRefreshingHistory(true);
    try {
      const records = await api.listTokenHistory(dbId);
      setHistory(records);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshingHistory(false);
    }
  };

  createEffect(() => {
    if (props.isOpen && props.database) {
      setError(null);
      setResult(null);
      setLabel('');
      loadHistory(props.database.id);
    }
  });

  const handleGenerate = async (e: Event) => {
    e.preventDefault();
    if (!props.database) return;
    setError(null);
    setLoading(true);

    try {
      const durationDays = duration() === 'never' ? undefined : (duration() as number);
      const res = await api.generateToken(
        props.database.id,
        permission(),
        durationDays,
        label().trim() || undefined
      );
      setResult(res);
      await loadHistory(props.database.id);
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
          <div class="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div class="flex items-center gap-2">
                  <Key class="w-4 h-4 text-blue-400" />
                  <h3 class="text-base font-semibold text-slate-100">
                    Token Management: {db().name}
                  </h3>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">
                  Generate Ed25519-signed JWT tokens for client connection
                </p>
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

            <form onSubmit={handleGenerate} class="mt-4 space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Shield class="w-3.5 h-3.5 text-blue-400" />
                    <span>Permission Level</span>
                  </label>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="perm"
                        checked={permission() === 'rw'}
                        onChange={() => setPermission('rw')}
                        class="text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
                      />
                      <span>Read & Write (rw)</span>
                    </label>

                    <label class="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="perm"
                        checked={permission() === 'ro'}
                        onChange={() => setPermission('ro')}
                        class="text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
                      />
                      <span>Read Only (ro)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock class="w-3.5 h-3.5 text-blue-400" />
                    <span>Token Expiration</span>
                  </label>
                  <select
                    value={duration()}
                    onChange={(e) => {
                      const val = e.currentTarget.value;
                      setDuration(val === 'never' ? 'never' : parseInt(val));
                    }}
                    class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500"
                  >
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days (Default)</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>1 Year (365 Days)</option>
                    <option value="never">Never Expires</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-300 mb-1">
                  Token Label (Optional metadata note)
                </label>
                <input
                  type="text"
                  value={label()}
                  onInput={(e) => setLabel(e.currentTarget.value)}
                  placeholder="e.g. Backend API, Mobile App Client"
                  class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:border-blue-500"
                />
              </div>

              <div class="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={loading()}
                  class="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded shadow-sm transition-colors"
                >
                  <Show when={loading()}>
                    <Loader2 class="w-3.5 h-3.5 animate-spin" />
                  </Show>
                  <span>{loading() ? 'Minting Token...' : 'Generate New Token'}</span>
                </button>
              </div>
            </form>

            {/* Generated Token Result Banner */}
            <Show when={result()}>
              <div class="mt-4 p-4 bg-blue-950/40 border border-blue-800/80 rounded-lg space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                    Token Minted Successfully
                  </span>
                  <span class="text-[11px] text-amber-400 flex items-center gap-1 font-medium">
                    <AlertTriangle class="w-3.5 h-3.5" />
                    <span>Save token now; not shown again</span>
                  </span>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[11px] font-medium text-slate-300">Auth Token (JWT)</span>
                    <CopyButton text={result()!.token} label="Copy Token" />
                  </div>
                  <div class="p-2.5 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-blue-200 break-all select-all">
                    {result()!.token}
                  </div>
                </div>

                {/* Localhost Connection */}
                <div class="pt-3 border-t border-blue-900/40">
                  <div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 mb-2">
                    <Laptop class="w-3.5 h-3.5 text-slate-400" />
                    <span>Localhost Connection (Same Machine: 127.0.0.1)</span>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-[11px] font-medium text-slate-400">HTTP Connection URL</span>
                        <CopyButton text={result()!.connection_url_http} label="Copy URL" />
                      </div>
                      <div class="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                        {result()!.connection_url_http}
                      </div>
                    </div>

                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-[11px] font-medium text-slate-400">LibSQL Protocol URI</span>
                        <CopyButton text={result()!.connection_url_libsql} label="Copy URI" />
                      </div>
                      <div class="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                        {result()!.connection_url_libsql}
                      </div>
                    </div>
                  </div>
                </div>

                {/* LAN Network Connection */}
                <Show when={result()!.lan_connection_url_http || (props.lanIp && props.instanceHost === '0.0.0.0')}>
                  <div class="pt-3 border-t border-blue-900/40">
                    <div class="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 mb-2">
                      <Network class="w-3.5 h-3.5 text-emerald-400" />
                      <span>Local Network (LAN / Wi-Fi IP: {props.lanIp || 'Active'})</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div class="flex items-center justify-between mb-1">
                          <span class="text-[11px] font-medium text-slate-400">HTTP Connection URL (LAN)</span>
                          <CopyButton
                            text={
                              result()!.lan_connection_url_http ||
                              `http://${props.lanIp}:${props.instancePort}`
                            }
                            label="Copy LAN URL"
                          />
                        </div>
                        <div class="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-emerald-200 break-all select-all">
                          {result()!.lan_connection_url_http ||
                            `http://${props.lanIp}:${props.instancePort}`}
                        </div>
                      </div>

                      <div>
                        <div class="flex items-center justify-between mb-1">
                          <span class="text-[11px] font-medium text-slate-400">LibSQL Protocol URI (LAN)</span>
                          <CopyButton
                            text={
                              result()!.lan_connection_url_libsql ||
                              `libsql://${props.lanIp}:${props.instancePort}?authToken=${result()!.token}`
                            }
                            label="Copy LAN URI"
                          />
                        </div>
                        <div class="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-emerald-200 break-all select-all">
                          {result()!.lan_connection_url_libsql ||
                            `libsql://${props.lanIp}:${props.instancePort}?authToken=${result()!.token}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Token History */}
            <div class="mt-6">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Token Metadata History ({history().length})
                </h4>
                <button
                  type="button"
                  onClick={() => props.database && loadHistory(props.database.id)}
                  disabled={refreshingHistory()}
                  class="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <RefreshCw class={`w-3 h-3 ${refreshingHistory() ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <Show
                when={history().length > 0}
                fallback={
                  <div class="p-4 bg-slate-950 rounded border border-slate-800 text-center text-xs text-slate-500">
                    No tokens generated yet for this database.
                  </div>
                }
              >
                <div class="bg-slate-950 rounded border border-slate-800 divide-y divide-slate-850 overflow-hidden text-xs">
                  <For each={history()}>
                    {(item) => (
                      <div class="p-3 flex items-center justify-between">
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-slate-200">
                              {item.label || 'Unnamed Token'}
                            </span>
                            <span
                              class={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                item.permission === 'rw'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {item.permission.toUpperCase()}
                            </span>
                          </div>
                          <div class="text-[11px] text-slate-500 mt-0.5 font-mono">
                            Issued: {new Date(item.issued_at).toLocaleDateString()}{' '}
                            {new Date(item.issued_at).toLocaleTimeString()}
                          </div>
                        </div>

                        <div class="text-right text-[11px] font-mono text-slate-400">
                          {item.expires_at ? (
                            <span>Expires: {new Date(item.expires_at).toLocaleDateString()}</span>
                          ) : (
                            <span class="text-emerald-400">Never expires</span>
                          )}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <div class="mt-6 pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={props.onClose}
                class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
