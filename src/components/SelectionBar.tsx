import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCheck, Share2, Trash2, X } from 'lucide-react';
import type { Dataset } from '../lib/dataset';
import { useStore } from '../lib/store';
import { flagStage, splitFlags } from '../lib/export';
import { useSelectedFlags } from './ExportDialog';
import { Badge, Button } from './ui';

export function SelectionBar({ data, onExport }: { data: Dataset; onExport: () => void }) {
  const { clearSelection, removeFlag, patchFilters, filters } = useStore();
  const flags = useSelectedFlags(data);
  const split = splitFlags(flags);

  return (
    <AnimatePresence>
      {flags.length > 0 && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          className="z-20 flex shrink-0 items-center gap-3 border-t border-line bg-surface px-3 py-2 shadow-panel"
        >
          <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium">
            <CheckCheck className="size-4 text-ok" />
            {flags.length} selected
          </span>
          <Badge tone="accent" className="hidden sm:inline-flex">{split.compile.length} compile</Badge>
          <Badge tone="warn" className="hidden sm:inline-flex">{split.link.length} link</Badge>

          <div className="hide-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {flags.slice(0, 40).map((f) => (
              <button
                key={f.flag}
                type="button"
                onClick={() => removeFlag(f.flag)}
                title="Remove from selection"
                className="group flex shrink-0 items-center gap-1 rounded-md border border-line bg-bg-alt px-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-danger hover:text-danger"
              >
                {flagStage(f.flag, f.row) === 'link' && <span className="text-warn">⇥</span>}
                {f.flag}
                <X className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
            {flags.length > 40 && <span className="shrink-0 text-[11px] text-faint">+{flags.length - 40} more</span>}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Link to="/selection" className="rounded-lg border px-2 py-1 text-xs text-accent-text">Explain</Link>
            <Button
              size="sm"
              className="hidden md:inline-flex"
              variant={filters.onlySelected ? 'primary' : 'outline'}
              onClick={() => patchFilters({ onlySelected: !filters.onlySelected })}
            >
              {filters.onlySelected ? 'Showing selection' : 'Show only selection'}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="text-danger">
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
            <Button size="sm" variant="primary" onClick={onExport}>
              <Share2 className="size-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
