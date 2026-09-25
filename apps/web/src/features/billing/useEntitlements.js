import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { fetchEntitlements } from '@/features/billing/api.js';

export const ENTITLEMENTS_KEY = ['entitlements'];

/**
 * Droits de la famille (ADR 011) : forfait, séances de la semaine et rattrapages
 * par cavalier. Source unique du compteur affiché partout côté famille.
 */
export function useEntitlements() {
  return useQuery({ queryKey: ENTITLEMENTS_KEY, queryFn: fetchEntitlements });
}

/**
 * @param {{ riders?: Array<{ riderId: string }> } | undefined} data
 * @param {string | undefined} riderId
 */
export function entitlementOf(data, riderId) {
  return data?.riders?.find((rider) => rider.riderId === riderId) ?? null;
}

/**
 * Rafraîchit tout ce qui dépend des droits après une inscription, une
 * annulation ou une souscription.
 */
export function useRefreshEntitlements() {
  const qc = useQueryClient();
  return useCallback(() => {
    for (const key of [
      ENTITLEMENTS_KEY,
      ['enrollable'],
      ['my-enrollments'],
      ['planning'],
      ['client-invoices'],
    ]) {
      qc.invalidateQueries({ queryKey: key });
    }
  }, [qc]);
}
