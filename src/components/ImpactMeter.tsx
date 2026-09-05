import { clsx } from 'clsx';
import type { Axis } from '../lib/impact';
import { AXIS_LABEL, levelLabel, SOURCE_LABEL } from '../lib/impact';
import type { Impact } from '../lib/types';

/**
 * Three segments that fill up with the cost, so a column of them can be
 * skimmed. "Improves" is drawn as a single green segment pointing the other
 * way; "varies" as an outline, because pretending to know is worse than
 * saying we do not.
 */
export function ImpactMeter({
  score, axis, source, className,
}: {
  score: number | null;
  axis: Axis;
  source?: Impact['s'];
  className?: string;
}) {
  const title = `${AXIS_LABEL[axis]}: ${levelLabel(score)}${source ? ` (${SOURCE_LABEL[source]})` : ''}`;

  if (score === null) {
    return (
      <span className={clsx('inline-flex items-center gap-[3px]', className)} title={title}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-3 w-[5px] rounded-[2px] border border-dashed border-line-strong" />
        ))}
      </span>
    );
  }

  if (score === -1) {
    return (
      <span className={clsx('inline-flex items-center gap-[3px]', className)} title={title}>
        <span className="h-3 w-[5px] rounded-[2px] bg-ok" />
        <span className="h-3 w-[5px] rounded-[2px] bg-surface-3" />
        <span className="h-3 w-[5px] rounded-[2px] bg-surface-3" />
      </span>
    );
  }

  const colour = score >= 3 ? 'bg-danger' : score === 2 ? 'bg-warn' : 'bg-accent';
  return (
    <span className={clsx('inline-flex items-center gap-[3px]', className)} title={title}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={clsx('h-3 w-[5px] rounded-[2px]', i <= score ? colour : 'bg-surface-3')}
        />
      ))}
    </span>
  );
}

/** The meter plus its word, for the detail panel. */
export function ImpactRow({
  axis, score, source, ratio,
}: {
  axis: Axis;
  score: number | null;
  source: Impact['s'];
  ratio?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-1.5">
      <ImpactMeter score={score} axis={axis} source={source} />
      <span className="text-[12.5px] text-muted">{AXIS_LABEL[axis]}</span>
      <span
        className={clsx(
          'ml-auto text-[12.5px] font-medium',
          score === null ? 'text-faint'
            : score === -1 ? 'text-ok'
              : score >= 3 ? 'text-danger'
                : score === 2 ? 'text-warn' : 'text-ink',
        )}
      >
        {levelLabel(score)}
      </span>
      {ratio && <span className="font-mono text-[11px] text-faint">{ratio}</span>}
    </div>
  );
}
