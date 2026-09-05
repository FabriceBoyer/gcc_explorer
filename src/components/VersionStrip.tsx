import { clsx } from 'clsx';

/**
 * Eight little cells, one per supported release: filled when the option exists
 * there. Reading a whole column of these is the fastest way to spot when an
 * option appeared or was removed.
 */
export function VersionStrip({
  mask, versions, size = 'md', highlight,
}: {
  mask: number;
  versions: number[];
  size?: 'sm' | 'md';
  highlight?: number;
}) {
  return (
    <span className="inline-flex items-center gap-[2px]" aria-hidden>
      {versions.map((v, i) => {
        const on = Boolean(mask & (1 << i));
        return (
          <span
            key={v}
            title={`GCC ${v}: ${on ? 'available' : 'not available'}`}
            className={clsx(
              'rounded-[2px] transition-colors',
              size === 'sm' ? 'h-2.5 w-[5px]' : 'h-3 w-[6px]',
              on ? 'bg-accent' : 'bg-surface-3',
              highlight === v && 'ring-1 ring-warn ring-offset-1 ring-offset-transparent',
            )}
          />
        );
      })}
    </span>
  );
}

/** Same idea with the version numbers spelled out — used in the detail panel. */
export function VersionMatrix({
  mask, versions, values,
}: {
  mask: number;
  versions: number[];
  values?: (string | null)[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {versions.map((v, i) => {
        const on = Boolean(mask & (1 << i));
        const value = values?.[i] ?? null;
        return (
          <div
            key={v}
            className={clsx(
              'flex min-w-[52px] flex-col items-center gap-0.5 rounded-lg border px-1.5 py-1 transition-colors',
              on ? 'border-line bg-surface-2' : 'border-dashed border-line bg-transparent opacity-45',
            )}
          >
            <span className="font-mono text-[12px] font-semibold">{v}</span>
            <span
              className={clsx(
                'text-[10px] leading-none',
                value === 'enabled' ? 'text-ok' : value === 'disabled' ? 'text-faint' : 'text-muted',
              )}
            >
              {!on ? '—' : value === 'enabled' ? 'on' : value === 'disabled' ? 'off'
                : value?.startsWith('n/a:') ? 'n/a' : (value || '·')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
