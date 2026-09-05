import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names so that a caller can always override a component's
 * defaults.
 *
 * Plain `clsx` concatenates, which leaves conflicting utilities to fight it
 * out on CSS source order — so `hidden md:inline-flex` passed to a component
 * whose base already says `inline-flex` silently loses, and the element stays
 * visible on mobile. `twMerge` resolves the conflict in favour of the later
 * class, which is what "override" is supposed to mean.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
