import { cn } from '@/lib/utils.js';

/**
 * @param {{ className?: string, lines?: number }} props
 */
export function Skeleton({ className, lines = 3 }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded-lg bg-border-on-card motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
