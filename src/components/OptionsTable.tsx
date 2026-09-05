import { useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUpDown, FileCode2, Layers, ShieldCheck, Telescope } from 'lucide-react';
import type { Manifest, OptionRow } from '../lib/types';
import { selectedOptionNames, useStore } from '../lib/store';
import { defaultAt, defaultVaries } from '../lib/filters';
import { categoryLabel, categoryStyle } from '../lib/catalog';
import { VersionStrip } from './VersionStrip';
import { ImpactMeter } from './ImpactMeter';
/** Sentinel for a score of "varies", which never participates in ordering. */
const UNKNOWN = Symbol('varies');
import { Badge, Checkbox, Empty } from './ui';

export type SortKey =
  | 'name' | 'default' | 'category' | 'since' | 'until' | 'relevance'
  | 'build' | 'runtime';
export interface SortState { key: SortKey; dir: 'asc' | 'desc' }

const COLUMNS: { key: SortKey; label: string; className: string; sortable: boolean; hint?: string }[] = [
  { key: 'name', label: 'Option', className: 'flex-[1.5] min-w-[196px]', sortable: true },
  { key: 'default', label: 'Default', className: 'w-[92px] shrink-0 hidden sm:flex', sortable: true, hint: 'Value reported by `gcc -Q --help` for the pivot release' },
  { key: 'relevance', label: 'Description', className: 'flex-[2.6] min-w-0 hidden md:flex', sortable: false },
  { key: 'build', label: 'Build', className: 'w-[62px] shrink-0 hidden lg:flex', sortable: true, hint: 'Compile-time cost of adding this option — measured where a benchmark can show it' },
  { key: 'runtime', label: 'Runtime', className: 'w-[72px] shrink-0 hidden lg:flex', sortable: true, hint: 'Effect on how fast the produced program runs' },
  { key: 'category', label: 'Category', className: 'w-[128px] shrink-0 hidden 2xl:flex', sortable: true },
  { key: 'since', label: 'Versions', className: 'w-[124px] shrink-0', sortable: true, hint: 'Release range in which the option exists' },
];

function sortRows(rows: OptionRow[], sort: SortState, versions: number[], pivot: number): OptionRow[] {
  if (sort.key === 'relevance') return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  const value = (r: OptionRow): string | number | typeof UNKNOWN => {
    switch (sort.key) {
      case 'default': return defaultAt(r, versions, pivot) ?? '￿';
      case 'category': return r.c;
      case 'since': return r.since;
      case 'until': return r.until;
      case 'build': return r.im.b ?? UNKNOWN;
      case 'runtime': return r.im.r ?? UNKNOWN;
      default: return r.n;
    }
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // "Varies" always sinks to the bottom, whichever way the column is sorted:
    // sorting by cost descending should surface the expensive options, not the
    // ones we could not put a number on.
    if (va === UNKNOWN || vb === UNKNOWN) {
      if (va === vb) return a.n.localeCompare(b.n);
      return va === UNKNOWN ? 1 : -1;
    }
    if (va === vb) return a.n.localeCompare(b.n);
    return (va < vb ? -1 : 1) * dir;
  });
}

function DefaultCell({ value }: { value: string | null }) {
  if (value === null || value === '') return <span className="text-faint">—</span>;
  if (value === 'enabled') return <Badge tone="ok">on</Badge>;
  if (value === 'disabled') return <Badge tone="neutral">off</Badge>;
  if (value.startsWith('n/a:')) {
    return (
      <Badge tone="neutral" title={`Rejected by the C driver; available in ${value.slice(4)}`}>
        n/a
      </Badge>
    );
  }
  return <span className="truncate font-mono text-[11.5px] text-warn" title={value}>{value}</span>;
}

export function OptionsTable({
  rows, manifest, hasQuery,
}: {
  rows: OptionRow[];
  manifest: Manifest;
  hasQuery: boolean;
}) {
  const { selection, toggleOption, addOptions, removeOptions, selected, select, pivot, density, theme } = useStore();
  const chosen = useMemo(() => selectedOptionNames(selection), [selection]);
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });
  const parentRef = useRef<HTMLDivElement>(null);

  // With a query in the box, relevance beats alphabetical order unless the
  // user has explicitly picked another column.
  const effectiveSort = useMemo<SortState>(
    () => (hasQuery && sort.key === 'name' ? { key: 'relevance', dir: 'asc' } : sort),
    [hasQuery, sort],
  );
  const sorted = useMemo(
    () => sortRows(rows, effectiveSort, manifest.versions, pivot),
    [rows, effectiveSort, manifest.versions, pivot],
  );

  const rowHeight = density === 'compact' ? 34 : 44;
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const allSelected = sorted.length > 0 && sorted.every((r) => chosen.has(r.n));
  const someSelected = sorted.some((r) => chosen.has(r.n));

  const toggleAll = useCallback((next: boolean) => {
    if (next) addOptions(sorted.map((r) => ({ flag: r.n, option: r.n })));
    else removeOptions(sorted.map((r) => r.n));
  }, [sorted, addOptions, removeOptions]);

  const onHeaderClick = (key: SortKey, sortable: boolean) => {
    if (!sortable) return;
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  if (!sorted.length) {
    return (
      <Empty icon={<Telescope className="size-8" />} title="No option matches these filters">
        Try clearing the search box, or widening the release selection in the sidebar.
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line bg-surface-2/70 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={toggleAll}
          ariaLabel={allSelected ? 'Deselect all visible options' : 'Select all visible options'}
        />
        {COLUMNS.map((col) => {
          const active = effectiveSort.key === col.key;
          return (
            <button
              key={col.key}
              type="button"
              title={col.hint}
              onClick={() => onHeaderClick(col.key, col.sortable)}
              className={clsx(
                'flex items-center gap-1 text-left uppercase',
                col.className,
                col.sortable ? 'cursor-pointer hover:text-ink' : 'cursor-default',
                active && 'text-accent-text',
              )}
            >
              {col.label}
              {col.sortable && (active
                ? (effectiveSort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)
                : <ChevronsUpDown className="size-3 opacity-40" />)}
            </button>
          );
        })}
      </div>

      {/* rows */}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = sorted[vi.index];
            const isSelected = chosen.has(row.n);
            const isActive = selected === row.n;
            const def = defaultAt(row, manifest.versions, pivot);
            const varies = defaultVaries(row);
            return (
              <div
                key={row.n}
                data-index={vi.index}
                role="button"
                tabIndex={0}
                onClick={() => select(row.n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(row.n); }
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: vi.size, transform: `translateY(${vi.start}px)` }}
                className={clsx(
                  'group flex cursor-pointer items-center gap-3 border-b border-line/60 px-3 text-[13px] transition-colors',
                  isActive ? 'bg-accent-soft/70' : isSelected ? 'bg-ok-soft/25 hover:bg-ok-soft/40' : 'hover:bg-surface-2',
                )}
              >
                <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleOption(row.n)}
                    ariaLabel={`${isSelected ? 'Remove' : 'Add'} ${row.n} ${isSelected ? 'from' : 'to'} the selection`}
                  />
                </span>

                <div className={clsx('flex min-w-0 flex-col justify-center', COLUMNS[0].className)}>
                  <span className="flex items-center gap-1.5">
                    <code className={clsx('truncate font-mono text-[12.5px]', isActive ? 'text-accent-text' : 'text-ink')}>
                      {row.n}
                      {row.a && <span className="text-faint">{row.a}</span>}
                    </code>
                    {row.pk && (
                      <span title={`Enabled by ${row.packNames.join(', ')}`}>
                        <Badge tone="warn" className="gap-0.5">
                          <Layers className="size-2.5" />
                          {row.packNames.length}
                        </Badge>
                      </span>
                    )}
                    {row.profiles.length > 0 && (
                      <span title={`In ${row.profiles.length} curated profile(s)`}>
                        <ShieldCheck className="size-3 text-ok" />
                      </span>
                    )}
                    {row.ex && (
                      <span title="Has a real compiler diagnostic example">
                        <FileCode2 className="size-3 text-accent" />
                      </span>
                    )}
                  </span>
                  {density === 'comfortable' && (
                    <span className="truncate text-[11.5px] text-faint md:hidden">{row.d}</span>
                  )}
                </div>

                <div className={clsx('items-center overflow-hidden', COLUMNS[1].className)}>
                  <span className="flex min-w-0 items-center gap-1">
                    <DefaultCell value={def} />
                    {varies && <span className="text-[10px] text-warn" title="The default changed between releases">△</span>}
                  </span>
                </div>

                <div className={clsx('min-w-0 items-center', COLUMNS[2].className)}>
                  <span className="truncate text-muted">{row.d || <em className="text-faint">no description</em>}</span>
                </div>

                <div className={clsx('items-center', COLUMNS[3].className)}>
                  <ImpactMeter score={row.im.b} axis="b" source={row.im.s} />
                </div>

                <div className={clsx('items-center gap-1', COLUMNS[4].className)}>
                  <ImpactMeter score={row.im.r} axis="r" source={row.im.s} />
                  {row.im.s === 'm' && (
                    <span className="text-[9px] text-ok" title="Benchmarked in the release containers">●</span>
                  )}
                </div>

                <div className={clsx('items-center', COLUMNS[5].className)}>
                  <Badge style={categoryStyle(row.c, theme === 'dark')}>{categoryLabel(row.c)}</Badge>
                </div>

                <div className={clsx('flex items-center gap-2', COLUMNS[6].className)}>
                  <VersionStrip mask={row.m} versions={manifest.versions} highlight={pivot} />
                  <span className="font-mono text-[11px] text-faint">
                    {row.since}
                    {row.until !== row.since && `–${row.until}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
