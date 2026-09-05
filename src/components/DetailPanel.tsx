import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookText, CircleAlert, Copy, Check, Layers, Link2, Loader2, Minus, Plus, ShieldCheck, Terminal, X,
} from 'lucide-react';
import type { Dataset } from '../lib/dataset';
import { maskToVersions } from '../lib/dataset';
import type { Sample } from '../lib/types';
import { useStore } from '../lib/store';
import { useDataset } from '../lib/dataset-context';
import { categoryLabel, categoryStyle, CATEGORY_BY_ID, STAGE_LABEL } from '../lib/catalog';
import { cxxDefaultAt, defaultAt } from '../lib/filters';
import { renderMarkdown } from '../lib/markdown';
import { buildFlag } from '../lib/export';
import { VersionMatrix } from './VersionStrip';
import { Badge, Button, SectionTitle } from './ui';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }).catch(() => undefined);
      }}
    >
      {done ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />}
      {done ? 'Copied' : label}
    </Button>
  );
}

function SampleBlock({ sample, versions }: { sample: Sample; versions: number[] }) {
  const available = versions.filter((v) => sample.outputs[String(v)] !== undefined);
  const [picked, setActive] = useState<number | null>(null);
  // Derived rather than synchronised in an effect: if the sample changes and
  // the picked release is no longer available, fall back to the newest one.
  const active = picked !== null && available.includes(picked)
    ? picked
    : (available.at(-1) ?? versions.at(-1)!);
  const output = sample.outputs[String(active)] ?? '';

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <Terminal className="size-3.5 text-faint" />
        <code className="font-mono text-[11px] text-muted">gcc {sample.flags} -c {sample.file}</code>
        <div className="ml-auto flex items-center gap-0.5">
          {available.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setActive(v)}
              className={clsx(
                'rounded-md px-1.5 py-0.5 font-mono text-[10.5px] transition-colors',
                active === v ? 'bg-accent text-white' : 'text-faint hover:text-ink',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <pre className="max-h-52 overflow-auto bg-bg-alt px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
        <code>{sample.source.trim()}</code>
      </pre>
      <div className="border-t border-line px-3 py-2">
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
          GCC {active} output
        </p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-warn">
          <code>{output.trim() || 'no diagnostic'}</code>
        </pre>
      </div>
    </div>
  );
}

export function DetailPanel({ data }: { data: Dataset }) {
  const { selected, select, selection, toggleOption, setOptionValue, theme } = useStore();
  const { docs, docsLoading, requestDocs } = useDataset();
  const row = selected ? data.byName.get(selected) : undefined;

  useEffect(() => { if (selected) requestDocs(); }, [selected, requestDocs]);

  const doc = row && docs ? docs.docs[row.n] : undefined;
  const samples = useMemo(
    () => (row?.ex && docs ? docs.samples.filter((s) => row.ex!.includes(s.id)) : []),
    [row, docs],
  );

  if (!row) {
    return (
      <div className="flex h-full w-[384px] shrink-0 flex-col items-center justify-center gap-2 border-l border-line bg-bg-alt px-8 text-center">
        <BookText className="size-7 text-faint" />
        <p className="text-sm font-medium">Nothing selected</p>
        <p className="text-[13px] text-muted">
          Pick a row to read its manual entry, see where it is available and how each umbrella
          flag affects it.
        </p>
      </div>
    );
  }

  const meta = CATEGORY_BY_ID.get(row.c);
  const ownFlags = Object.entries(selection).filter(([, opt]) => opt === row.n).map(([flag]) => flag);
  const inSelection = ownFlags.length > 0;
  const value = ownFlags.length === 1 && ownFlags[0].startsWith(row.n)
    ? ownFlags[0].slice(row.n.length)
    : '';
  const versions = data.manifest.versions;
  const defaults = versions.map((v) => defaultAt(row, versions, v));
  const cxxDefaults = row.vx ? versions.map((v) => cxxDefaultAt(row, versions, v)) : null;

  return (
    <aside className="flex h-full w-[384px] shrink-0 flex-col border-l border-line bg-bg-alt">
      <div className="flex shrink-0 items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <code className="font-mono text-[15px] font-semibold text-ink">{row.n}</code>
            {row.a && <code className="font-mono text-[13px] text-faint">{row.a}</code>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <Badge style={categoryStyle(row.c, theme === 'dark')}>{categoryLabel(row.c)}</Badge>
            {meta && <Badge>{STAGE_LABEL[meta.stage]}</Badge>}
            {row.u === 1 && <Badge tone="warn">undocumented</Badge>}
            {row.src === 'man' && <Badge title="Known from the manual; the driver does not list it on this host">manual only</Badge>}
            {(row.l ?? []).map((l) => <Badge key={l}>{l}</Badge>)}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => select(null)} aria-label="Close panel">
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <p className="text-[13.5px] leading-relaxed text-ink">{row.d || <em className="text-faint">No short description.</em>}</p>

        {/* ---- selection control ---- */}
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <Button
              variant={inSelection ? 'danger' : 'primary'}
              size="sm"
              onClick={() => toggleOption(row.n, value)}
              className="flex-1"
            >
              {inSelection ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
              {inSelection ? 'Remove from selection' : 'Add to selection'}
            </Button>
            <CopyButton text={buildFlag(row.n, value)} label="Copy flag" />
          </div>
          {(row.a || row.n.endsWith('=')) && (
            <label className="mt-2 flex items-center gap-2 text-[12px] text-muted">
              <span className="shrink-0">Argument</span>
              <input
                value={value}
                onChange={(e) => setOptionValue(row.n, e.target.value)}
                placeholder={row.a || 'value'}
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg-alt px-2 py-1 font-mono text-[12px] text-ink outline-none focus:border-accent"
              />
              <code className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink">
                {buildFlag(row.n, value)}
              </code>
            </label>
          )}
        </div>

        {/* ---- availability ---- */}
        <section>
          <SectionTitle hint="Filled cells are releases that know the option; the second line is its default value there">
            Availability &amp; defaults
          </SectionTitle>
          <VersionMatrix mask={row.m} versions={versions} values={defaults} />
          {cxxDefaults && (
            <>
              <p className="mt-2 mb-1 text-[11px] text-faint">Different under <code className="font-mono">g++</code>:</p>
              <VersionMatrix mask={row.m} versions={versions} values={cxxDefaults} />
            </>
          )}
          {row.p && (
            <p className="mt-2 text-[12px] text-muted">
              Parameter bounds — default <code className="font-mono text-ink">{row.p.default}</code>
              {row.p.min !== undefined && <>, min <code className="font-mono text-ink">{row.p.min}</code></>}
              {row.p.max !== undefined && <>, max <code className="font-mono text-ink">{row.p.max}</code></>}
            </p>
          )}
        </section>

        {/* ---- alias ---- */}
        {row.al && (
          <section className="flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-[12.5px] text-muted">
            <Link2 className="mt-0.5 size-3.5 shrink-0 text-faint" />
            <span>
              GCC reports this option as an alias of{' '}
              <button
                type="button"
                className="font-mono text-accent-text underline underline-offset-2"
                onClick={() => select(row.al!)}
              >
                {row.al}
              </button>
              .
            </span>
          </section>
        )}

        {/* ---- umbrella flags ---- */}
        {row.pk && (
          <section>
            <SectionTitle hint="Measured by diffing `gcc -Q --help` with and without the umbrella flag">
              <Layers className="size-3" />
              Turned on by
            </SectionTitle>
            <div className="space-y-1.5">
              {Object.entries(row.pk).map(([flags, effect]) => (
                <div key={flags} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
                  <code className="font-mono text-[12px] font-semibold text-warn">{flags}</code>
                  <Badge tone="ok">{effect.v}</Badge>
                  <span className="ml-auto font-mono text-[10.5px] text-faint">
                    {maskToVersions(versions, effect.m).join(', ')}
                  </span>
                  {effect.l.length === 1 && <Badge>{effect.l[0]} only</Badge>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- profiles ---- */}
        {row.profiles.length > 0 && (
          <section>
            <SectionTitle>
              <ShieldCheck className="size-3" />
              Part of
            </SectionTitle>
            <div className="space-y-1.5">
              {row.profiles.map((id) => {
                const p = data.profiles.profiles.find((x) => x.id === id);
                const f = p?.flags.find((x) => (x.option ?? x.flag) === row.n);
                if (!p) return null;
                return (
                  <div key={id} className="rounded-lg border border-line bg-surface px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-medium text-ink">{p.name}</span>
                      {f && <code className="ml-auto font-mono text-[11px] text-accent-text">{f.flag}</code>}
                    </div>
                    {f && <p className="mt-1 text-[12px] leading-relaxed text-muted">{f.why}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ---- samples ---- */}
        {row.ex && (
          <section>
            <SectionTitle hint="Compiled inside the official gcc containers; this is the compiler's real output">
              <CircleAlert className="size-3" />
              What it looks like
            </SectionTitle>
            {docsLoading && !docs && <Loader2 className="size-4 animate-spin text-faint" />}
            <div className="space-y-2">
              {samples.map((s) => <SampleBlock key={s.id} sample={s} versions={versions} />)}
            </div>
          </section>
        )}

        {/* ---- manual ---- */}
        <section>
          <SectionTitle hint="Extracted from the gcc.1 man page shipped with the release">
            <BookText className="size-3" />
            GCC manual
            {doc && <span className="ml-1 font-mono text-[10px] normal-case text-faint">gcc {doc.from}</span>}
          </SectionTitle>
          {!docs && docsLoading && (
            <div className="flex items-center gap-2 text-[13px] text-faint">
              <Loader2 className="size-3.5 animate-spin" /> Loading manual text…
            </div>
          )}
          {docs && !doc && (
            <p className="text-[13px] text-faint">
              The manual has no entry for this spelling. It is usually covered by a related option —
              try searching for the stem without its argument.
            </p>
          )}
          {doc && (
            <div className="prose-man" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.md) }} />
          )}
        </section>

        {row.s && (
          <p className="border-t border-line pt-3 text-[11.5px] text-faint">
            Manual section: <span className="text-muted">{row.s}</span>
            {row.g && <> · {row.g}</>}
            {row.k?.length ? <> · <code className="font-mono">--help={row.k.join(',')}</code></> : null}
          </p>
        )}
      </div>
    </aside>
  );
}

/** Mobile / narrow layout: the panel slides over the table. */
export function DetailDrawer({ data }: { data: Dataset }) {
  const { selected, select } = useStore();
  return (
    <AnimatePresence>
      {selected && (
        <>
          <motion.div
            className="absolute inset-0 z-40 bg-black/40 xl:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => select(null)}
          />
          <motion.div
            className="absolute inset-y-0 right-0 z-50 xl:hidden"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          >
            <DetailPanel data={data} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
