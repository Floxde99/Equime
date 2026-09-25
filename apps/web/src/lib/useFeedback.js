import { useCallback, useMemo, useState } from 'react';

/**
 * Retour d'action d'un écran (succès ou erreur), typé explicitement.
 * Remplace la détection par mot-clé (`status.includes('créé')`) qui affichait
 * en vert une erreur serveur contenant le même mot.
 *
 * @returns {{
 *   value: null | { type: 'success' | 'error', message: string },
 *   success: (message: string) => void,
 *   error: (message: string) => void,
 *   clear: () => void,
 * }}
 */
export function useFeedback() {
  const [value, setValue] = useState(
    /** @type {null | { type: 'success' | 'error', message: string }} */ (null)
  );
  const success = useCallback((message) => setValue({ type: 'success', message }), []);
  const error = useCallback((message) => setValue({ type: 'error', message }), []);
  const clear = useCallback(() => setValue(null), []);
  return useMemo(() => ({ value, success, error, clear }), [value, success, error, clear]);
}
