/** Presentation metadata for the option categories and manual sections. */
import type { Category } from './types';

export interface CategoryMeta {
  id: Category;
  label: string;
  /** Which build phase the option acts on — the compile / link split. */
  stage: 'compile' | 'link' | 'preprocess' | 'both';
  hue: string;
  blurb: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'warnings', label: 'Warnings', stage: 'compile', hue: '70', blurb: 'Diagnostics GCC can emit about your code.' },
  { id: 'optimization', label: 'Optimization', stage: 'compile', hue: '150', blurb: 'Passes and heuristics that shape the generated code.' },
  { id: 'codegen', label: 'Code generation', stage: 'compile', hue: '190', blurb: 'ABI and calling-convention level conventions.' },
  { id: 'instrumentation', label: 'Instrumentation', stage: 'compile', hue: '20', blurb: 'Sanitizers, coverage, stack protection.' },
  { id: 'analyzer', label: 'Static analysis', stage: 'compile', hue: '300', blurb: 'The -fanalyzer engine and diagnostic paths.' },
  { id: 'dialect', label: 'Language dialect', stage: 'compile', hue: '265', blurb: 'Standards, extensions and front-end behaviour.' },
  { id: 'debug', label: 'Debug info', stage: 'compile', hue: '250', blurb: 'DWARF level, split debug, symbol detail.' },
  { id: 'link', label: 'Linking', stage: 'link', hue: '35', blurb: 'What the driver hands over to the linker.' },
  { id: 'directory', label: 'Directory search', stage: 'both', hue: '55', blurb: 'Where headers, libraries and startup files are found.' },
  { id: 'preprocessor', label: 'Preprocessor', stage: 'preprocess', hue: '330', blurb: 'Macros, includes and dependency generation.' },
  { id: 'assembler', label: 'Assembler', stage: 'compile', hue: '15', blurb: 'Options forwarded to the assembler.' },
  { id: 'target', label: 'Target / machine', stage: 'compile', hue: '210', blurb: 'Architecture specific tuning and features.' },
  { id: 'param', label: 'Tuning parameters', stage: 'compile', hue: '170', blurb: '--param knobs for the optimiser heuristics.' },
  { id: 'diagnostics', label: 'Diagnostic format', stage: 'compile', hue: '95', blurb: 'How messages are printed, coloured and grouped.' },
  { id: 'output', label: 'Output control', stage: 'both', hue: '280', blurb: 'What the driver produces and where it stops.' },
  { id: 'developer', label: 'GCC developer', stage: 'compile', hue: '230', blurb: 'Dumps and internals, aimed at GCC hackers.' },
  { id: 'other', label: 'Other', stage: 'both', hue: '265', blurb: 'Aliases and legacy spellings.' },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryLabel(id: string): string {
  return CATEGORY_BY_ID.get(id as Category)?.label ?? id;
}

/** A stable colour per category, derived from its hue. */
export function categoryStyle(id: string, dark: boolean): { color: string; background: string; borderColor: string } {
  const hue = CATEGORY_BY_ID.get(id as Category)?.hue ?? '265';
  return dark
    ? {
      color: `oklch(83% 0.12 ${hue})`,
      background: `oklch(30% 0.055 ${hue})`,
      borderColor: `oklch(40% 0.07 ${hue})`,
    }
    : {
      color: `oklch(42% 0.15 ${hue})`,
      background: `oklch(95.5% 0.035 ${hue})`,
      borderColor: `oklch(88% 0.05 ${hue})`,
    };
}

export const STAGE_LABEL: Record<string, string> = {
  compile: 'Compile',
  link: 'Link',
  preprocess: 'Preprocess',
  both: 'Compile + link',
};
