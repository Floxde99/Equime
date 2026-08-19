/**
 * Libellés français des énumérations — affichage front (badges, filtres, formulaires)
 * et emails. Clés strictement alignées sur constants.js.
 */

/** @type {Record<string, string>} */
export const ROLE_LABELS = Object.freeze({
  client: 'Client',
  instructor: 'Moniteur',
  admin: 'Administrateur',
});

/** @type {Record<string, string>} */
export const RIDER_LEVEL_LABELS = Object.freeze({
  initiation: 'Initiation',
  galop_1: 'Galop 1',
  galop_2: 'Galop 2',
  galop_3: 'Galop 3',
  galop_4: 'Galop 4',
  galop_5: 'Galop 5',
  galop_6: 'Galop 6',
  galop_7: 'Galop 7',
});

/** @type {Record<string, string>} */
export const DOCUMENT_STATUS_LABELS = Object.freeze({
  missing: 'Manquant',
  pending: 'En attente de validation',
  approved: 'Validé',
  rejected: 'Refusé',
});

/** @type {Record<string, string>} */
export const HORSE_STATUS_LABELS = Object.freeze({
  fit: 'En forme',
  rest: 'Au repos',
  unavailable: 'Indisponible',
  injured: 'Blessé',
});

/** @type {Record<string, string>} */
export const AFFINITY_TYPE_LABELS = Object.freeze({
  favorite: 'Favori',
  neutral: 'Neutre',
  avoid: 'À éviter',
});

/** @type {Record<string, string>} */
export const SPACE_TYPE_LABELS = Object.freeze({
  indoor: 'Manège couvert',
  outdoor: 'Carrière extérieure',
  paddock: 'Paddock',
  stall: 'Box / stalle',
});

/** Groupes d’affichage occupation / onglet espaces. */
export const SPACE_GROUP_LABELS = Object.freeze({
  stall: 'Boxes',
  paddock: 'Paddocks',
  arena: 'Manèges & carrières',
});

/** @type {Record<string, string>} */
export const COURSE_STATUS_LABELS = Object.freeze({
  draft: 'Brouillon',
  scheduled: 'Programmé',
  ongoing: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
});

/** @type {Record<string, string>} */
export const RECURRENCE_FREQUENCY_LABELS = Object.freeze({
  weekly: 'Hebdomadaire',
});

/** @type {Record<string, string>} */
export const ATTENDANCE_STATUS_LABELS = Object.freeze({
  pending: 'En attente',
  present: 'Présent',
  absent: 'Absent',
  excused: 'Excusé',
});

/** @type {Record<string, string>} */
export const EVENT_TYPE_LABELS = Object.freeze({
  stage: 'Stage',
  competition_internal: 'Compétition interne',
  competition_external: 'Compétition externe',
});

/** @type {Record<string, string>} */
export const REGISTRATION_STATUS_LABELS = Object.freeze({
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
});

/** @type {Record<string, string>} */
export const INVOICE_STATUS_LABELS = Object.freeze({
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
});

/** @type {Record<string, string>} */
export const HEALTH_LOG_TYPE_LABELS = Object.freeze({
  veterinarian: 'Vétérinaire',
  farrier: 'Maréchal-ferrant',
  dentist: 'Dentiste',
  care: 'Soins',
  observation: 'Observation',
});

/** @type {Record<string, string>} */
export const INCIDENT_SEVERITY_LABELS = Object.freeze({
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  critical: 'Critique',
});

/** @type {Record<string, string>} */
export const INCIDENT_STATUS_LABELS = Object.freeze({
  open: 'Ouvert',
  resolved: 'Résolu',
});

/** @type {Record<string, string>} */
export const NOTIFICATION_TYPE_LABELS = Object.freeze({
  subscription_confirmed: 'Abonnement confirmé',
  invoice_created: 'Nouvelle facture',
  payment_confirmed: 'Paiement confirmé',
  invoice_reminder: 'Relance de facture',
  registration_confirmed: 'Inscription confirmée',
  course_enrolled: 'Inscription à un cours',
  course_cancelled: 'Cours annulé',
  rider_absence: 'Absence signalée',
});
