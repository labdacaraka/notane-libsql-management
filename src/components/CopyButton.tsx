import { createSignal } from 'solid-js';
import { Copy, Check } from 'lucide-solid';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = props.text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied() ? 'Copied to clipboard' : 'Copy to clipboard'}
      title={copied() ? 'Copied' : 'Copy'}
      class={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
        copied()
          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
      } ${props.className || ''}`}
    >
      {copied() ? (
        <>
          <Check class="w-3.5 h-3.5 text-emerald-400" />
          <span>{props.label ? 'Copied' : ''}</span>
        </>
      ) : (
        <>
          <Copy class="w-3.5 h-3.5 text-slate-400" />
          <span>{props.label || ''}</span>
        </>
      )}
    </button>
  );
}
