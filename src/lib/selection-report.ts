import type { Dataset } from './dataset';
import type { Docs, OptionRow } from './types';
import { defaultAt, cxxDefaultAt } from './filters';
import { categoryLabel } from './catalog';
import { levelLabel } from './impact';

export interface ReportEntry { flag: string; row?: OptionRow; origin: string; available: boolean; baseline: string | null }
export interface ReportSettings { version: number; language: 'C' | 'C++'; defaults: boolean; packs: boolean; manual: boolean; examples: boolean; query: string }
export const reportCode = (text: string) => {
  const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), m => m[0].length + 1)));
  return `${fence}\n${text}\n${fence}`;
};
export function reportEntries(data: Dataset, selection: Record<string, string>, settings: ReportSettings): ReportEntry[] {
  const bit = 1 << data.manifest.versions.indexOf(settings.version);
  const available = (row: OptionRow) => Boolean(row.m & bit);
  const baseline = (row: OptionRow) => available(row) ? (settings.language === 'C++' ? cxxDefaultAt(row, data.manifest.versions, settings.version) ?? defaultAt(row, data.manifest.versions, settings.version) : defaultAt(row, data.manifest.versions, settings.version)) : null;
  const entries: ReportEntry[] = Object.entries(selection).map(([flag, name]) => {
    const row = data.byName.get(name);
    return { flag, row, origin: 'Explicit selection', available: !!row && available(row), baseline: row ? baseline(row) : null };
  });
  const selectedNames = new Set(Object.values(selection));
  for (const row of data.options) {
    if (selectedNames.has(row.n) || !available(row)) continue;
    const sources: string[] = [];
    if (settings.defaults && baseline(row) === 'enabled') sources.push('Enabled in the compiler baseline');
    if (settings.packs) for (const [pack, effect] of Object.entries(row.pk ?? {})) {
      if (pack.split(/\s+/).every(flag => flag in selection) && (effect.m & bit) && effect.l.includes(settings.language)) sources.push(`Observed effect of ${pack}: ${effect.v}`);
    }
    if (sources.length) entries.push({ flag: row.n, row, origin: sources.join('; '), available: true, baseline: baseline(row) });
  }
  const query = settings.query.trim().toLowerCase();
  return entries.filter(e => !query || `${e.flag} ${e.row?.d ?? ''} ${e.origin}`.toLowerCase().includes(query));
}
export function entryMarkdown(entry: ReportEntry, data: Dataset, docs: Docs, settings: ReportSettings): string {
  const { row } = entry;
  const parts = [reportCode(entry.flag), `**Origin:** ${entry.origin}`, row?.d || 'No catalogue description available.'];
  if (!row) return [...parts, 'This flag is not mapped to a catalogue option; compatibility is unknown.'].join('\n\n');
  const versions = data.manifest.versions.filter((_, i) => row.m & (1 << i));
  parts.push(`**GCC ${settings.version}:** ${entry.available ? 'Listed in the catalogue' : 'Not available in this release'} · **Category:** ${categoryLabel(row.c)}`,
    `**Available releases:** ${versions.join(', ')} (within the extracted GCC 8–15 range).`,
    `**Baseline default (${settings.language}):** ${entry.baseline || 'Not reported'}`);
  if (row.a) parts.push('**Argument syntax:**\n\n' + reportCode(row.n + row.a));
  if (row.al) parts.push('**Alias of:**\n\n' + reportCode(row.al));
  if (row.g) parts.push(`**Target / manual group:** ${row.g}`);
  parts.push(`**Front ends:** ${row.l?.join(', ') || 'No language-specific listing; this is not a compatibility guarantee.'}`);
  const packs = Object.entries(row.pk ?? {}).filter(([, p]) => p.m & (1 << data.manifest.versions.indexOf(settings.version)));
  if (packs.length) parts.push('### Umbrella membership\n\n' + packs.map(([name, p]) => `${reportCode(name)}\n\nObserved value: ${p.v}; front ends: ${p.l.join(', ')}.`).join('\n\n'));
  const reasons = data.profiles.profiles.flatMap(p => p.flags.filter(f => f.flag === entry.flag).map(f => `- **${p.name}:** ${f.why}`));
  if (reasons.length) parts.push('### Why choose it?\n\n' + reasons.join('\n'));
  if (row.im) parts.push(`**Impact (${row.im.s === 'm' ? 'measured / may include curated assertions' : row.im.s === 'c' ? 'curated' : 'derived'}):** build ${levelLabel(row.im.b)}, runtime ${levelLabel(row.im.r)}, size ${levelLabel(row.im.z)}. These ratings are workload-dependent.`, docs.impactNotes?.[row.n] || '');
  if (settings.manual) {
    const doc = docs.docs[row.n];
    parts.push('### Manual\n\n' + (doc ? `Source: GCC ${doc.from}, ${row.s || 'gcc.1'}. ${doc.from !== settings.version ? 'This text is from a different release than the selected compiler.' : ''}\n\n${doc.md}` : 'No full manual entry is available for this spelling.'));
  }
  if (settings.examples) {
    const samples = docs.samples.filter(s => row.ex?.includes(s.id));
    parts.push('### Diagnostic examples\n\n' + (samples.length ? samples.map(s => `**${s.file} (${s.lang})**\n\n${reportCode(s.flags)}\n\n${reportCode(s.source)}\n\nGCC ${settings.version} output:\n\n${reportCode(s.outputs[String(settings.version)] ?? 'No captured output for this release.')}`).join('\n\n') : 'No captured diagnostic example for this option.'));
  }
  return parts.filter(Boolean).join('\n\n');
}
export function reportMarkdown(entries: ReportEntry[], data: Dataset, docs: Docs, settings: ReportSettings) {
  return ['# Selection explained', `GCC ${settings.version} · ${settings.language} · ${entries.length} displayed entries · dataset ${data.manifest.hash}`, `Baseline: ${data.manifest.releases.find(r => r.v === settings.version)?.target}. Defaults ${settings.defaults ? 'shown' : 'hidden'}; umbrella effects ${settings.packs ? 'shown' : 'hidden'}. Search: ${settings.query || '(none)'}.`,
    'Explicit choices are preserved, including unsupported flags. Baseline defaults and observed umbrella effects are reference information, not an effective command-line simulation. Overrides, ordering, argument validity, target and library requirements must be checked with the actual toolchain. Manual text may come from a newer release. GCC documentation remains under its upstream licence.',
    ...entries.map((e, i) => `## ${i + 1}. Option\n\n${entryMarkdown(e, data, docs, settings)}`)].join('\n\n');
}
