import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';

/**
 * États TanStack Query : skeleton, erreur + réessayer, ou contenu.
 *
 * @param {{
 *   isPending?: boolean,
 *   isError?: boolean,
 *   error?: { message?: string } | null,
 *   onRetry?: () => void,
 *   skeleton?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 * }} props
 */
export function QueryState({ isPending, isError, error, onRetry, skeleton, children }) {
  if (isPending) return skeleton ?? <Skeleton />;
  if (isError) {
    return (
      <Alert>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error?.message ?? 'Chargement impossible'}</span>
          {onRetry ? (
            <Button type="button" variant="secondary" onClick={onRetry}>
              Réessayer
            </Button>
          ) : null}
        </div>
      </Alert>
    );
  }
  return children;
}
