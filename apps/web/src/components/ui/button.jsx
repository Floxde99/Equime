import { cn } from '@/lib/utils.js';

/**
 * Bouton du design system (§5) — hauteur 44px minimum (cible tactile),
 * or réservé à l'action primaire (« l'or est rare »).
 *
 * @param {object} props
 * @param {'primary' | 'secondary' | 'ghost' | 'danger'} [props.variant]
 * @param {boolean} [props.loading]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 * @param {any} [props.rest]
 */
export function Button({ variant = 'primary', loading = false, className, children, ...rest }) {
  const variants = {
    primary: 'bg-primary text-primary-fg hover:bg-primary-light',
    secondary: 'border border-border bg-surface text-text hover:bg-surface-raised',
    ghost: 'text-muted hover:bg-surface hover:text-text',
    danger: 'bg-danger text-text hover:opacity-90',
  };

  return (
    <button
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 font-sans text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
