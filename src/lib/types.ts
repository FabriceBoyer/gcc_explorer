/** Shapes of the JSON files produced by `tools/build-dataset.mjs`. */

export type Category =
  | 'warnings' | 'optimization' | 'target' | 'param' | 'dialect' | 'analyzer'
  | 'instrumentation' | 'debug' | 'codegen' | 'link' | 'developer'
  | 'diagnostics' | 'preprocessor' | 'directory' | 'output' | 'assembler'
  | 'other';

/** How an umbrella flag (`-Wall`, `-O2`, …) affects one option. */
export interface PackEffect {
  /** Bit mask of the releases where the umbrella flag has this effect. */
  m: number;
  /** Value the umbrella flag sets (`enabled`, `2`, …). */
  v: string;
  /** Front ends it was observed on: `C`, `C++`. */
  l: string[];
}

/** One option, as stored in `options.json` (keys are short to keep it small). */
export interface RawOption {
  n: string;                 // canonical name, e.g. "-Wshadow"
  c: Category;               // category
  m: number;                 // bit mask of releases that have it
  d: string;                 // short description
  a?: string;                // argument syntax, e.g. "<number>"
  v?: string | (string | null)[];  // default value(s), aligned on `versions`
  vx?: string | (string | null)[]; // default value(s) under g++, when different
  al?: string;               // this option is an alias of …
  u?: 1;                     // undocumented (only in `--help=…,undocumented`)
  l?: string[];              // front ends that list it specifically
  k?: string[];              // `--help` classes it belongs to
  s?: string;                // manual section
  g?: string;                // manual sub-group (an architecture, usually)
  src?: 'man';               // only known from the manual, not from `--help`
  doc?: 1;                   // has a long description in docs.json
  p?: { default: string; min?: string; max?: string };  // --param bounds
  pk?: Record<string, PackEffect>;                      // umbrella membership
  ex?: string[];             // ids of diagnostic samples
  im: Impact;                // build / runtime / size impact
  bm?: string[];             // benchmarked flags that inform `im`
}

/**
 * Cost of an option, scored -1 (improves) · 0 (negligible) · 1 (low) ·
 * 2 (moderate) · 3 (high), or null when it genuinely varies.
 */
export interface Impact {
  /** Build time. */
  b: number | null;
  /** Runtime. */
  r: number | null;
  /** Binary size. */
  z: number | null;
  /** Where the score comes from: measured · curated · derived. */
  s: 'm' | 'c' | 'd';
}

/** One benchmarked flag, with its per-release ratios against the baseline. */
export interface Benchmark {
  versions: Record<string, {
    status: string;
    b: number | null;
    r: number | null;
    z: number | null;
  }>;
  score: { b: number | null; r: number | null; z: number | null };
}

export interface Release {
  v: number;
  full: string;
  banner: string;
  target: string;
  extractedAt: string;
  optionCount: number;
  benchmarked: number;
}

export interface Manifest {
  schema: number;
  generatedAt: string;
  versions: number[];
  releases: Release[];
  packs: { flags: string; m: number; count: number }[];
  categories: Record<string, number>;
  languages: string[];
  archGroups: string[];
  manSections: string[];
  counts: {
    options: number;
    documented: number;
    samples: number;
    benchmarked: number;
    impactMeasured: number;
    impactCurated: number;
    impactKnown: number;
  };
  impactScale: Record<string, string>;
  /** Spread of a baseline measured against itself, in percent. */
  benchNoise: {
    build: { typical: number; worst: number } | null;
    runtime: { typical: number; worst: number } | null;
    size: { typical: number; worst: number } | null;
  } | null;
  files: Record<string, number>;
  hash: string;
}

export interface Sample {
  id: string;
  file: string;
  lang: string;
  flags: string;
  source: string;
  /** Compiler output keyed by major version. */
  outputs: Record<string, string>;
  options: string[];
}

export interface Docs {
  docs: Record<string, { md: string; from: number }>;
  samples: Sample[];
  impactNotes: Record<string, string>;
  benchmarks: Record<string, Benchmark>;
}

export interface ProfileFlag {
  flag: string;
  option?: string;
  stage: 'compile' | 'link' | 'both' | 'preprocess';
  why: string;
  known?: boolean;
  availableIn?: number[];
}

export interface Profile {
  id: string;
  name: string;
  icon: string;
  kind: 'hardening' | 'diagnostics' | 'testing' | 'build';
  accent: string;
  summary: string;
  description: string;
  flags: ProfileFlag[];
}

export interface ProfileFile {
  version: number;
  note: string;
  references: { label: string; url: string }[];
  profiles: Profile[];
}

/** An option enriched with everything the UI needs, computed once at load. */
export interface OptionRow extends RawOption {
  /** First release that has the option. */
  since: number;
  /** Last release that has the option. */
  until: number;
  /** `8 → 15`, or `8 → 12` for a removed option. */
  range: string;
  /** Lower-cased name, for search. */
  search: string;
  /** Umbrella flags this option belongs to, as a plain list. */
  packNames: string[];
  /** Profile ids this option is part of. */
  profiles: string[];
}
