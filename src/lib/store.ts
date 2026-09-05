/**
 * Application state.
 *
 * Two slices are persisted to `localStorage`: the flag selection (so a refresh
 * never loses a build recipe someone has been assembling) and the display
 * preferences. Everything else is transient.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Category } from './types';

export type DefaultFilter = 'any' | 'enabled' | 'disabled' | 'value';
export type VersionMode = 'any' | 'all' | 'only';
export type Density = 'comfortable' | 'compact';

export interface Filters {
  query: string;
  versions: number[];
  versionMode: VersionMode;
  categories: Category[];
  packs: string[];
  profiles: string[];
  languages: string[];
  defaultState: DefaultFilter;
  archGroup: string | null;
  includeTarget: boolean;
  includeUndocumented: boolean;
  includeAliases: boolean;
  onlyDocumented: boolean;
  onlySelected: boolean;
  onlyWithSamples: boolean;
}

export const emptyFilters: Filters = {
  query: '',
  versions: [],
  versionMode: 'any',
  categories: [],
  packs: [],
  profiles: [],
  languages: [],
  defaultState: 'any',
  archGroup: null,
  includeTarget: false,
  includeUndocumented: false,
  includeAliases: false,
  onlyDocumented: false,
  onlySelected: false,
  onlyWithSamples: false,
};

/** How many filters are away from their default value. */
export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.query.trim()) n += 1;
  n += f.versions.length ? 1 : 0;
  n += f.categories.length ? 1 : 0;
  n += f.packs.length ? 1 : 0;
  n += f.profiles.length ? 1 : 0;
  n += f.languages.length ? 1 : 0;
  if (f.defaultState !== 'any') n += 1;
  if (f.archGroup) n += 1;
  if (f.includeTarget) n += 1;
  if (f.includeUndocumented) n += 1;
  if (f.includeAliases) n += 1;
  if (f.onlyDocumented) n += 1;
  if (f.onlySelected) n += 1;
  if (f.onlyWithSamples) n += 1;
  return n;
}

interface UiState {
  theme: 'light' | 'dark';
  density: Density;
  /** Release used for the "Default" column and the detail panel. */
  pivot: number;
  filters: Filters;
  /**
   * The flag selection, keyed by the full flag text and valued by the
   * canonical option it belongs to. Keying by the flag rather than by the
   * option is what keeps `-Wl,-z,relro` and `-Wl,-z,now` as two entries
   * instead of one overwriting the other.
   */
  selection: Record<string, string>;
  selected: string | null;
  panelOpen: boolean;
  sidebarOpen: boolean;

  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setDensity: (d: Density) => void;
  setPivot: (v: number) => void;

  patchFilters: (p: Partial<Filters>) => void;
  toggleIn: <K extends 'categories' | 'packs' | 'profiles' | 'languages'>(key: K, value: string) => void;
  toggleVersion: (v: number) => void;
  resetFilters: () => void;

  select: (name: string | null) => void;
  setPanelOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;

  /** Adds the option, or removes every flag that belongs to it. */
  toggleOption: (name: string, value?: string) => void;
  addOptions: (flags: { flag: string; option: string }[]) => void;
  removeOptions: (names: string[]) => void;
  removeFlag: (flag: string) => void;
  setOptionValue: (name: string, value: string) => void;
  clearSelection: () => void;
}

export const useStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      density: 'comfortable',
      pivot: 15,
      filters: emptyFilters,
      selection: {},
      selected: null,
      panelOpen: false,
      sidebarOpen: true,

      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        try { localStorage.setItem('gccx.theme', theme); } catch { /* private mode */ }
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
      setDensity: (density) => set({ density }),
      setPivot: (pivot) => set({ pivot }),

      patchFilters: (p) => set((s) => ({ filters: { ...s.filters, ...p } })),
      toggleIn: (key, value) => set((s) => {
        const list = s.filters[key] as string[];
        const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
        return { filters: { ...s.filters, [key]: next } };
      }),
      toggleVersion: (v) => set((s) => {
        const list = s.filters.versions;
        const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => a - b);
        return { filters: { ...s.filters, versions: next } };
      }),
      resetFilters: () => set({ filters: emptyFilters }),

      select: (selected) => set({ selected, panelOpen: selected !== null }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      toggleOption: (name, value = '') => set((s) => {
        const owned = Object.entries(s.selection).filter(([, opt]) => opt === name);
        if (owned.length) {
          const next = { ...s.selection };
          for (const [flag] of owned) delete next[flag];
          return { selection: next };
        }
        return { selection: { ...s.selection, [`${name}${value}`]: name } };
      }),
      addOptions: (flags) => set((s) => ({
        selection: { ...s.selection, ...Object.fromEntries(flags.map((f) => [f.flag, f.option])) },
      })),
      removeOptions: (names) => set((s) => {
        const drop = new Set(names);
        return {
          selection: Object.fromEntries(
            Object.entries(s.selection).filter(([, opt]) => !drop.has(opt)),
          ),
        };
      }),
      removeFlag: (flag) => set((s) => {
        const next = { ...s.selection };
        delete next[flag];
        return { selection: next };
      }),
      setOptionValue: (name, value) => set((s) => {
        const next = Object.fromEntries(Object.entries(s.selection).filter(([, opt]) => opt !== name));
        next[`${name}${value}`] = name;
        return { selection: next };
      }),
      clearSelection: () => set({ selection: {} }),
    }),
    {
      name: 'gccx.state',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        theme: s.theme,
        density: s.density,
        pivot: s.pivot,
        selection: s.selection,
        filters: s.filters,
        sidebarOpen: s.sidebarOpen,
      }),
    },
  ),
);

/** The set of option names that have at least one flag in the selection. */
export function selectedOptionNames(selection: Record<string, string>): Set<string> {
  return new Set(Object.values(selection));
}
