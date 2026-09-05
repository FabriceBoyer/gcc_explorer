#!/usr/bin/env node
/**
 * Turns the raw GCC dumps under data/raw/<major>/ into the JSON dataset the web
 * app consumes (public/data/).
 *
 *   manifest.json   dataset metadata: versions, packs, categories, counts
 *   options.json    one compact record per option (the table)
 *   docs.json       long man page descriptions + diagnostic samples (lazy)
 *   profiles.json   curated hardening / diagnostics profiles
 *
 * Everything here is derived from GCC itself: `gcc --help`, `gcc -Q --help`,
 * the installed `gcc.1` man page and real compiler output for sample programs.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseHelpDump, parseStateDump, parseLegacyParams } from './lib/parse-help.mjs';
import { parseManPage, blocksToMarkdown, manKeys, manPrimary } from './lib/roff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'public', 'data');

const CLASSES = ['common', 'optimizers', 'warnings', 'target', 'params'];
const LANG_DUMPS = {
  c: 'C', cpp: 'C++', objc: 'Objective-C', objcpp: 'Objective-C++',
  fortran: 'Fortran', ada: 'Ada', go: 'Go', d: 'D',
};

// --- helpers ----------------------------------------------------------------

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const dirs = (p) => (fs.existsSync(p) ? fs.readdirSync(p) : []);

/**
 * Splits a help token into its canonical option name and its argument syntax:
 * `-Walloca-larger-than=<number>` -> [`-Walloca-larger-than=`, `<number>`]
 */
export function splitName(token) {
  const m = /[<[{ ]/.exec(token);
  if (!m) return [token, ''];
  return [token.slice(0, m.index).trim(), token.slice(m.index).trim()];
}

const LANG_ALIASES = { ObjC: 'Objective-C', 'ObjC++': 'Objective-C++' };

/**
 * Normalises a `-Q --help` value.
 *
 * `[available in C++, ObjC++]` means "this driver's front end does not accept
 * the option at all"; it is turned into `n/a:<languages>` so the UI can show
 * that instead of a bogus default.
 */
function normValue(v) {
  if (v === undefined || v === null) return null;
  const s = v.trim();
  if (s === '[enabled]') return 'enabled';
  if (s === '[disabled]') return 'disabled';
  if (s === '') return '';
  const avail = /^\[available in (.+)\]$/.exec(s);
  if (avail) {
    const langs = avail[1].split(/,\s*/).map((l) => LANG_ALIASES[l] ?? l);
    return `n/a:${langs.join(',')}`;
  }
  return s;
}

const CATEGORY_BY_SUBSECTION = [
  [/Kind of Output/i, 'output'],
  [/Diagnostic Messages Formatting/i, 'diagnostics'],
  [/Request or Suppress Warnings/i, 'warnings'],
  [/Static Analysis/i, 'analyzer'],
  [/Debugging Your Program/i, 'debug'],
  [/Control Optimization/i, 'optimization'],
  [/Program Instrumentation/i, 'instrumentation'],
  [/Controlling the Preprocessor/i, 'preprocessor'],
  [/Assembler/i, 'assembler'],
  [/for Linking/i, 'link'],
  [/Directory Search/i, 'directory'],
  [/Code Generation Conventions/i, 'codegen'],
  [/Developer Options/i, 'developer'],
  [/Machine-Dependent/i, 'target'],
  [/Dialect|OpenMP|OpenACC|Compiling/i, 'dialect'],
];

const LINK_NAMES = new Set([
  '-shared', '-static', '-pie', '-no-pie', '-rdynamic', '-symbolic', '-s',
  '-nostdlib', '-nodefaultlibs', '-nostartfiles', '-nolibc', '-pthread',
  '-shared-libgcc', '-static-libgcc', '-static-libstdc++', '-static-libgo',
  '-static-libasan', '-static-libtsan', '-static-libubsan', '-static-liblsan',
  '-static-pie', '-r', '-e', '-u', '-z', '-T', '-Xlinker', '-Wl,', '-l', '-L',
  '-fuse-ld=', '-flinker-output=',
]);

function deriveCategory({ name, manSubsection, classes }) {
  if (manSubsection) {
    for (const [re, cat] of CATEGORY_BY_SUBSECTION) if (re.test(manSubsection)) return cat;
  }
  if (name.startsWith('--param')) return 'param';
  if (LINK_NAMES.has(name) || name.startsWith('-Wl,') || name.startsWith('-Xlinker')) return 'link';
  if (name.startsWith('-W')) return 'warnings';
  if (name.startsWith('-fanalyzer') || name.startsWith('-fdiagnostics')) return 'analyzer';
  if (name.startsWith('-fsanitize') || name.startsWith('-fstack-protector')) return 'instrumentation';
  if (classes.includes('target') || /^-m/.test(name)) return 'target';
  if (classes.includes('optimizers') || /^-O/.test(name)) return 'optimization';
  if (/^-g/.test(name)) return 'debug';
  if (/^(-D|-U|-E|-M|-include|-imacros|-idirafter|-iquote|-C|-P|-A)/.test(name)) return 'preprocessor';
  if (/^(-I|-B|-isystem|-iprefix|-iwithprefix|-sysroot|--sysroot)/.test(name)) return 'directory';
  if (/^-std|^-ansi|^-x /.test(name)) return 'dialect';
  return 'other';
}

// --- load raw dumps ---------------------------------------------------------

const versions = dirs(RAW)
  .filter((d) => /^\d+$/.test(d) && fs.statSync(path.join(RAW, d)).isDirectory())
  .map(Number)
  .sort((a, b) => a - b);

if (!versions.length) {
  console.error('No raw data found under data/raw/. Run ./tools/extract/collect.sh first.');
  process.exit(1);
}

const bitOf = new Map(versions.map((v, i) => [v, 1 << i]));
/** Turns a bit mask back into a list of versions (used for the summary log). */
const maskToVersions = (m) => versions.filter((v) => m & bitOf.get(v));

const releases = [];
const perVersion = new Map();

for (const v of versions) {
  const base = path.join(RAW, String(v));
  const meta = Object.fromEntries(
    (read(path.join(base, 'meta.txt')) || '')
      .split('\n').filter(Boolean).map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );

  const help = new Map();      // canonical name -> { desc, arg, classes:Set, undocumented }
  const addHelp = (token, desc, cls, undocumented) => {
    const [name, arg] = splitName(token);
    if (!name.startsWith('-')) return;
    let e = help.get(name);
    if (!e) { e = { desc: '', arg: '', classes: new Set(), langs: new Set(), undocumented: true }; help.set(name, e); }
    if (arg && !e.arg) e.arg = arg;
    if (desc && (!e.desc || e.desc.length < desc.length)) e.desc = desc;
    if (cls) e.classes.add(cls);
    if (!undocumented) e.undocumented = false;
  };

  for (const cls of CLASSES) {
    const doc = read(path.join(base, 'help', `${cls}.txt`));
    if (doc) for (const [t, d] of parseHelpDump(doc)) addHelp(t, d, cls, false);
    const und = read(path.join(base, 'help', `${cls}.undoc.txt`));
    if (und) for (const [t, d] of parseHelpDump(und)) addHelp(t, d, cls, true);
  }
  for (const [dump, label] of Object.entries(LANG_DUMPS)) {
    const doc = read(path.join(base, 'help', `${dump}.txt`));
    if (!doc) continue;
    for (const [t] of parseHelpDump(doc)) {
      const [name] = splitName(t);
      const e = help.get(name);
      if (e) e.langs.add(label);
    }
  }

  // Baseline state per driver.
  const state = {};
  for (const driver of ['gcc', 'g++']) {
    const m = new Map();
    for (const cls of CLASSES) {
      const txt = read(path.join(base, 'state', driver, `${cls}.txt`));
      if (!txt) continue;
      for (const [t, val] of parseStateDump(txt, { params: cls === 'params' })) {
        const [name] = splitName(t);
        m.set(name, normValue(val));
        // `--help=params` in GCC 8/9 is the only source for those options.
        if (!help.has(name) && name.startsWith('--param')) {
          help.set(name, { desc: '', arg: '', classes: new Set([cls]), langs: new Set(), undocumented: false });
        }
      }
    }
    state[driver] = m;
  }

  const paramBounds = new Map();
  {
    const txt = read(path.join(base, 'state', 'gcc', 'params.txt'));
    if (txt) for (const [k, v] of parseLegacyParams(txt)) paramBounds.set(k, v);
  }

  // Umbrella flags.
  const packs = new Map();     // flags -> Map<driver, Map<name, value>>
  for (const dir of dirs(path.join(base, 'packs'))) {
    const pdir = path.join(base, 'packs', dir);
    if (!fs.statSync(pdir).isDirectory()) continue;
    const driver = dir.split('__')[0];
    const flags = (read(path.join(pdir, 'FLAGS')) || '').trim();
    if (!flags) continue;
    const m = new Map();
    for (const cls of CLASSES) {
      const txt = read(path.join(pdir, `${cls}.txt`));
      if (!txt) continue;
      for (const [t, val] of parseStateDump(txt, { params: cls === 'params' })) {
        const [name] = splitName(t);
        m.set(name, normValue(val));
      }
    }
    if (!packs.has(flags)) packs.set(flags, new Map());
    packs.get(flags).set(driver, m);
  }

  // Man page.
  const manSrc = read(path.join(base, 'man', 'gcc.1'));
  const man = new Map();
  const manEntries = [];
  if (manSrc) {
    for (const entry of parseManPage(manSrc)) {
      if (entry.section !== 'OPTIONS') continue;
      const md = blocksToMarkdown(entry.blocks);
      if (!md) continue;
      const e = { ...entry, md, primary: manPrimary(entry) };
      manEntries.push(e);
      for (const k of manKeys(entry)) if (!man.has(k)) man.set(k, e);
    }
  }

  // Sample diagnostics.
  const samples = new Map();
  for (const f of dirs(path.join(base, 'samples'))) {
    const out = read(path.join(base, 'samples', f)) ?? '';
    samples.set(f.replace(/\.txt$/, ''), out.trim());
  }

  releases.push({
    v,
    full: meta.fullversion || meta.version || String(v),
    banner: meta.banner || '',
    target: meta.target || '',
    extractedAt: meta.date || '',
    optionCount: help.size,
  });
  perVersion.set(v, { help, state, packs, man, manEntries, samples, paramBounds });
  console.log(`  gcc ${String(v).padStart(2)}  ${help.size} options, ${man.size} man keys, ${packs.size} packs`);
}

// --- merge ------------------------------------------------------------------

const options = new Map();     // name -> record

const ensure = (name) => {
  let o = options.get(name);
  if (!o) {
    o = {
      name,
      arg: '',
      desc: '',
      cat: 'other',
      cls: new Set(),
      langs: new Set(),
      vmask: 0,
      def: {},
      defCxx: {},
      alias: null,
      packs: {},
      src: 'driver',
      undoc: true,
      manSection: '',
      manGroup: '',
      doc: '',
      docFrom: null,
      params: null,
    };
    options.set(name, o);
  }
  return o;
};

for (const v of versions) {
  const bit = bitOf.get(v);
  const { help, state, packs, man, paramBounds } = perVersion.get(v);

  for (const [name, e] of help) {
    const o = ensure(name);
    o.vmask |= bit;
    if (e.arg) o.arg = e.arg;
    if (e.desc) o.desc = e.desc;
    for (const c of e.classes) o.cls.add(c);
    for (const l of e.langs) o.langs.add(l);
    if (!e.undocumented) o.undoc = false;

    const gv = state.gcc?.get(name);
    if (gv !== undefined) o.def[v] = gv;
    if (typeof gv === 'string' && gv.startsWith('n/a:')) {
      for (const l of gv.slice(4).split(',')) o.langs.add(l);
    }
    const cv = state['g++']?.get(name);
    if (cv !== undefined) o.defCxx[v] = cv;
    if (typeof gv === 'string' && gv.startsWith('-')) o.alias = gv;
    // GCC also spells aliases out in the description ("Same as -Wall.").
    const sameAs = /^Same as (-\S+?)\.(\s|$)/.exec(e.desc || '');
    if (sameAs && !o.alias) o.alias = sameAs[1];

    const b = paramBounds.get(name);
    if (b) o.params = b;

    const entry = man.get(name)
      || man.get(name.replace(/=$/, ''))
      || man.get(`${name}=`);
    if (entry) {
      o.manSection = entry.subsection || entry.section;
      o.manGroup = entry.group && entry.group !== entry.subsection ? entry.group : '';
      // Prefer the newest release's wording.
      o.doc = entry.md;
      o.docFrom = v;
    }
  }

  for (const [flags, byDriver] of packs) {
    for (const [driver, m] of byDriver) {
      const baseline = state[driver];
      if (!baseline) continue;
      for (const [name, val] of m) {
        const before = baseline.get(name);
        if (before === undefined || before === val) continue;
        // Only surface options the umbrella flag actually turns on / sets.
        if (before === 'enabled' && val === 'disabled') continue;
        const o = options.get(name);
        if (!o) continue;
        const p = (o.packs[flags] ||= { m: 0, v: val, l: new Set() });
        p.m |= bit;
        p.v = val;
        p.l.add(driver === 'g++' ? 'C++' : 'C');
      }
    }
  }
}

// Options that exist but are never listed by `gcc --help` on this host: the
// driver level ones (`-L`, `-Wl,`, `-shared`, `-D`) and every cross-target
// machine option. The man page is the only source for those.
for (const v of versions) {
  const bit = bitOf.get(v);
  for (const entry of perVersion.get(v).manEntries) {
    const name = entry.primary;
    if (!name) continue;
    const existing = options.get(name);
    if (existing && existing.src === 'driver') continue;
    // `-Wno-x` / `-fno-x` entries are just the negation of an option we already
    // have; keep them only when the positive spelling is undocumented.
    const positive = name.replace(/^(-[Wfm])no-/, '$1');
    if (positive !== name && options.has(positive)) continue;
    const o = ensure(name);
    o.src = 'man';
    o.vmask |= bit;
    o.manSection = entry.subsection || entry.section;
    o.manGroup = entry.group && entry.group !== entry.subsection ? entry.group : '';
    o.doc = entry.md;
    o.docFrom = v;
    o.undoc = false;
    if (!o.desc) {
      // First sentence of the manual entry, stripped of Markdown markup.
      const first = entry.md.split('\n\n')[0].replace(/[`*_\\]/g, '').replace(/\s+/g, ' ').trim();
      const m = /^(.{0,180}?[.!])(\s|$)/.exec(first);
      o.desc = (m ? m[1] : first.slice(0, 180)).trim();
    }
  }
}

for (const o of options.values()) {
  o.cat = deriveCategory({ name: o.name, manSubsection: o.manSection, classes: [...o.cls] });
}

// --- samples ----------------------------------------------------------------

const sampleDir = path.join(ROOT, 'tools', 'extract', 'samples');
const samples = [];
for (const file of fs.readdirSync(sampleDir).sort()) {
  if (!/\.(c|cc)$/.test(file)) continue;
  const source = fs.readFileSync(path.join(sampleDir, file), 'utf8');
  const flags = (/^\/\/ *FLAGS: *(.*)$/m.exec(source)?.[1] ?? '').trim();
  const outputs = {};
  for (const v of versions) {
    const out = perVersion.get(v).samples.get(file);
    if (out === undefined) continue;
    if (/unrecognized command[ -]line option|unrecognized argument/.test(out)) continue;
    outputs[v] = out;
  }
  const targets = flags.split(/\s+/).filter((f) => f.startsWith('-')).map((f) => splitName(f)[0]);
  const id = file.replace(/\.(c|cc)$/, '');
  samples.push({
    id,
    file,
    lang: file.endsWith('.cc') ? 'C++' : 'C',
    flags,
    source: source.replace(/^\/\/ *FLAGS:.*\n/m, ''),
    outputs,
    options: [...new Set(targets)],
  });
}

const samplesByOption = new Map();
for (const s of samples) {
  for (const name of s.options) {
    // `-Wshift-overflow=2` demonstrates `-Wshift-overflow=`, and often the
    // plain boolean spelling exists too.
    for (const cand of [name, `${name}=`, name.replace(/=$/, '')]) {
      if (options.has(cand)) {
        if (!samplesByOption.has(cand)) samplesByOption.set(cand, new Set());
        samplesByOption.get(cand).add(s.id);
      }
    }
  }
}

// --- profiles ---------------------------------------------------------------

const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'data', 'profiles.json'), 'utf8'));
for (const p of profiles.profiles) {
  for (const f of p.flags) {
    const [name] = splitName(f.option || f.flag);
    const o = options.get(name) || options.get(`${name}=`) || options.get(name.replace(/=$/, ''));
    f.known = Boolean(o);
    if (o) {
      f.option = o.name;
      f.availableIn = maskToVersions(o.vmask);
    }
  }
}

// --- serialise --------------------------------------------------------------

/** `{8:'a',9:'a',...}` -> `'a'` when uniform, otherwise an array aligned on `versions`. */
function packDefaults(map, vmask) {
  const arr = versions.map((v) => ((vmask & bitOf.get(v)) ? (map[v] ?? null) : null));
  const present = arr.filter((x) => x !== null);
  if (!present.length) return null;
  const uniform = present.every((x) => x === present[0]);
  return uniform ? present[0] : arr;
}

const sorted = [...options.values()].sort((a, b) => a.name.localeCompare(b.name));

const optionRecords = sorted.map((o) => {
  const rec = {
    n: o.name,
    c: o.cat,
    m: o.vmask,
    d: o.desc,
  };
  if (o.arg) rec.a = o.arg;
  const def = packDefaults(o.def, o.vmask);
  if (def !== null && def !== '') rec.v = def;
  const defCxx = packDefaults(o.defCxx, o.vmask);
  if (defCxx !== null && defCxx !== '' && JSON.stringify(defCxx) !== JSON.stringify(def)) rec.vx = defCxx;
  if (o.alias) rec.al = o.alias;
  if (o.undoc) rec.u = 1;
  if (o.langs.size) rec.l = [...o.langs];
  if (o.cls.size) rec.k = [...o.cls];
  if (o.manSection) rec.s = o.manSection;
  if (o.manGroup) rec.g = o.manGroup;
  if (o.src !== 'driver') rec.src = o.src;
  if (o.doc) rec.doc = 1;
  if (o.params) rec.p = o.params;
  const packs = {};
  for (const [flags, p] of Object.entries(o.packs)) {
    packs[flags] = { m: p.m, v: p.v, l: [...p.l].sort() };
  }
  if (Object.keys(packs).length) rec.pk = packs;
  const sids = samplesByOption.get(o.name);
  if (sids) rec.ex = [...sids];
  return rec;
});

const docs = {};
for (const o of sorted) if (o.doc) docs[o.name] = { md: o.doc, from: o.docFrom };

const packList = new Map();
for (const o of options.values()) {
  for (const [flags, p] of Object.entries(o.packs)) {
    const e = packList.get(flags) || { flags, m: 0, count: 0 };
    e.m |= p.m;
    e.count += 1;
    packList.set(flags, e);
  }
}

const categories = {};
for (const r of optionRecords) categories[r.c] = (categories[r.c] || 0) + 1;

// Honour SOURCE_DATE_EPOCH so CI can rebuild the dataset and diff it against
// what is committed, byte for byte.
const now = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000)
  : new Date();

const manifest = {
  schema: 2,
  generatedAt: now.toISOString(),
  versions,
  releases,
  packs: [...packList.values()].sort((a, b) => a.flags.localeCompare(b.flags)),
  categories,
  languages: [...new Set(optionRecords.flatMap((r) => r.l || []))].sort(),
  archGroups: [...new Set(optionRecords.map((r) => r.g).filter(Boolean))].sort(),
  manSections: [...new Set(optionRecords.map((r) => r.s).filter(Boolean))].sort(),
  counts: {
    options: optionRecords.length,
    documented: Object.keys(docs).length,
    samples: samples.length,
  },
};

fs.mkdirSync(OUT, { recursive: true });
const write = (file, data) => {
  const json = JSON.stringify(data);
  fs.writeFileSync(path.join(OUT, file), json);
  return json.length;
};

const sizes = {
  'options.json': write('options.json', optionRecords),
  'docs.json': write('docs.json', { docs, samples }),
  'profiles.json': write('profiles.json', profiles),
};

manifest.files = Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, v]));
manifest.hash = crypto.createHash('sha256')
  .update(JSON.stringify([optionRecords.length, manifest.generatedAt, sizes]))
  .digest('hex')
  .slice(0, 12);
sizes['manifest.json'] = write('manifest.json', manifest);

console.log('\nDataset written to public/data:');
for (const [f, s] of Object.entries(sizes)) {
  console.log(`  ${f.padEnd(16)} ${(s / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`\n  ${optionRecords.length} options, ${Object.keys(docs).length} documented, ` +
  `${samples.length} samples, ${manifest.packs.length} umbrella flags`);
console.log(`  categories: ${Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' ')}`);
