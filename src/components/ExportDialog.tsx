import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Check, Copy, Download, X } from 'lucide-react';
import type { Dataset } from '../lib/dataset';
import { useStore } from '../lib/store';
import { flagStage, FORMATS, splitFlags } from '../lib/export';
import type { SelectedFlag } from '../lib/export';
import { Badge, Button } from './ui';

// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedFlags(data: Dataset): SelectedFlag[] {
  const selection = useStore((s) => s.selection);
  return useMemo(
    () => Object.entries(selection)
      .map(([flag, name]) => ({
        name,
        value: flag.startsWith(name) ? flag.slice(name.length) : '',
        row: data.byName.get(name),
        flag,
      }))
      .sort((a, b) => a.flag.localeCompare(b.flag)),
    [selection, data],
  );
}

export function ExportDialog({ data, onClose }: { data: Dataset; onClose: () => void }) {
  const flags = useSelectedFlags(data);
  const pivot = useStore((s) => s.pivot);
  const activeProfiles = useStore((s) => s.filters.profiles);
  const [formatId, setFormatId] = useState(FORMATS[2].id);
  const [copied, setCopied] = useState(false);

  const format = FORMATS.find((f) => f.id === formatId)!;
  const split = splitFlags(flags);
  const text = format.render(split, {
    generatedAt: new Date().toISOString(),
    gccVersion: pivot,
    profileNames: activeProfiles
      .map((id) => data.profiles.profiles.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[],
  });

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unavailable = flags.filter((f) => f.row && !(f.row.m & (1 << data.manifest.versions.indexOf(pivot))));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} role="presentation" />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="surface-card relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold">Export {flags.length} flags</h2>
          <Badge tone="accent">{split.compile.length} compile</Badge>
          <Badge tone="warn">{split.link.length} link</Badge>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line p-2 md:w-52 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormatId(f.id)}
                title={f.blurb}
                className={clsx(
                  'shrink-0 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors md:shrink',
                  formatId === f.id ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2">
              <code className="font-mono text-[12px] text-muted">{format.filename}</code>
              <span className="truncate text-[12px] text-faint">— {format.blurb}</span>
              <div className="ml-auto flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(text).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }).catch(() => undefined);
                  }}
                >
                  {copied ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" variant="primary" onClick={download}>
                  <Download className="size-3" />
                  Download
                </Button>
              </div>
            </div>

            {unavailable.length > 0 && (
              <p className="border-b border-line bg-warn-soft px-4 py-2 text-[12px] text-warn">
                {unavailable.length} selected flag{unavailable.length > 1 ? 's do' : ' does'} not exist in GCC {pivot}:{' '}
                <code className="font-mono">{unavailable.map((f) => f.name).join(' ')}</code>
              </p>
            )}

            <pre className="min-h-0 flex-1 overflow-auto bg-bg-alt px-4 py-3 font-mono text-[12px] leading-relaxed text-ink">
              <code>{text}</code>
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-t border-line px-4 py-2.5">
          {flags.map((f) => (
            <Badge key={f.flag} tone={flagStage(f.flag, f.row) === 'link' ? 'warn' : 'neutral'}>
              <code className="font-mono">{f.flag}</code>
            </Badge>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
