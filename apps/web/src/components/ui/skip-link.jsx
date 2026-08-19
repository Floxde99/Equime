import { onInPageAnchorClick } from '@/lib/inPageScroll.js';

/**
 * Lien d'évitement RGAA — premier élément focusable des layouts.
 * @param {{ href?: string }} props
 */
export function SkipLink({ href = '#contenu' }) {
  return (
    <a
      href={href}
      className="absolute left-4 top-4 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-2 font-sans text-sm font-semibold text-primary-fg focus:translate-y-0"
      onClick={onInPageAnchorClick}
    >
      Aller au contenu
    </a>
  );
}
