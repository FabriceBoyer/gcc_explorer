import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { BookOpen, GitCompareArrows, Home, Moon, Search, Sun, Table2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useDataset } from '../lib/dataset-context';
import { Badge } from './ui';

const LINKS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/explorer', label: 'Explorer', icon: Table2 },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows },
  { to: '/docs', label: 'Docs', icon: BookOpen },
];

export function TopBar() {
  const { theme, toggleTheme, selection } = useStore();
  const { data } = useDataset();
  const { pathname } = useLocation();
  const count = Object.keys(selection).length;

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/80 px-3 backdrop-blur-xl sm:px-4">
      <NavLink to="/" className="group flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-[9px] bg-accent font-mono text-[13px] font-bold text-white shadow-sm transition-transform group-hover:scale-105">
          -f
        </span>
        <span className="hidden flex-col leading-none sm:flex">
          <span className="text-[15px] font-semibold tracking-tight">GCC Explorer</span>
          <span className="text-[10.5px] text-faint">
            {data ? `${data.manifest.counts.options.toLocaleString()} options · GCC ${data.manifest.versions[0]}–${data.manifest.versions.at(-1)}` : 'loading dataset…'}
          </span>
        </span>
      </NavLink>

      <nav className="ml-2 flex items-center gap-0.5 rounded-xl border border-line bg-bg-alt p-0.5">
        {LINKS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={clsx(
                'relative flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-medium transition-colors sm:px-3',
                active ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-[9px] bg-surface shadow-sm"
                  transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                />
              )}
              <Icon className="relative size-3.5" />
              <span className="relative hidden sm:inline">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        {count > 0 && (
          <NavLink to="/explorer" className="hidden sm:block">
            <Badge tone="accent" title={`${count} flags selected`}>
              {count} selected
            </Badge>
          </NavLink>
        )}
        <NavLink
          to="/explorer"
          className="flex h-8 items-center gap-2 rounded-lg border border-line bg-bg-alt px-2.5 text-[13px] text-faint transition-colors hover:text-ink sm:w-44"
          title="Search options"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Search options…</span>
        </NavLink>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="grid size-8 place-items-center rounded-lg border border-line bg-bg-alt text-muted transition-colors hover:text-ink"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
    </header>
  );
}
