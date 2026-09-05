/** Small presentational primitives shared across the app. */
import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export function Badge({
  children, tone = 'neutral', className, style, title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const tones = {
    neutral: 'bg-surface-3 text-muted border-line',
    accent: 'bg-accent-soft text-accent-text border-transparent',
    ok: 'bg-ok-soft text-ok border-transparent',
    warn: 'bg-warn-soft text-warn border-transparent',
    danger: 'bg-danger-soft text-danger border-transparent',
  };
  return (
    <span
      title={title}
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap',
        !style && tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'outline', size = 'md', className, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-accent text-white hover:brightness-110 border-transparent shadow-sm',
    outline: 'bg-surface hover:bg-surface-2 border-line text-ink',
    ghost: 'bg-transparent hover:bg-surface-2 border-transparent text-muted hover:text-ink',
    danger: 'bg-danger-soft text-danger border-transparent hover:brightness-105',
  };
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-[background,color,filter,border-color] duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Toggle({
  checked, onChange, label, hint, disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      title={hint}
      className={clsx(
        'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-2',
      )}
    >
      <span
        className={clsx(
          'relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-3 border border-line',
        )}
      >
        <span
          className={clsx(
            'absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-white shadow transition-[left] duration-200',
            checked ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
      <span className="text-muted">{label}</span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function Checkbox({
  checked, indeterminate, onChange, ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      className="size-[15px] cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-surface transition-all
                 checked:border-accent checked:bg-accent
                 checked:after:absolute checked:after:content-['']
                 relative shrink-0
                 checked:after:left-[4px] checked:after:top-[1px] checked:after:h-[8px] checked:after:w-[4px]
                 checked:after:rotate-45 checked:after:border-b-2 checked:after:border-r-2 checked:after:border-white"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = Boolean(indeterminate) && !checked; }}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint" title={hint}>
      {children}
    </h3>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="mb-1 text-faint">{icon}</div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-[13px] text-muted">{children}</div>}
    </div>
  );
}
