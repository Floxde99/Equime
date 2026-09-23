import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/apiClient.js';

/**
 * Identité légale de l'instance (éditeur, hébergeur, fournisseur du logiciel).
 * Lue à l'exécution : une même image sert tous les clubs (modèle SaaS).
 */
export function fetchLegalInfo() {
  return apiFetch('/public/legal');
}

export function useLegalInfo() {
  return useQuery({
    queryKey: ['legal-info'],
    queryFn: fetchLegalInfo,
    staleTime: Infinity,
  });
}
