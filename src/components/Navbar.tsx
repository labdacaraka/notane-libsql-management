import { Server, Activity, Settings, Plus, RefreshCw } from 'lucide-solid';

interface NavbarProps {
  currentTab: 'instances' | 'activity' | 'settings';
  onSelectTab: (tab: 'instances' | 'activity' | 'settings') => void;
  onNewInstance: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function Navbar(props: NavbarProps) {
  return (
    <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm tracking-tight">
              NL
            </div>
            <div>
              <span class="font-semibold text-slate-100 text-sm tracking-tight block">
                Notane LibSQL
              </span>
              <span class="text-[10px] text-slate-400 font-mono block -mt-0.5">
                sqld Manager v0.24.25
              </span>
            </div>
          </div>

          <nav class="flex items-center gap-1">
            <button
              type="button"
              onClick={() => props.onSelectTab('instances')}
              class={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                props.currentTab === 'instances'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Server class="w-3.5 h-3.5" />
              <span>Instances</span>
            </button>

            <button
              type="button"
              onClick={() => props.onSelectTab('activity')}
              class={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                props.currentTab === 'activity'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity class="w-3.5 h-3.5" />
              <span>Activity Log</span>
            </button>

            <button
              type="button"
              onClick={() => props.onSelectTab('settings')}
              class={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                props.currentTab === 'settings'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Settings class="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={props.isRefreshing}
            aria-label="Refresh instance states"
            class="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh"
          >
            <RefreshCw class={`w-4 h-4 ${props.isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={props.onNewInstance}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>New Instance</span>
          </button>
        </div>
      </div>
    </header>
  );
}
