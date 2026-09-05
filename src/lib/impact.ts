/** Presentation of the build / runtime / size impact scores. */
import type { Impact } from './types';

export type Axis = 'b' | 'r' | 'z';

export const AXIS_LABEL: Record<Axis, string> = {
  b: 'Build time',
  r: 'Runtime',
  z: 'Binary size',
};

export const LEVELS = [
  { score: -1, label: 'improves', short: '↓', tone: 'ok' as const },
  { score: 0, label: 'negligible', short: 'none', tone: 'neutral' as const },
  { score: 1, label: 'low', short: 'low', tone: 'neutral' as const },
  { score: 2, label: 'moderate', short: 'med', tone: 'warn' as const },
  { score: 3, label: 'high', short: 'high', tone: 'danger' as const },
];

export function levelLabel(score: number | null): string {
  if (score === null) return 'varies';
  return LEVELS.find((l) => l.score === score)?.label ?? 'varies';
}

export const SOURCE_LABEL: Record<Impact['s'], string> = {
  m: 'measured',
  c: 'curated',
  d: 'derived',
};

export const SOURCE_EXPLAINER: Record<Impact['s'], string> = {
  m: 'Measured: the flag was actually compiled and run against a benchmark inside this release’s own container.',
  c: 'Curated: a well established cost that a single generic benchmark cannot show, written down by hand with its rationale.',
  d: 'Derived: what the option’s category makes certain — a pure diagnostic cannot change the generated code.',
};

/**
 * Sort key for an axis. `null` (varies) sorts after every known score, and
 * "improves" sorts before "negligible", so ascending order reads as
 * cheapest-first.
 */
export function sortKey(score: number | null): number {
  return score === null ? 99 : score;
}

/** A ratio like 3.34 rendered as `3.3×`, or `−12%` when it is close to 1. */
export function formatRatio(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  if (ratio >= 1.6 || ratio <= 0.625) return `${ratio.toFixed(1)}×`;
  const pct = (ratio - 1) * 100;
  const rounded = Math.abs(pct) < 1 ? pct.toFixed(1) : Math.round(pct).toString();
  return `${pct >= 0 ? '+' : '−'}${rounded.replace('-', '')}%`;
}
