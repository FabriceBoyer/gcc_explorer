import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  BookText, Database, ExternalLink, Gauge, Keyboard, PackageCheck, RefreshCw, ShieldCheck,
  Table2, Trash2,
} from 'lucide-react';
import { useDataset } from '../lib/dataset-context';
import { cacheStats, clearCache } from '../lib/dataset';
import { FORMATS } from '../lib/export';
import { LoadingScreen } from '../components/LoadingScreen';
import { Badge, Button } from '../components/ui';

const SECTIONS = [
  { id: 'start', label: 'Getting started', icon: Table2 },
  { id: 'filters', label: 'Filters & search', icon: BookText },
  { id: 'packs', label: 'Umbrella flags', icon: RefreshCw },
  { id: 'profiles', label: 'Profiles', icon: ShieldCheck },
  { id: 'impact', label: 'Cost of a flag', icon: Gauge },
  { id: 'export', label: 'Export', icon: PackageCheck },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'data', label: 'Data & caching', icon: Database },
];

const SHORTCUTS = [
  ['/', 'Focus the search box'],
  ['Esc', 'Close the detail panel or the export dialog'],
  ['Enter / Space', 'Open the focused row in the detail panel'],
  ['Click the checkbox', 'Add or remove a flag without opening the panel'],
];

export default function DocsPage() {
  const { data, requestDocs } = useDataset();
  const [active, setActive] = useState('start');
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => { requestDocs(); }, [requestDocs]);
  useEffect(() => { cacheStats().then((s) => setEntries(s.entries)); }, []);

  if (!data) return <LoadingScreen label="Loading dataset…" />;
  const { manifest, profiles } = data;

  return (
    <div className="flex h-full min-h-0">
      <nav className="hidden w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-bg-alt p-3 lg:flex">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Documentation</p>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={() => setActive(s.id)}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
              active === s.id ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            <s.icon className="size-3.5" />
            {s.label}
          </a>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="text-2xl font-semibold tracking-tight">Using GCC Explorer</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Everything on this site is a static file. The first visit downloads roughly two megabytes of
            JSON, keeps it in IndexedDB, and from then on the whole catalogue works offline.
          </p>

          <Section id="start" title="Getting started">
            <p>
              The <Link className="text-accent-text underline underline-offset-2" to="/explorer">Explorer</Link>{' '}
              is one long table of every option GCC knows about. Each row gives you the canonical spelling,
              its default value in the <em>pivot release</em>, a one-line description and the range of
              releases where the option exists.
            </p>
            <ul>
              <li><strong>Click a row</strong> to open the detail panel: full manual entry, per-release availability and defaults, umbrella flag membership and — for common warnings — the diagnostic the compiler actually prints.</li>
              <li><strong>Click a checkbox</strong> to add the flag to your selection. The selection lives in <code>localStorage</code>, so closing the tab does not lose it.</li>
              <li><strong>Pivot release</strong> (sidebar) decides which release the <em>Default</em> column reports, and which release the profile availability check uses.</li>
            </ul>
          </Section>

          <Section id="filters" title="Filters and search">
            <p>
              Search matches the option name first and the description second, so typing <code>-Wsh</code>
              puts <code>-Wshadow</code> at the top rather than every parameter whose help text mentions
              shadowing. Several words are ANDed together.
            </p>
            <p>The sidebar narrows the table down:</p>
            <ul>
              <li><strong>Releases</strong> — combined with the <code>any of</code> / <code>all of</code> / <code>only in</code> switch. <code>only in</code> is how you find options unique to one release.</li>
              <li><strong>Default value</strong> — on, off, or "takes a value". Useful for auditing what you get for free.</li>
              <li><strong>Enabled by</strong> — restrict to options an umbrella flag turns on.</li>
              <li><strong>Profiles</strong> — restrict to the flags of a curated set.</li>
              <li><strong>Categories</strong> — the manual's own grouping, which is what separates compile options from link options.</li>
              <li><strong>Scope</strong> — cross-target machine options ({(manifest.categories.target ?? 0).toLocaleString()} of them), undocumented options and aliases are hidden by default because they are noise for most people.</li>
            </ul>
          </Section>

          <Section id="packs" title="Umbrella flags">
            <p>
              An umbrella flag such as <code>-Wall</code> or <code>-O2</code> quietly turns on dozens of
              other options, and the exact list changes with every release. GCC Explorer measures it rather
              than guessing: for each release it dumps <code>gcc -Q --help=&lt;class&gt;</code> with and
              without the flag and records every option whose state changed.
            </p>
            <div className="not-prose my-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {manifest.packs.map((p) => (
                <div key={p.flags} className="surface-card px-3 py-2">
                  <code className="font-mono text-[12.5px] font-semibold text-warn">{p.flags}</code>
                  <p className="mt-0.5 text-[11.5px] text-faint">{p.count} options affected</p>
                </div>
              ))}
            </div>
            <p>
              The detail panel shows, per umbrella flag, which releases are affected and whether the effect
              was only observed under <code>gcc</code> or only under <code>g++</code>.
            </p>
          </Section>

          <Section id="profiles" title="Hardening and diagnostics profiles">
            <p>
              Profiles are curated flag sets with a reason attached to every flag. They are not generated —
              they are opinions, based on the OpenSSF hardening guide and common practice — but the
              availability of each flag <em>is</em> checked against the extracted data, so a profile never
              suggests a flag your release does not have.
            </p>
            <div className="not-prose my-4 space-y-2">
              {profiles.profiles.map((p) => (
                <div key={p.id} className="surface-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold">{p.name}</span>
                    <Badge tone="accent">{p.kind}</Badge>
                    <span className="ml-auto font-mono text-[11px] text-faint">{p.flags.length} flags</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{p.summary}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">{p.description}</p>
                </div>
              ))}
            </div>
            <p>Sources the profiles are based on:</p>
            <ul>
              {profiles.references.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                    {r.label}
                    <ExternalLink className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="impact" title="What a flag costs">
            <p>
              Two columns in the table, <strong>Build</strong> and <strong>Runtime</strong>, say what an
              option costs — sortable, and filterable from the <em>Impact</em> section of the sidebar. The
              detail panel adds binary size and, where the figure was measured, the raw numbers per release.
              Scores read <em>improves · negligible · low · moderate · high</em>, or <em>varies</em> when the
              honest answer is that it depends on your code.
            </p>
            <p>The score comes from one of three places, and the panel always says which:</p>
            <ul>
              <li>
                <strong>Measured</strong> — {manifest.counts.benchmarked} flags are actually compiled and run
                inside each release's own container. A benchmark that exercises dense array arithmetic,
                pointer chasing, bounded string work, allocation churn and non-inlinable calls is built and
                timed with the flag and without it, and the binary is measured. Covers{' '}
                {manifest.counts.impactMeasured} options.
              </li>
              <li>
                <strong>Curated</strong> — costs that are established fact but that no single generic
                benchmark can show, written down by hand with the reasoning attached. Covers{' '}
                {manifest.counts.impactCurated} options. A curated statement <em>beats</em> a measurement on
                the axis it covers, because a wall-clock timing on a shared machine will occasionally claim
                that adding a warning made the program faster, and publishing that would be worse than
                publishing nothing.
              </li>
              <li>
                <strong>Derived</strong> — what the option's category makes certain. A pure diagnostic cannot
                change the generated code, so its runtime and size cost is exactly zero. That covers several
                hundred options for free, and it is the reason{' '}
                {manifest.counts.impactKnown.toLocaleString()} of {manifest.counts.options.toLocaleString()}{' '}
                options have a runtime answer at all.
              </li>
            </ul>
            <h4>How the measurement avoids lying to you</h4>
            <ul>
              <li>
                <strong>Paired baselines.</strong> The reference build is re-measured immediately before every
                flag, not once at the start, so a machine that gets busier during the run cannot masquerade as
                a flag that costs something.
              </li>
              <li>
                <strong>Fastest run wins.</strong> Background load can only ever inflate a timing, so the
                minimum of several runs is the observation closest to the truth. Each measurement is preceded
                by a discarded warm-up.
              </li>
              <li>
                <strong>Median across releases.</strong> A flag is scored on the median of its eight
                per-release ratios, so a single noisy run cannot decide a rating.
              </li>
              <li>
                <strong>Thresholds wider than the noise.</strong> A baseline measured against itself is
                recorded on every release. On this dataset it deviates by{' '}
                {manifest.benchNoise?.build?.typical ?? '?'}% on build and{' '}
                {manifest.benchNoise?.runtime?.typical ?? '?'}% on runtime for a typical release
                (worst case {manifest.benchNoise?.runtime?.worst ?? '?'}%), and exactly{' '}
                {manifest.benchNoise?.size?.typical ?? 0}% on size. Scoring on the median across eight
                releases pulls that down a lot, and the bands separating <em>negligible</em> from{' '}
                <em>low</em> sit outside what is left.
              </li>
            </ul>
            <p>
              Binary size is exact — it is a byte count, not a stopwatch. <strong>Runtime is wall clock on
              one developer machine</strong>, and the benchmark spends much of its time in allocation and
              libc, which means it separates instrumentation overhead sharply (AddressSanitizer and
              UndefinedBehaviorSanitizer together measure at 4.8× here) but is insensitive to optimisation
              level. That is exactly why the <code>-O</code> family carries a curated verdict rather than a
              measured one. Treat 2× as meaningful and 10% as noise, and profile your own workload before
              making a decision that depends on the difference.
            </p>
          </Section>

          <Section id="export" title="Exporting a selection">
            <p>
              Hit <strong>Export</strong> in the selection bar. Flags are split into compile and link lists
              first — getting that split wrong is the usual reason a hardened build silently loses half its
              mitigations, because <code>-fsanitize=</code>, <code>-flto</code> and <code>-pie</code> have to
              appear on both command lines.
            </p>
            <div className="not-prose my-4 grid gap-2 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <div key={f.id} className="surface-card px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium">{f.label}</span>
                    <code className="font-mono text-[11px] text-faint">{f.filename}</code>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted">{f.blurb}</p>
                </div>
              ))}
            </div>
            <p>
              The export dialog also warns when a selected flag does not exist in the pivot release — handy
              when you are targeting an older toolchain than your workstation has.
            </p>
          </Section>

          <Section id="shortcuts" title="Keyboard shortcuts">
            <div className="not-prose my-3 overflow-hidden rounded-xl border border-line">
              {SHORTCUTS.map(([key, what], i) => (
                <div key={key} className={clsx('flex items-center gap-3 px-3 py-2', i > 0 && 'border-t border-line')}>
                  <kbd className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11.5px]">{key}</kbd>
                  <span className="text-[13px] text-muted">{what}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="data" title="Data provenance and caching">
            <p>
              The dataset is regenerated locally with Docker and committed to the repository — the CI never
              runs a compiler. To rebuild it yourself:
            </p>
            <pre><code>{`# one container per release, GCC 8 to 15
./tools/extract/collect.sh

# merge the raw dumps into public/data/
npm run data:build`}</code></pre>
            <div className="not-prose my-4 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-surface-2 text-faint">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Release</th>
                    <th className="px-3 py-1.5 text-left font-medium">Full version</th>
                    <th className="px-3 py-1.5 text-left font-medium">Target</th>
                    <th className="px-3 py-1.5 text-right font-medium">Options listed</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.releases.map((r) => (
                    <tr key={r.v} className="border-t border-line">
                      <td className="px-3 py-1.5 font-mono">GCC {r.v}</td>
                      <td className="px-3 py-1.5 font-mono text-muted">{r.full}</td>
                      <td className="px-3 py-1.5 font-mono text-muted">{r.target}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-muted">{r.optionCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Because the extraction runs on <code>{manifest.releases.at(-1)?.target}</code>, the{' '}
              <em>default values</em> and the <em>machine options</em> reported by <code>--help=target</code>{' '}
              are the x86-64 ones. Options for other architectures are still catalogued — they come from the
              manual — but they carry no default value; the <em>Architecture</em> filter groups them the way
              the GCC manual does.
            </p>

            <div className="not-prose my-4 flex flex-wrap items-center gap-2">
              <Badge tone="accent">dataset {manifest.hash}</Badge>
              <Badge>generated {new Date(manifest.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</Badge>
              <Badge>{entries.length} cached payload{entries.length === 1 ? '' : 's'}</Badge>
              <Button
                size="sm"
                variant="danger"
                onClick={() => clearCache().then(() => { setEntries([]); location.reload(); })}
              >
                <Trash2 className="size-3" />
                Clear the browser cache
              </Button>
            </div>
          </Section>
        </article>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-8 mt-8">
      <h2 className="mb-3 text-[17px] font-semibold tracking-tight">{title}</h2>
      <div className="prose-man [&_a]:text-accent-text [&_h3]:text-ink [&_strong]:text-ink">{children}</div>
    </section>
  );
}
