import { cn } from '@/lib/utils.js';

/**
 * Groupe label + champ + erreur, accessible :
 * le message d'erreur est relié au champ via aria-describedby par l'appelant.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.htmlFor
 * @param {string} [props.error] Message d'erreur (react-hook-form)
 * @param {string} [props.hint] Aide affichée sous le champ (ex. politique de mot de passe)
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export function Field({ label, htmlFor, error, hint, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block font-sans text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {hint && !error && <p className="font-sans text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="font-sans text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
