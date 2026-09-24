import { Link } from 'react-router';

export const LEGAL_PAGES = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/cgv', label: 'Conditions générales de vente' },
];

/**
 * Liens vers les pages légales (pied de page vitrine et pages légales).
 * @param {{ className?: string }} props
 */
export function LegalLinks({ className }) {
  return (
    <nav aria-label="Informations légales" className={className}>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 font-sans text-xs text-muted-on-card">
        {LEGAL_PAGES.map((page) => (
          <li key={page.to}>
            <Link to={page.to} className="hover:text-primary hover:underline">
              {page.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
