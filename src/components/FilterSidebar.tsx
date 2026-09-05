import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Cpu, FilterX, Layers, ShieldCheck, Tag } from 'lucide-react';
import type { Dataset } from '../lib/dataset';
import type { OptionRow } from '../lib/types';
import { activeFilterCount, useStore } from '../lib/store';
import type { DefaultFilter, VersionMode } from '../lib/store';
import { CATEGORIES, categoryStyle } from '../lib/catalog';
import { Badge, Button, SectionTitle, Toggle } from './ui';

const VERSION_MODES: { id: VersionMode; label: string; hint: string }[] = [
  { id: 'any', label: 'any of', hint: 'Option exists in at least one of the selected releases' },
  { id: 'all', label: 'all of', hint: 'Option exists in every selected release' },
  { id: 'only', label: 'only in', hint: 'Option exists in exactly those releases and no other' },
];

const DEFAULT_STATES: { id: DefaultFilter; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'enabled', label: 'On' },
  { id: 'disabled', label: 'Off' },
  { id: 'value', label: 'Valued' },
];

function Chip({
  active, onClick, children, count, style, title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={active ? style : undefined}
      className={clsx(
        'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] font-medium transition-all duration-150',
        active
          ? 'border-transparent shadow-sm'
          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
        !style && active && 'bg-accent text-white',
      )}
    >
      <span className="truncate">{children}</span>
      {count !== undefined && (
        <span className={clsx('font-mono text-[10px]', active ? 'opacity-70' : 'text-faint')}>{count}</span>
      )}
    </button>
  );
}

export function FilterSidebar({ data, visible }: { data: Dataset; visible: OptionRow[] }) {
  const { filters, patchFilters, toggleIn, toggleVersion, resetFilters, theme, pivot, setPivot } = useStore();
  const { manifest, profiles } = data;
  const active = activeFilterCount(filters);

  // Counts are computed on the currently visible rows so the sidebar tells you
  // what a click would actually do rather than showing a static total.
  const catCounts = new Map<string, number>();
  const langCounts = new Map<string, number>();
  for (const r of visible) {
    catCounts.set(r.c, (catCounts.get(r.c) ?? 0) + 1);
    for (const l of r.l ?? []) langCounts.set(l, (langCounts.get(l) ?? 0) + 1);
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-bg-alt">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.07em] text-faint">Filters</span>
        <AnimatePresence>
          {active > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button size="sm" variant="ghost" onClick={resetFilters} className="text-danger">
                <FilterX className="size-3" />
                Reset {active}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {/* ---------------- releases ---------------- */}
        <section>
          <SectionTitle hint="Which GCC releases the option has to exist in">Releases</SectionTitle>
          <div className="mb-2 flex flex-wrap gap-1">
            {manifest.versions.map((v) => (
              <Chip key={v} active={filters.versions.includes(v)} onClick={() => toggleVersion(v)}>
                {v}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
            {VERSION_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.hint}
                onClick={() => patchFilters({ versionMode: m.id })}
                className={clsx(
                  'flex-1 rounded-[7px] px-1 py-1 text-[11.5px] font-medium transition-colors',
                  filters.versionMode === m.id ? 'bg-accent text-white' : 'text-muted hover:text-ink',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </section>

        {/* ---------------- pivot ---------------- */}
        <section>
          <SectionTitle hint="The release whose default values are shown in the table and detail panel">
            Pivot release
          </SectionTitle>
          <div className="flex flex-wrap gap-1">
            {manifest.versions.map((v) => (
              <Chip key={v} active={pivot === v} onClick={() => setPivot(v)} title={`Show defaults as reported by GCC ${v}`}>
                {v}
              </Chip>
            ))}
          </div>
        </section>

        {/* ---------------- default state ---------------- */}
        <section>
          <SectionTitle hint="Default value reported by `gcc -Q --help`">Default value</SectionTitle>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
            {DEFAULT_STATES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => patchFilters({ defaultState: d.id })}
                className={clsx(
                  'flex-1 rounded-[7px] px-1 py-1 text-[11.5px] font-medium transition-colors',
                  filters.defaultState === d.id ? 'bg-accent text-white' : 'text-muted hover:text-ink',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* ---------------- umbrella flags ---------------- */}
        <section>
          <SectionTitle hint="Options turned on by a single umbrella flag, measured by diffing `gcc -Q --help` with and without it">
            <Layers className="size-3" />
            Enabled by
          </SectionTitle>
          <div className="flex flex-wrap gap-1">
            {manifest.packs.map((p) => (
              <Chip
                key={p.flags}
                active={filters.packs.includes(p.flags)}
                onClick={() => toggleIn('packs', p.flags)}
                count={p.count}
                title={`${p.count} options are turned on by ${p.flags}`}
              >
                <code className="font-mono">{p.flags}</code>
              </Chip>
            ))}
          </div>
        </section>

        {/* ---------------- profiles ---------------- */}
        <section>
          <SectionTitle hint="Curated flag sets — see the Docs page for the rationale behind each one">
            <ShieldCheck className="size-3" />
            Profiles
          </SectionTitle>
          <div className="flex flex-col gap-1">
            {profiles.profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleIn('profiles', p.id)}
                className={clsx(
                  'flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-[12px] transition-all',
                  filters.profiles.includes(p.id)
                    ? 'border-accent bg-accent-soft text-accent-text'
                    : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
                )}
                title={p.summary}
              >
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-faint">{p.flags.length}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ---------------- categories ---------------- */}
        <section>
          <SectionTitle>
            <Tag className="size-3" />
            Categories
          </SectionTitle>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.filter((c) => manifest.categories[c.id]).map((c) => (
              <Chip
                key={c.id}
                active={filters.categories.includes(c.id)}
                onClick={() => toggleIn('categories', c.id)}
                count={catCounts.get(c.id) ?? 0}
                style={categoryStyle(c.id, theme === 'dark')}
                title={c.blurb}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </section>

        {/* ---------------- front ends ---------------- */}
        <section>
          <SectionTitle hint="Front ends that list the option specifically; options with none are language independent">
            Front ends
          </SectionTitle>
          <div className="flex flex-wrap gap-1">
            {manifest.languages.map((l) => (
              <Chip
                key={l}
                active={filters.languages.includes(l)}
                onClick={() => toggleIn('languages', l)}
                count={langCounts.get(l) ?? 0}
              >
                {l}
              </Chip>
            ))}
          </div>
        </section>

        {/* ---------------- architectures ---------------- */}
        <section>
          <SectionTitle hint="Machine-dependent options, grouped the way the GCC manual groups them">
            <Cpu className="size-3" />
            Architecture
          </SectionTitle>
          <select
            value={filters.archGroup ?? ''}
            onChange={(e) => patchFilters({ archGroup: e.target.value || null })}
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
          >
            <option value="">All architectures</option>
            {manifest.archGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </section>

        {/* ---------------- scope toggles ---------------- */}
        <section>
          <SectionTitle>Scope</SectionTitle>
          <div className="flex flex-col gap-0.5">
            <Toggle
              checked={filters.includeTarget}
              onChange={(v) => patchFilters({ includeTarget: v })}
              label="Cross-target machine options"
              hint="~1 200 options that only exist for other architectures (ARM, RISC-V, …)"
            />
            <Toggle
              checked={filters.includeUndocumented}
              onChange={(v) => patchFilters({ includeUndocumented: v })}
              label="Undocumented options"
              hint="Only listed by `gcc --help=…,undocumented`"
            />
            <Toggle
              checked={filters.includeAliases}
              onChange={(v) => patchFilters({ includeAliases: v })}
              label="Aliases and legacy spellings"
              hint="Options GCC reports as `Same as …`"
            />
            <Toggle
              checked={filters.onlyDocumented}
              onChange={(v) => patchFilters({ onlyDocumented: v })}
              label="Only with manual text"
            />
            <Toggle
              checked={filters.onlyWithSamples}
              onChange={(v) => patchFilters({ onlyWithSamples: v })}
              label="Only with a live example"
              hint="Options for which we compiled a sample and captured the real diagnostic"
            />
            <Toggle
              checked={filters.onlySelected}
              onChange={(v) => patchFilters({ onlySelected: v })}
              label="Only my selection"
            />
          </div>
        </section>

        <p className="pt-2 text-[11px] leading-relaxed text-faint">
          Availability and defaults come from{' '}
          <code className="font-mono">gcc -Q --help</code> run inside the official{' '}
          <code className="font-mono">gcc:{manifest.versions.at(-1)}</code> containers on{' '}
          <Badge>{manifest.releases.at(-1)?.target}</Badge>.
        </p>
      </div>
    </aside>
  );
}
