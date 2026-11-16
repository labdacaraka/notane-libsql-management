import { createSignal, createEffect } from 'solid-js';
import type { SystemStatus } from '../lib/types';
import { api } from '../lib/tauri';
import { CopyButton } from './CopyButton';
import { Settings, CheckCircle2, HardDrive, Cpu, RefreshCw } from 'lucide-solid';

export function SettingsView() {
  const [status, setStatus] = createSignal<SystemStatus | null>(null);
  const [loading, setLoading] = createSignal(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemStatus();
      setStatus(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    fetchStatus();
  });

  return (
    <div class="space-y-6 max-w-4xl">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
            <Settings class="w-4 h-4 text-blue-400" />
            <span>Settings & System Overview</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Runtime environment and sqld engine parameters
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading()}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-xs rounded transition-colors"
        >
          <RefreshCw class={`w-3.5 h-3.5 ${loading() ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* System Status Cards */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Cpu class="w-4 h-4 text-blue-400" />
              <h3 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                sqld Engine Runtime
              </h3>
            </div>
            <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-900 px-2 py-0.5 rounded">
              <CheckCircle2 class="w-3 h-3" />
              <span>Embedded Binary</span>
            </span>
          </div>

          <div class="space-y-2 text-xs">
            <div class="flex justify-between py-1 border-b border-slate-800/60">
              <span class="text-slate-400">Engine Version</span>
              <span class="text-slate-200 font-mono font-medium">
                {status()?.sqld_version || 'Loading...'}
              </span>
            </div>

            <div class="flex justify-between py-1 border-b border-slate-800/60">
              <span class="text-slate-400">Active Instances</span>
              <span class="text-slate-200 font-mono font-medium">
                {status()?.running_instances || 0} / {status()?.total_instances || 0}
              </span>
            </div>

            <div class="flex justify-between py-1">
              <span class="text-slate-400">Total Namespaces</span>
              <span class="text-slate-200 font-mono font-medium">
                {status()?.total_databases || 0}
              </span>
            </div>
          </div>
        </div>

        <div class="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
          <div class="flex items-center gap-2">
            <HardDrive class="w-4 h-4 text-blue-400" />
            <h3 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Extracted Binary Path
            </h3>
          </div>

          <div class="space-y-2 text-xs">
            <div>
              <span class="text-slate-400 block text-[11px] mb-1">Executable location:</span>
              <div class="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-300 break-all flex items-center justify-between gap-2">
                <span>{status()?.sqld_path || 'Checking...'}</span>
                {status()?.sqld_path && (
                  <CopyButton text={status()!.sqld_path} />
                )}
              </div>
            </div>

            <p class="text-[11px] text-slate-500 leading-relaxed pt-1">
              This binary is automatically verified and extracted on startup if updated.
            </p>
          </div>
        </div>
      </div>

      {/* Guidelines & Documentation section */}
      <div class="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
        <h3 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Connecting Client Applications
        </h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          To connect to any database instance running in Notane LibSQL Management from your applications or other machines on the network:
        </p>

        <div class="p-3 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
          <div class="text-slate-500">// Example in TypeScript with @libsql/client</div>
          <div class="text-blue-300">import &#123; createClient &#125; from "@libsql/client";</div>
          <div>
            const client = createClient(&#123;
            <div class="pl-4 text-slate-400">
              url: "http://&lt;machine-ip&gt;:8080/v1/namespaces/&lt;db-name&gt;",
            </div>
            <div class="pl-4 text-slate-400">authToken: "eyJhbGciOiJFZERTQSIs..."</div>
            &#125;);
          </div>
        </div>
      </div>
    </div>
  );
}
