import { cloneElement, isValidElement } from 'react';

import { cn } from '@/lib/utils.js';

/**
 * Groupe label + champ + erreur. Relie automatiquement aria-describedby.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.htmlFor
 * @param {string} [props.error]
 * @param {string} [props.hint]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export function Field({ label, htmlFor, error, hint, className, children }) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? htmlFor,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-describedby': children.props['aria-describedby'] ?? describedBy,
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block font-sans text-sm font-medium uppercase tracking-wide text-muted-on-card"
      >
        {label}
      </label>
      {child}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="font-sans text-xs text-muted-on-card">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="font-sans text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
