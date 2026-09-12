import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Download, BookOpen } from 'lucide-react';
import { useDataset } from '../lib/dataset-context';
import { useStore } from '../lib/store';
import { reportEntries, entryMarkdown, reportMarkdown } from '../lib/selection-report';
import type { ReportSettings } from '../lib/selection-report';
import { Button, Badge } from '../components/ui';
import { LoadingScreen } from '../components/LoadingScreen';

const html = (md: string) => DOMPurify.sanitize(marked.parse(md, { async: false }) as string);
export default function SelectionPage() {
  const { data, docs, error, requestDocs } = useDataset();
  const selection = useStore(s => s.selection);
  const version = useStore(s => s.pivot);
  const setVersion = useStore(s => s.setPivot);
  const [language, setLanguage] = useState<'C' | 'C++'>('C');
  const [defaults, setDefaults] = useState(false);
  const [packs, setPacks] = useState(false);
  const [manual, setManual] = useState(true);
  const [examples, setExamples] = useState(true);
  const [query, setQuery] = useState('');
  useEffect(() => requestDocs(), [requestDocs]);
  const settings: ReportSettings = useMemo(() => ({ version, language, defaults, packs, manual, examples, query }), [version, language, defaults, packs, manual, examples, query]);
  const entries = useMemo(() => data ? reportEntries(data, selection, settings) : [], [data, selection, settings]);
  if (error) return <p className="p-6 text-danger">Unable to load the catalogue: {error.message}</p>;
  if (!data || !docs) return <LoadingScreen label="Preparing your documented selection…" />;
  const download = (format: 'html' | 'md') => {
    const md = reportMarkdown(entries, data, docs, settings);
    const content = format === 'md' ? md : `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GCC selection explained</title><style>html{color-scheme:light dark}body{font:16px/1.65 system-ui;max-width:900px;margin:auto;padding:24px;overflow-wrap:anywhere}pre{overflow:auto;padding:16px;background:light-dark(#f1f5f9,#202733);border-radius:10px}code{font-family:monospace}h2{border-top:1px solid #888;padding-top:24px}a{color:light-dark(#4338ca,#a5b4fc)}@media print{body{color:black;background:white}pre{white-space:pre-wrap}}</style><body>${html(md)}</body></html>`;
    const url = URL.createObjectURL(new Blob([content], { type: format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `gcc-${version}-selection.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="h-full overflow-y-auto bg-bg-alt">
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3"><BookOpen className="text-accent" /><h1 className="text-3xl font-semibold tracking-tight">Selection explained</h1><Badge tone="accent">{Object.keys(selection).length} chosen flags</Badge></div>
      <p className="mt-3 max-w-3xl text-muted">A readable companion to your build configuration. Each chosen flag keeps its exact spelling, its purpose and the evidence behind it.</p>
      <div className="surface-card my-6 space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label>Compiler <select className="rounded border bg-surface p-2" value={version} onChange={e => setVersion(Number(e.target.value))}>{data.manifest.versions.map(v => <option key={v} value={v}>GCC {v}</option>)}</select></label>
          <label>Language <select className="rounded border bg-surface p-2" value={language} onChange={e => setLanguage(e.target.value as 'C' | 'C++')}><option>C</option><option>C++</option></select></label>
          <Button onClick={() => download('html')}><Download size={15} /> HTML</Button><Button onClick={() => download('md')}><Download size={15} /> Markdown</Button>
          <Link className="text-accent-text underline" to="/explorer">Edit selection</Link>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">{([['Show baseline-enabled options', defaults, setDefaults], ['Show observed umbrella effects', packs, setPacks], ['Full manual inline', manual, setManual], ['Diagnostic examples', examples, setExamples]] as const).map(([label, value, setter]) => <label key={label} className="flex items-center gap-2"><input type="checkbox" checked={value} onChange={e => setter(e.target.checked)} />{label}</label>)}</div>
        <input aria-label="Search documented selection" placeholder="Find a flag or an explanation…" className="w-full rounded-lg border bg-bg p-3" value={query} onChange={e => setQuery(e.target.value)} />
        <p className="text-xs text-muted">{entries.length} entries shown. Exports include all displayed entries and the current documentation settings. Optional baseline and umbrella entries do not modify your saved selection.</p>
      </div>
      <p className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-muted">Baseline defaults describe the extracted compiler, not the final state after your flags. Umbrella effects are observed individually; overrides and option ordering are not simulated. Availability is based on catalogue entries, not a validation of every argument or target. Manual entries identify their source release.</p>
      {!Object.keys(docs.docs).length && <p role="alert" className="mb-4 text-warn">Manual data is unavailable. Reload while connected to retry; exports will explicitly mark missing documentation.</p>}
      {!entries.length && <div className="surface-card p-10 text-center"><h2 className="font-semibold">Nothing to explain yet</h2><p className="mt-2 text-muted">Choose flags in the Explorer, clear your search, or show the compiler baseline.</p><Link to="/explorer" className="mt-4 inline-block text-accent-text underline">Explore options</Link></div>}
      <div className="space-y-5">{entries.map((entry, i) => <article key={entry.flag} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }} className="surface-card min-w-0 p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2"><span className="text-faint">{i + 1}.</span><h2 className="min-w-0 break-all font-mono text-lg font-semibold">{entry.flag}</h2><Badge tone={entry.origin === 'Explicit selection' ? 'accent' : 'neutral'}>{entry.origin === 'Explicit selection' ? 'Chosen' : 'Reference'}</Badge>{!entry.available && <Badge tone="warn">{entry.row ? `Unavailable in GCC ${version}` : 'Unknown option'}</Badge>}</div>
        <div className="prose-man break-words [&_h3]:mt-5 [&_h3]:font-semibold [&_code]:whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: html(entryMarkdown(entry, data, docs, settings)) }} />
      </article>)}</div>
    </div>
  </div>;
}
