import { cn } from '@/lib/utils.js';

const VARIANTS = {
  default: 'border-border bg-surface-raised text-muted',
  success: 'border-success/30 bg-success/15 text-success',
  warning: 'border-warning/30 bg-warning/15 text-warning',
  danger: 'border-danger/30 bg-danger/15 text-danger',
  info: 'border-info/30 bg-info/15 text-info',
};

/**
 * Badge sémantique (design system §2).
 * @param {{ children: import('react').ReactNode, variant?: keyof typeof VARIANTS, className?: string }} props
 */
export function Badge({ children, variant = 'default', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-sans text-xs font-semibold',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
