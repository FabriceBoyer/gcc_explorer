/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { loadDataset, loadDocs } from './dataset';
import type { Dataset, LoadPhase } from './dataset';
import type { Docs } from './types';

interface DatasetState {
  data: Dataset | null;
  error: Error | null;
  phase: LoadPhase;
  docs: Docs | null;
  docsLoading: boolean;
  requestDocs: () => void;
}

const Ctx = createContext<DatasetState | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [phase, setPhase] = useState<LoadPhase>('manifest');
  const [docs, setDocs] = useState<Docs | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  /** Set as soon as a docs fetch is in flight, so it only ever happens once. */
  const docsStarted = useRef(false);
  const [pendingDocs, setPendingDocs] = useState(false);

  useEffect(() => {
    let alive = true;
    loadDataset((p) => alive && setPhase(p.phase))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => { alive = false; };
  }, []);

  // The long manual texts are ~1.3 MB, so they are only fetched once something
  // actually needs them (opening the detail panel, or the docs page).
  const startDocs = useCallback((hash: string) => {
    if (docsStarted.current) return;
    docsStarted.current = true;
    setDocsLoading(true);
    loadDocs(hash)
      .then(setDocs)
      .catch(() => setDocs({ docs: {}, samples: [] }))
      .finally(() => setDocsLoading(false));
  }, []);

  const requestDocs = useCallback(() => {
    if (data) startDocs(data.manifest.hash);
    else setPendingDocs(true);
  }, [data, startDocs]);

  // Something asked for the manual before the index had finished loading.
  useEffect(() => {
    if (pendingDocs && data) startDocs(data.manifest.hash);
  }, [pendingDocs, data, startDocs]);

  const value = useMemo<DatasetState>(
    () => ({ data, error, phase, docs, docsLoading, requestDocs }),
    [data, error, phase, docs, docsLoading, requestDocs],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataset(): DatasetState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDataset must be used inside <DatasetProvider>');
  return ctx;
}

/** Convenience hook for pages that cannot render without the dataset. */
export function useReadyDataset(): Dataset | null {
  return useDataset().data;
}
