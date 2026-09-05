/** Filtering, searching and sorting over the option table. */
import type { Filters } from './store';
import type { Manifest, OptionRow } from './types';
import { versionBit } from './dataset';

/**
 * Score a row against a query. Higher is better, 0 means "no match".
 *
 * The ranking is deliberately simple and predictable: an exact name wins, then
 * a name prefix, then a name substring, then the description. Typing `-Wsh`
 * should put `-Wshadow` first, not some parameter whose help text happens to
 * contain the word "shadow".
 */
export function score(row: OptionRow, needle: string): number {
  const name = row.n.toLowerCase();
  if (name === needle) return 1000;
  if (name.startsWith(needle)) return 800 - name.length;
  const at = name.indexOf(needle);
  if (at >= 0) return 600 - at - name.length / 100;
  if (row.d.toLowerCase().includes(needle)) return 200;
  return 0;
}

/** Splits a query into terms; every term must match somewhere. */
function terms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export interface FilterContext {
  manifest: Manifest;
  /** Names of the options that have at least one flag in the selection. */
  selected: Set<string>;
}

export function defaultAt(row: OptionRow, versions: number[], version: number): string | null {
  const v = row.v;
  if (v === undefined) return null;
  if (typeof v === 'string') return v;
  const i = versions.indexOf(version);
  return i < 0 ? null : (v[i] ?? null);
}

export function cxxDefaultAt(row: OptionRow, versions: number[], version: number): string | null {
  const v = row.vx;
  if (v === undefined) return null;
  if (typeof v === 'string') return v;
  const i = versions.indexOf(version);
  return i < 0 ? null : (v[i] ?? null);
}

/** Does the option's default vary across the releases that have it? */
export function defaultVaries(row: OptionRow): boolean {
  return Array.isArray(row.v) && new Set(row.v.filter((x) => x !== null)).size > 1;
}

export function filterOptions(
  rows: OptionRow[],
  f: Filters,
  { manifest, selected }: FilterContext,
): OptionRow[] {
  const versions = manifest.versions;
  const words = terms(f.query);
  const wantedMask = f.versions.reduce((m, v) => m | versionBit(versions, v), 0);
  const cats = new Set(f.categories);
  const langs = new Set(f.languages);
  const profiles = new Set(f.profiles);

  const out: { row: OptionRow; s: number }[] = [];

  for (const row of rows) {
    if (!f.includeTarget && !f.archGroup && row.c === 'target' && row.g) continue;
    if (f.archGroup && row.g !== f.archGroup) continue;
    if (!f.includeUndocumented && row.u) continue;
    if (!f.includeAliases && row.al) continue;
    if (f.onlyDocumented && !row.doc) continue;
    if (f.onlyWithSamples && !row.ex) continue;
    if (f.onlyMeasured && row.im.s !== 'm') continue;
    if (f.buildImpact.length && !f.buildImpact.includes(row.im.b ?? 99)) continue;
    if (f.runtimeImpact.length && !f.runtimeImpact.includes(row.im.r ?? 99)) continue;
    if (f.onlySelected && !selected.has(row.n)) continue;
    if (cats.size && !cats.has(row.c)) continue;

    if (wantedMask) {
      if (f.versionMode === 'any' && !(row.m & wantedMask)) continue;
      if (f.versionMode === 'all' && (row.m & wantedMask) !== wantedMask) continue;
      if (f.versionMode === 'only' && row.m !== wantedMask) continue;
    }

    if (f.packs.length && !f.packs.every((p) => row.pk && p in row.pk)) continue;
    if (profiles.size && !row.profiles.some((p) => profiles.has(p))) continue;
    if (langs.size && !(row.l ?? []).some((l) => langs.has(l))) continue;

    if (f.defaultState !== 'any') {
      const values = typeof row.v === 'string' ? [row.v] : (row.v ?? []);
      const set = new Set(values.filter((x): x is string => typeof x === 'string'));
      if (f.defaultState === 'enabled' && !set.has('enabled')) continue;
      if (f.defaultState === 'disabled' && !set.has('disabled')) continue;
      if (f.defaultState === 'value') {
        const hasPlainValue = [...set].some((x) => x && x !== 'enabled' && x !== 'disabled');
        if (!hasPlainValue) continue;
      }
    }

    let s = 1;
    if (words.length) {
      let total = 0;
      for (const w of words) {
        const partial = score(row, w);
        if (!partial) { total = 0; break; }
        total += partial;
      }
      if (!total) continue;
      s = total;
    }
    out.push({ row, s });
  }

  if (words.length) out.sort((a, b) => b.s - a.s || a.row.n.localeCompare(b.row.n));
  return out.map((x) => x.row);
}
