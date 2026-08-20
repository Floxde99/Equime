import { useEffect, useId, useRef } from 'react';

import { cn } from '@/lib/utils.js';

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Éléments tabulables visibles dans un conteneur (piège de focus).
 *
 * @param {ParentNode | null} root
 * @returns {HTMLElement[]}
 */
function getFocusableElements(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter((node) => {
    if (!(node instanceof HTMLElement)) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    return node.getClientRects().length > 0;
  });
}

/**
 * Modale accessible (design system §5) : overlay, Échap, piège de focus, actions à droite.
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
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  // Assignation dans un effet, pas au render : React interdit d'ecrire
  // ref.current pendant le rendu (un rendu abandonne muterait quand meme la ref).
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const initialFocus = getFocusableElements(dialog)[0] ?? dialog;
    initialFocus?.focus();

    /**
     * @param {KeyboardEvent} event
     */
    function onKey(event) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || (dialogRef.current && !dialogRef.current.contains(active))) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || (dialogRef.current && !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-ink/80"
        aria-label="Fermer la fenêtre"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-h-[80vh] overflow-y-auto rounded-xl border border-border-on-card bg-card p-5 text-on-card shadow-2xl',
          className ?? 'max-w-md'
        )}
      >
        <h2 id={titleId} className="font-sans text-lg font-semibold">
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
            className="inline-flex h-11 items-center rounded-lg bg-danger px-6 font-sans text-sm font-semibold text-danger-fg disabled:opacity-50"
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
