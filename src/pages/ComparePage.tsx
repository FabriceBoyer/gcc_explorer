import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { ArrowRight, Minus, Plus, RefreshCw } from 'lucide-react';
import { useDataset } from '../lib/dataset-context';
import { useStore } from '../lib/store';
import { defaultAt } from '../lib/filters';
import { categoryLabel, categoryStyle } from '../lib/catalog';
import { LoadingScreen } from '../components/LoadingScreen';
import { VersionStrip } from '../components/VersionStrip';
import { Badge, Empty } from '../components/ui';
import type { OptionRow } from '../lib/types';

type Tab = 'added' | 'removed' | 'changed';

export default function ComparePage() {
  const { data } = useDataset();
  const { theme, select } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('added');
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const [includeTarget, setIncludeTarget] = useState(false);

  const versions = data?.manifest.versions ?? [];
  const a = left ?? versions.at(-2) ?? 14;
  const b = right ?? versions.at(-1) ?? 15;

  const diff = useMemo(() => {
    if (!data) return { added: [], removed: [], changed: [] as { row: OptionRow; from: string; to: string }[] };
    const vs = data.manifest.versions;
    const bitA = 1 << vs.indexOf(a);
    const bitB = 1 << vs.indexOf(b);
    const added: OptionRow[] = [];
    const removed: OptionRow[] = [];
    const changed: { row: OptionRow; from: string; to: string }[] = [];
    for (const row of data.options) {
      if (!includeTarget && row.c === 'target' && row.g) continue;
      if (row.al) continue;
      const inA = Boolean(row.m & bitA);
      const inB = Boolean(row.m & bitB);
      if (!inA && inB) added.push(row);
      else if (inA && !inB) removed.push(row);
      else if (inA && inB) {
        const da = defaultAt(row, vs, a);
        const db = defaultAt(row, vs, b);
        if (da !== db && da !== null && db !== null) changed.push({ row, from: da, to: db });
      }
    }
    return { added, removed, changed };
  }, [data, a, b, includeTarget]);

  if (!data) return <LoadingScreen label="Loading dataset…" />;

  const counts = { added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length };
  const rows: OptionRow[] = tab === 'added' ? diff.added : tab === 'removed' ? diff.removed : diff.changed.map((c) => c.row);
  const changeByName = new Map(diff.changed.map((c) => [c.row.n, c]));

  const openInExplorer = (name: string) => {
    select(name);
    navigate('/explorer');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
        <h1 className="text-[15px] font-semibold">Compare releases</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          What appeared, what disappeared, and whose default value moved between two GCC releases.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <VersionPicker label="From" value={a} versions={versions} onChange={setLeft} />
          <ArrowRight className="size-4 text-faint" />
          <VersionPicker label="To" value={b} versions={versions} onChange={setRight} />

          <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-[12.5px] text-muted">
            <input
              type="checkbox"
              checked={includeTarget}
              onChange={(e) => setIncludeTarget(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            include cross-target machine options
          </label>

          <button
            type="button"
            onClick={() => { setLeft(b); setRight(a); }}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-line bg-bg-alt px-2.5 py-1.5 text-[12.5px] text-muted transition-colors hover:text-ink"
          >
            <RefreshCw className="size-3.5" />
            Swap
          </button>
        </div>

        <div className="mt-3 flex gap-1.5">
          {(['added', 'removed', 'changed'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium capitalize transition-colors',
                tab === t ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              {t === 'added' && <Plus className="size-3.5" />}
              {t === 'removed' && <Minus className="size-3.5" />}
              {t === 'changed' && <RefreshCw className="size-3.5" />}
              {t}
              <span className="font-mono text-[11px] opacity-70">{counts[t]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <Empty icon={<RefreshCw className="size-8" />} title={`No ${tab} options between GCC ${a} and GCC ${b}`}>
            Try a wider version range, or enable cross-target machine options.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row, i) => {
              const change = changeByName.get(row.n);
              return (
                <motion.li
                  key={row.n}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 25) * 0.012 }}
                >
                  <button
                    type="button"
                    onClick={() => openInExplorer(row.n)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <code className="w-[280px] shrink-0 truncate font-mono text-[12.5px] text-ink">
                      {row.n}
                      {row.a && <span className="text-faint">{row.a}</span>}
                    </code>
                    {tab === 'changed' && change && (
                      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11.5px]">
                        <Badge tone="neutral">{change.from || '—'}</Badge>
                        <ArrowRight className="size-3 text-faint" />
                        <Badge tone={change.to === 'enabled' ? 'ok' : 'warn'}>{change.to || '—'}</Badge>
                      </span>
                    )}
                    <span className="hidden min-w-0 flex-1 truncate text-[12.5px] text-muted lg:block">{row.d}</span>
                    <Badge style={categoryStyle(row.c, theme === 'dark')} className="hidden shrink-0 sm:inline-flex">
                      {categoryLabel(row.c)}
                    </Badge>
                    <VersionStrip mask={row.m} versions={versions} size="sm" />
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function VersionPicker({
  label, value, versions, onChange,
}: {
  label: string;
  value: number;
  versions: number[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] uppercase tracking-wider text-faint">{label}</span>
      <div className="flex gap-0.5 rounded-lg border border-line bg-bg-alt p-0.5">
        {versions.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={clsx(
              'rounded-[7px] px-2 py-1 font-mono text-[12px] transition-colors',
              value === v ? 'bg-accent text-white' : 'text-muted hover:text-ink',
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
