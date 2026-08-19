import { cn } from '@/lib/utils.js';

/**
 * @param {import('react').SelectHTMLAttributes<HTMLSelectElement> & {
 *   label?: string, error?: string, options: Array<{ value: string, label: string }>
 * }} props
 */
export function Select({ label, error, options, className, id, ...props }) {
  const selectId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={selectId} className="font-sans text-sm font-medium uppercase tracking-wide text-muted">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          'w-full rounded-lg border border-border bg-background px-3 py-2 font-sans text-sm text-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <p className="font-sans text-sm text-danger">{error}</p> : null}
    </div>
  );
}
