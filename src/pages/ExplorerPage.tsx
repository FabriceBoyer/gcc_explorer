import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckSquare, PanelLeftClose, PanelLeftOpen, Rows3, Rows4, Search, ShieldPlus,
  SlidersHorizontal, Square, X,
} from 'lucide-react';
import { useDataset } from '../lib/dataset-context';
import { activeFilterCount, selectedOptionNames, useStore } from '../lib/store';
import { filterOptions } from '../lib/filters';
import { LoadingScreen } from '../components/LoadingScreen';
import { FilterSidebar } from '../components/FilterSidebar';
import { OptionsTable } from '../components/OptionsTable';
import { DetailPanel } from '../components/DetailPanel';
import { SelectionBar } from '../components/SelectionBar';
import { ImportDialog } from '../components/ImportDialog';
import { ExportDialog } from '../components/ExportDialog';
import { Badge, Button } from '../components/ui';

export default function ExplorerPage() {
  const { data, error, phase } = useDataset();
  const {
    filters, patchFilters, selection, addOptions, removeOptions,
    sidebarOpen, setSidebarOpen, density, setDensity, selected, select,
  } = useStore();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState(filters.query);
  // Below `md` there is no room to dock the sidebar, so it becomes a drawer.
  // That is separate from `sidebarOpen`, which is the persisted docked state.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounce the search box so typing stays smooth over 3 000 rows.
  useEffect(() => {
    const t = setTimeout(() => patchFilters({ query }), 120);
    return () => clearTimeout(t);
  }, [query, patchFilters]);

  // Leaving the drawer "open" while the layout switches to the docked sidebar
  // would strand an invisible scrim in the state.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => { if (mq.matches) setFiltersOpen(false); };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setExporting(false); setFiltersOpen(false); select(null); }
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        document.getElementById('gccx-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  const chosen = useMemo(() => selectedOptionNames(selection), [selection]);
  const rows = useMemo(
    () => (data ? filterOptions(data.options, filters, { manifest: data.manifest, selected: chosen }) : []),
    [data, filters, chosen],
  );

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-danger">The dataset could not be loaded.</p>
        <p className="max-w-md text-[13px] text-muted">{error.message}</p>
        <p className="max-w-md text-[13px] text-faint">
          If you are running from a checkout, generate it first with{' '}
          <code className="font-mono">npm run data:build</code>.
        </p>
      </div>
    );
  }
  if (!data) return <LoadingScreen label={`Loading ${phase}…`} />;

  const allVisibleSelected = rows.length > 0 && rows.every((r) => chosen.has(r.n));
  const selectedCount = chosen.size;
  const activeFilters = activeFilterCount(filters);

  return (
    <div className="relative flex h-full min-h-0">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="hidden overflow-hidden md:block"
          >
            <FilterSidebar data={data} visible={rows} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* toolbar */}
        <div className="flex justify-end border-b border-line px-3 py-1"><Button size="sm" onClick={() => setImporting(true)}>Import flags</Button></div>
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Hide filters' : 'Show filters'}
          >
            {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>

          <Button
            size="sm"
            variant={activeFilters > 0 ? 'primary' : 'outline'}
            className="md:hidden"
            onClick={() => setFiltersOpen(true)}
            aria-label="Show filters"
          >
            <SlidersHorizontal className="size-4" />
            {activeFilters > 0 && <span className="font-mono text-[11px]">{activeFilters}</span>}
          </Button>

          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <input
              id="gccx-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 3 000 options…  (press /)"
              className="h-8 w-full rounded-lg border border-line bg-bg-alt pl-8 pr-8 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Badge tone={rows.length === data.options.length ? 'neutral' : 'accent'} className="hidden sm:inline-flex">
            {rows.length.toLocaleString()} / {data.options.length.toLocaleString()}
          </Badge>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => (allVisibleSelected
                ? removeOptions(rows.map((r) => r.n))
                : addOptions(rows.map((r) => ({ flag: r.n, option: r.n }))))}
              title={`${allVisibleSelected ? 'Deselect' : 'Select'} the ${rows.length} options matching the current filters`}
            >
              {allVisibleSelected ? <Square className="size-3.5" /> : <CheckSquare className="size-3.5" />}
              <span className="hidden sm:inline">{allVisibleSelected ? 'Deselect' : 'Select'} all</span>
              <span className="font-mono text-[11px] opacity-70">{rows.length}</span>
            </Button>

            <ProfileMenu data={data} />

            <Button
              size="sm"
              variant="ghost"
              className="hidden sm:inline-flex"
              onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
              aria-label="Toggle row density"
              title="Row density"
            >
              {density === 'compact' ? <Rows4 className="size-4" /> : <Rows3 className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <OptionsTable rows={rows} manifest={data.manifest} hasQuery={Boolean(filters.query.trim())} />
        </div>

        <SelectionBar data={data} onExport={() => setExporting(true)} />
      </div>

      {/* filters: docked from `md` up, drawer below */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div
              key="filters-scrim"
              className="absolute inset-0 z-40 bg-black/45 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setFiltersOpen(false)}
              role="presentation"
            />
            <motion.div
              key="filters-drawer"
              className="absolute inset-y-0 left-0 z-50 md:hidden"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            >
              <FilterSidebar data={data} visible={rows} onClose={() => setFiltersOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* detail panel: docked on wide screens, drawer below */}
      <div className="hidden xl:block">
        <DetailPanel data={data} />
      </div>
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="scrim"
              className="absolute inset-0 z-40 bg-black/45 xl:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => select(null)}
              role="presentation"
            />
            <motion.div
              key="drawer"
              className="absolute inset-y-0 right-0 z-50 max-w-full xl:hidden"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            >
              <DetailPanel data={data} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importing && <ImportDialog data={data} onClose={() => setImporting(false)} />}
        {exporting && <ExportDialog data={data} onClose={() => setExporting(false)} />}
      </AnimatePresence>

      {selectedCount > 0 && filters.onlySelected && rows.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 text-center text-[13px] text-faint">
          Your selection is hidden by the other filters.
        </div>
      )}
    </div>
  );
}

/** Adds every flag of a curated profile to the selection in one click. */
function ProfileMenu({ data }: { data: ReturnType<typeof useDataset>['data'] & object }) {
  const [open, setOpen] = useState(false);
  const { addOptions, pivot } = useStore();

  return (
    <div className="relative">
      <Button size="sm" variant={open ? 'primary' : 'outline'} onClick={() => setOpen(!open)}>
        <ShieldPlus className="size-3.5" />
        <span className="hidden sm:inline">Apply profile</span>
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} role="presentation" />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className="surface-card absolute right-0 top-9 z-50 w-80 max-w-[calc(100vw-1.25rem)] overflow-hidden p-1"
            >
              {data.profiles.profiles.map((p) => {
                const usable = p.flags.filter((f) => !f.availableIn || f.availableIn.includes(pivot));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      addOptions(usable.map((f) => ({ flag: f.flag, option: f.option ?? f.flag })));
                      setOpen(false);
                    }}
                    className="flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      {p.name}
                      <span className={clsx('ml-auto font-mono text-[10.5px]', usable.length < p.flags.length ? 'text-warn' : 'text-faint')}>
                        {usable.length}/{p.flags.length} on GCC {pivot}
                      </span>
                    </span>
                    <span className="text-[11.5px] leading-snug text-muted">{p.summary}</span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
