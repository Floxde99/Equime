import { cn } from '@/lib/utils.js';

/**
 * Bouton du design system (§5) — « le vert est rare ».
 *
 * @param {object} props
 * @param {'primary' | 'secondary' | 'ghost' | 'danger'} [props.variant]
 * @param {boolean} [props.loading]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export function Button({ variant = 'primary', loading = false, className, children, ...rest }) {
  const variants = {
    primary: 'bg-primary text-primary-fg hover:bg-primary-light',
    secondary: 'border border-border-on-card bg-card text-on-card hover:bg-border-on-card/40',
    ghost: 'text-muted hover:bg-paper hover:text-on-card',
    danger: 'bg-danger text-danger-fg hover:opacity-90',
  };

  return (
    <button
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 font-sans text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
      {...rest}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
