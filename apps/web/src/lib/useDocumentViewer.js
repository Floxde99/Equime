import { useState } from 'react';

/**
 * Ouvre un document protégé (blob, authentification requise) dans un nouvel
 * onglet.
 *
 * L'onglet est ouvert **avant** la requête : appeler `window.open()` après un
 * `await` sort du geste utilisateur et se fait bloquer comme une pop-up. Pas
 * de `noopener`, sinon `window.open` renvoie `null` et l'on perd la
 * référence nécessaire pour y charger le blob une fois récupéré.
 */
export function useDocumentViewer() {
  const [openingKey, setOpeningKey] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));

  /**
   * @param {string} key Identifie le document ouvert, pour piloter l'état de chargement d'un bouton précis
   * @param {() => Promise<Blob>} fetchBlob
   */
  async function open(key, fetchBlob) {
    const tab = window.open('', '_blank');
    setOpeningKey(key);
    setError(null);
    try {
      const blob = await fetchBlob();
      const url = URL.createObjectURL(blob);
      if (tab) tab.location = url;
      else window.location.assign(url); // pop-ups bloquées : repli même onglet
      // Révocation différée : révoquer immédiatement couperait le chargement.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      setError(err?.message ?? 'Document indisponible.');
    } finally {
      setOpeningKey(null);
    }
  }

  return { open, openingKey, error };
}
