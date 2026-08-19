import { useEffect } from 'react';

import { cn } from '@/lib/utils.js';

/**
 * Modale accessible (design system §5) : overlay, Échap, actions à droite.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   children?: import('react').ReactNode,
 *   footer?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function Dialog({ open, onClose, title, children, footer, className }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/80"
        aria-label="Fermer la fenêtre"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn(
          'relative z-10 w-full max-h-[80vh] overflow-y-auto rounded-xl border border-border-on-card bg-card p-5 text-on-card shadow-2xl',
          className ?? 'max-w-md'
        )}
      >
        <h2 id="dialog-title" className="font-sans text-lg font-semibold">
          {title}
        </h2>
        {children ? (
          <div className="mt-3 font-sans text-sm text-muted-on-card">{children}</div>
        ) : null}
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * Confirmation destructive nommant l'objet (design system §8).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onConfirm: () => void,
 *   title: string,
 *   confirmLabel?: string,
 *   loading?: boolean,
 * }} props
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel = 'Confirmer',
  loading = false,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            type="button"
            className="inline-flex h-11 items-center rounded-lg border border-border-on-card px-6 font-sans text-sm font-semibold text-on-card"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center rounded-lg bg-danger px-6 font-sans text-sm font-semibold text-white disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
          >
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
