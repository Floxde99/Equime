import { forwardRef, useId } from 'react';

import { cn } from '@/lib/utils.js';

/**
 * Liste déroulante du design system.
 * `forwardRef` requis par react-hook-form (`register`).
 */
export const Select = forwardRef(
  /**
   * @param {import('react').SelectHTMLAttributes<HTMLSelectElement> & {
   *   label?: string, error?: string, options: Array<{ value: string, label: string }>
   * }} props
   * @param {React.Ref<HTMLSelectElement>} ref
   */
  function Select({ label, error, options, className, id, ...props }, ref) {
    const generatedId = useId();
    const selectId = id ?? props.name ?? generatedId;
    return (
      <div className="space-y-1.5">
        {label ? (
          <label
            htmlFor={selectId}
            className="block font-sans text-sm font-medium uppercase tracking-wide text-muted-on-card"
          >
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-11 w-full rounded-lg border border-border-on-card bg-card px-3 font-sans text-sm text-on-card',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
            error && 'border-danger',
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
        {error ? (
          <p role="alert" className="font-sans text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
