/**
 * Build time / runtime / binary size impact, per option.
 *
 * Three layers, most specific first:
 *
 *   measured  tools/extract/bench actually compiled and ran a benchmark with
 *             and without the flag, inside that release's own container.
 *   curated   tools/data/impact.json — costs that are well established but
 *             that a single generic benchmark cannot show.
 *   derived   what the option's category makes certain. A pure diagnostic
 *             cannot change the generated code, so its runtime cost is zero;
 *             that covers several hundred options for free.
 *
 * Scores are -1 (improves) · 0 (negligible) · 1 (low) · 2 (moderate) ·
 * 3 (high), or null for "varies / not established".
 */

/** Parses one `results.tsv` into `Map<flag, {status, build, size, run}>`. */
export function parseBenchResults(tsv) {
  const rows = new Map();
  for (const line of tsv.split('\n')) {
    if (!line.trim()) continue;
    const [flag, status, build, size, run, baseBuild, baseSize, baseRun] = line.split('\t');
    const num = (x) => (x ? Number(x) : null);
    rows.set(flag, {
      status,
      build: num(build),
      size: num(size),
      run: num(run),
      // Each row carries the baseline measured immediately before it.
      baseBuild: num(baseBuild),
      baseSize: num(baseSize),
      baseRun: num(baseRun),
    });
  }
  return rows;
}

/** Turns a ratio against the baseline into a score, using the configured cuts. */
export function scoreRatio(ratio, cuts) {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  const [better, none, low, moderate] = cuts;
  if (ratio < better) return -1;
  if (ratio < none) return 0;
  if (ratio < low) return 1;
  if (ratio < moderate) return 2;
  return 3;
}

/**
 * Per-release ratios for every benchmarked flag.
 *
 * Every row was measured against a baseline taken immediately before it, so
 * the ratio is free of drift over the run.
 *
 * @returns Map<flag, { [version]: {b, r, z, status} }>
 */
export function benchRatios(perVersionResults) {
  const out = new Map();
  for (const [version, rows] of perVersionResults) {
    for (const [flag, row] of rows) {
      const entry = out.get(flag) ?? {};
      entry[version] = {
        status: row.status,
        b: row.build && row.baseBuild ? row.build / row.baseBuild : null,
        r: row.run && row.baseRun ? row.run / row.baseRun : null,
        z: row.size && row.baseSize ? row.size / row.baseSize : null,
      };
      out.set(flag, entry);
    }
  }
  return out;
}

/**
 * Collapses a flag's per-release ratios into one score triple.
 *
 * The median across releases is used rather than the newest one: it keeps a
 * single noisy run on one release from deciding the rating.
 */
export function summariseFlag(byVersion, thresholds) {
  // Filter per value, not per row: a configuration that compiled but failed to
  // link still produced a usable build-time number.
  const pick = (key) => {
    const values = Object.values(byVersion)
      .filter((v) => typeof v[key] === 'number' && Number.isFinite(v[key]))
      .map((v) => v[key])
      .sort((a, b) => a - b);
    if (!values.length) return null;
    return values[Math.floor(values.length / 2)];
  };
  return {
    b: scoreRatio(pick('b'), thresholds.build),
    r: scoreRatio(pick('r'), thresholds.runtime),
    z: scoreRatio(pick('z'), thresholds.size),
    ratios: { b: pick('b'), r: pick('r'), z: pick('z') },
  };
}

/** Categories whose options provably cannot change the generated code. */
const DIAGNOSTIC_ONLY = new Set(['warnings', 'diagnostics']);
const NO_CODEGEN = new Set(['preprocessor', 'directory', 'output']);

const DERIVED_NOTES = {
  diagnostic: 'A diagnostic: it changes what the compiler tells you, never what it generates. No runtime or size cost, and a negligible build cost.',
  nocodegen: 'Controls the driver, the preprocessor or where files are looked up. It does not change the instructions that end up in the binary.',
  developer: 'A GCC developer option: it produces dumps or internal reports during compilation and does not change the generated code.',
};

/**
 * Facts that follow from the option's category alone.
 *
 * These are assertions, not guesses, so they outrank a measurement for the
 * axes they cover: a warning cannot change the instructions the compiler
 * emits, and no stopwatch reading may claim otherwise. Build time is left
 * open, because a diagnostic really can cost compile time.
 */
function categoryFacts(cat) {
  // `assert` is certain and beats a measurement; `fallback` is only used when
  // nothing better exists, so a benchmarked diagnostic still reports the
  // compile time we actually measured for it.
  if (DIAGNOSTIC_ONLY.has(cat)) {
    return { assert: { runtime: 0, size: 0 }, fallback: { build: 0 }, note: DERIVED_NOTES.diagnostic };
  }
  if (NO_CODEGEN.has(cat)) {
    return { assert: { runtime: 0, size: 0 }, fallback: { build: 0 }, note: DERIVED_NOTES.nocodegen };
  }
  if (cat === 'developer') {
    return { assert: { runtime: 0, size: 0 }, fallback: { build: 1 }, note: DERIVED_NOTES.developer };
  }
  return null;
}

/**
 * Resolves one option's impact.
 *
 * Precedence, per axis: an explicit per-option entry, then a rule, then what
 * the category makes certain, then the measurement, then "varies".
 *
 * @param option     the merged option record (needs `name` and `cat`)
 * @param measured   score triple from the benchmark, or null
 * @param table      the parsed tools/data/impact.json
 */
export function resolveImpact(option, measured, table) {
  const perOption = table.options[option.name];
  const rule = table.rules.find((r) => new RegExp(r.match).test(option.name));
  const facts = categoryFacts(option.cat);
  const note = perOption?.note ?? rule?.note ?? facts?.note;

  // A per-option entry refines the rule rather than replacing it, so an option
  // can assert just its runtime and leave build time to the measurement.
  const curated = { ...facts?.assert, ...rule, ...perOption };
  const fallback = facts?.fallback ?? {};
  const stated = (key) => (curated[key] !== undefined ? curated[key] : undefined);

  const hasMeasurement = measured
    && (measured.b !== null || measured.r !== null || measured.z !== null);

  const asserted = ['build', 'runtime', 'size'].some((k) => stated(k) !== undefined);
  if (!hasMeasurement && !asserted && !facts) {
    return { b: null, r: null, z: null, s: 'derived', n: note };
  }

  if (hasMeasurement || asserted) {
    const pick = (key, m) => {
      const c = stated(key);
      if (c !== undefined) return c;
      if (hasMeasurement && m !== null) return m;
      return fallback[key] ?? null;
    };
    const b = pick('build', measured?.b ?? null);
    const r = pick('runtime', measured?.r ?? null);
    const z = pick('size', measured?.z ?? null);

    const fromMeasurement = hasMeasurement
      && [['build', 'b'], ['runtime', 'r'], ['size', 'z']]
        .some(([c, m]) => stated(c) === undefined && measured[m] !== null);

    return { b, r, z, s: fromMeasurement ? 'measured' : 'curated', n: note };
  }

  if (facts) {
    return {
      b: fallback.build ?? null, r: facts.assert.runtime, z: facts.assert.size, s: 'derived', n: note,
    };
  }

  // Genuinely unknown — say so rather than guessing.
  return { b: null, r: null, z: null, s: 'derived', n: note };
}
