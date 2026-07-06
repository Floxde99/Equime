import { cn } from '@/lib/utils.js';

/**
 * Message d'état d'un formulaire (erreur serveur, confirmation).
 * @param {{ variant?: 'error' | 'success' | 'info', className?: string, children: React.ReactNode }} props
 */
export function Alert({ variant = 'error', className, children }) {
  const variants = {
    error: 'border-danger/40 bg-danger/10 text-danger',
    success: 'border-success/40 bg-success/10 text-success',
    info: 'border-info/40 bg-info/10 text-info',
  };
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 font-sans text-sm', variants[variant], className)}
    >
      {children}
    </div>
  );
}
