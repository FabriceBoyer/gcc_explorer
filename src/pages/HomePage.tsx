import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, BookText, Boxes, Container, Database, Gauge, GitCompareArrows, Layers,
  PackageCheck, ShieldCheck, Table2, Terminal, WifiOff,
} from 'lucide-react';
import { useDataset } from '../lib/dataset-context';
import { Badge } from '../components/ui';

const FEATURES = [
  {
    icon: Table2,
    title: 'One table, every option',
    body: 'Name, default value, short description and the release range it exists in — sortable, filterable and searchable across three thousand options without a single page reload.',
  },
  {
    icon: Layers,
    title: 'Umbrella flags, measured',
    body: 'What exactly does -Wall turn on in GCC 12 but not in GCC 9? Answered by diffing `gcc -Q --help` with and without the flag, per release and per front end.',
  },
  {
    icon: ShieldCheck,
    title: 'Hardening profiles',
    body: 'Ten curated flag sets — OpenSSF baseline and strict hardening, sanitizers, embedded, reproducible builds — each flag annotated with why it is there and which releases have it.',
  },
  {
    icon: PackageCheck,
    title: 'Export to your build',
    body: 'CMake, Meson, Make, Bazel, Autotools, Ninja, Ant, compile_flags.txt or plain CFLAGS — with compile and link flags split correctly.',
  },
  {
    icon: BookText,
    title: 'The manual, in context',
    body: 'The full gcc.1 entry for the selected option, plus real diagnostics captured by actually compiling sample programs in every release.',
  },
  {
    icon: GitCompareArrows,
    title: 'Diff two releases',
    body: 'See precisely which options were added, removed or had their default changed between any two of the eight supported releases.',
  },
  {
    icon: Gauge,
    title: 'What it costs you',
    body: 'Build time, runtime and binary size per option — measured by actually compiling and running a benchmark in each release, curated where a benchmark cannot show it, and sortable and filterable like everything else.',
  },
];

export default function HomePage() {
  const { data } = useDataset();
  const m = data?.manifest;

  return (
    <div className="h-full overflow-y-auto">
      {/* hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-bg absolute inset-0" />
        <div className="glow absolute inset-0" />
        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <Badge tone="accent" className="mb-4">
              <Container className="size-3" />
              GCC {m ? `${m.versions[0]} → ${m.versions.at(-1)}` : '8 → 15'} · extracted from the compilers themselves
            </Badge>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              Every GCC option,
              <span className="text-accent"> explained, compared and exportable.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
              GCC ships thousands of compile and link options. Their defaults move between releases, half of
              them are switched on implicitly by an umbrella flag, and the manual is 30 000 lines of troff.
              GCC Explorer turns all of that into a table you can actually search — and a flag list you can
              paste into your build system.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/explorer"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-white shadow-panel transition-transform hover:scale-[1.02]"
              >
                Open the explorer
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/docs"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-medium transition-colors hover:bg-surface-2"
              >
                <BookText className="size-4" />
                How to use it
              </Link>
            </div>
          </motion.div>

          {m && (
            <motion.dl
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {[
                { k: 'options catalogued', v: m.counts.options.toLocaleString() },
                { k: 'with manual text', v: m.counts.documented.toLocaleString() },
                { k: 'releases compared', v: m.versions.length },
                { k: 'flags benchmarked', v: m.counts.benchmarked },
              ].map((s) => (
                <div key={s.k} className="surface-card px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-wider text-faint">{s.k}</dt>
                  <dd className="mt-1 font-mono text-2xl font-semibold">{s.v}</dd>
                </div>
              ))}
            </motion.dl>
          )}
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-xl font-semibold tracking-tight">What it does</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="surface-card group p-4 transition-colors hover:border-line-strong"
            >
              <f.icon className="mb-3 size-5 text-accent transition-transform group-hover:scale-110" />
              <h3 className="text-[14px] font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* provenance */}
      <section className="border-y border-line bg-bg-alt">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-xl font-semibold tracking-tight">Where the data comes from</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
            Nothing here is scraped from a website or typed by hand. Every fact is produced by running GCC
            itself, once per release, inside the official <code className="font-mono text-ink">gcc:&lt;major&gt;</code> container images.
          </p>

          <ol className="mt-7 grid gap-3 md:grid-cols-4">
            {[
              { icon: Container, t: 'Run the real compiler', d: 'One container per release, GCC 8 to 15, so the answers are the answers that release actually gives.' },
              { icon: Terminal, t: 'Ask it everything', d: '`--help=<class>` for names and descriptions, `-Q --help=<class>` for default values, once per umbrella flag to diff what it enables.' },
              { icon: Gauge, t: 'Time it', d: 'A benchmark is compiled and run with and without each of the interesting flags, paired against a baseline taken moments before, to measure what it actually costs.' },
              { icon: BookText, t: 'Parse the shipped manual', d: 'The installed gcc.1 troff source is parsed into Markdown, keeping each entry in its manual section — which is what tells compile options from link options.' },
              { icon: Database, t: 'Commit the result', d: 'The merged JSON lives in git and is served as static files. No backend, no API, no build-time network access.' },
            ].map((s, i) => (
              <li key={s.t} className="surface-card relative p-4">
                <span className="absolute right-3 top-3 font-mono text-[11px] text-faint">0{i + 1}</span>
                <s.icon className="mb-3 size-5 text-accent" />
                <h3 className="text-[13.5px] font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2 text-[12px] text-muted">
            <Badge><WifiOff className="size-3" /> works offline after first load</Badge>
            <Badge><Boxes className="size-3" /> static hosting, no backend</Badge>
            {m && <Badge><Database className="size-3" /> dataset {m.hash} · {new Date(m.generatedAt).toISOString().slice(0, 10)}</Badge>}
            {m && <Badge>{m.releases.at(-1)?.target}</Badge>}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-[12.5px] text-faint">
        <p>
          GCC Explorer is an independent project. GCC is © Free Software Foundation, distributed under the
          GPL; the option descriptions and manual text shown here are extracted from the compiler and its
          documentation.
        </p>
      </footer>
    </div>
  );
}
