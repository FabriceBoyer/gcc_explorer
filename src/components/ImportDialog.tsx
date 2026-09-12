import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dataset } from '../lib/dataset';
import { parseImport, previewImport } from '../lib/import';
import type { ImportFormat } from '../lib/import';
import { useStore } from '../lib/store';
import { Button } from './ui';

export function ImportDialog({ data, onClose }: { data: Dataset; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<ImportFormat>('text');
  const [fileError, setFileError] = useState('');
  const [replace, setReplace] = useState(false);
  const { pivot, addOptions, clearSelection } = useStore();
  useEffect(() => { dialog.current?.showModal(); }, []);
  const preview = useMemo(() => {
    try { return { ...previewImport(parseImport(text, format), data.options, data.manifest.versions, pivot), error: '' }; }
    catch (error) { return { recognized: [], warnings: [], error: (error as Error).message }; }
  }, [text, format, data, pivot]);
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="import-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border border-line bg-surface p-5 text-ink shadow-panel backdrop:bg-black/60">
    <div className="flex items-center justify-between gap-3"><h2 id="import-title" className="text-xl font-semibold">Import flags</h2><Button onClick={onClose} aria-label="Close import">Close</Button></div>
    <p className="my-3 text-sm text-muted">Paste flags or open a file. Everything stays in your browser. Preview the match against the catalogue before changing your saved selection.</p>
    <div className="flex flex-wrap items-center gap-3">
      <label>Format <select value={format} onChange={e => setFormat(e.target.value as ImportFormat)} className="rounded border bg-bg p-2"><option value="text">Text / compile_flags.txt</option><option value="ant">Ant XML</option><option value="json">GCC Explorer JSON</option></select></label>
      <label className="min-w-0">Choose file<input className="block max-w-full text-sm" type="file" accept=".txt,.xml,.json,.args,.rsp,text/plain,application/json,application/xml" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        setFileError('');
        if (file.size > 1_000_000) { setFileError('File is too large (maximum 1 MB).'); return; }
        try { const content = await file.text(); setText(content); setFormat(file.name.endsWith('.xml') ? 'ant' : file.name.endsWith('.json') ? 'json' : 'text'); }
        catch { setFileError('Unable to read the file.'); }
      }} /></label>
    </div>
    <label className="mt-4 block">Input<textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={'-Wall -Wextra\n-O2 -D_FORTIFY_SOURCE=2'} className="mt-1 min-h-36 w-full rounded-lg border bg-bg p-3 font-mono text-sm" /></label>
    <p className="my-2 text-xs text-muted">Text supports quotes, line continuations and # comments. Ant supports compilerarg/linkerarg value and line. Build variables, response files and scripts are never evaluated. Argument values and linker suboptions are not validated.</p>
    <div aria-live="polite">
      {(fileError || (text.trim() && preview.error)) && <p role="alert" className="my-3 text-danger">{fileError || preview.error}</p>}
      <h3 className="mt-4 font-semibold">{preview.recognized.length} recognized flags · GCC {pivot}</h3>
      <ul className="my-2 max-h-48 overflow-auto rounded border p-3 text-sm">{preview.recognized.map(f => <li className="break-all" key={f.flag}><code>{f.flag}</code>{f.unavailable && <span className="text-warn"> — unavailable in GCC {pivot}</span>}</li>)}</ul>
      {!!preview.warnings.length && <div className="my-3 rounded border border-warn p-3 text-sm text-warn"><strong>{preview.warnings.length} items will not be imported</strong><ul className="max-h-40 overflow-auto">{preview.warnings.map((w,i) => <li className="break-all" key={i}>{w}</li>)}</ul></div>}
    </div>
    <label className="my-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />Replace the current selection (otherwise merge)</label>
    <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!preview.recognized.length || !!fileError || !!preview.error} onClick={() => { if (replace) clearSelection(); addOptions(preview.recognized); onClose(); }}>Import {preview.recognized.length} flags</Button></div>
  </dialog>;
}
