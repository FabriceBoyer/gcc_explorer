import { Loader2 } from 'lucide-react';

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
      <Loader2 className="size-5 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="flex flex-col gap-px p-1">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="skeleton h-9 rounded-md" style={{ opacity: 1 - i * 0.055 }} />
      ))}
    </div>
  );
}
