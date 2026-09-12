import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DatasetProvider } from './lib/dataset-context';
import { useStore } from './lib/store';
import { TopBar } from './components/TopBar';
import { LoadingScreen } from './components/LoadingScreen';

const HomePage = lazy(() => import('./pages/HomePage'));
const ExplorerPage = lazy(() => import('./pages/ExplorerPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const SelectionPage = lazy(() => import('./pages/SelectionPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));

export default function App() {
  const theme = useStore((s) => s.theme);

  // The inline script in index.html sets the initial class; keep the DOM in
  // sync with the store once React has rehydrated it from localStorage.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <DatasetProvider>
      <div className="flex h-dvh flex-col overflow-clip bg-bg text-ink">
        <TopBar />
        {/* overflow-clip, not hidden: a hidden overflow can still be scrolled
            programmatically by scrollIntoView, which would shift the whole shell. */}
        <main className="min-h-0 flex-1 overflow-clip">
          <Suspense fallback={<LoadingScreen label="Loading view…" />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/explorer" element={<ExplorerPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/selection" element={<SelectionPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </DatasetProvider>
  );
}
