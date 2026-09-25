/**
 * Énumérations métier — source unique de vérité front/back.
 * Les valeurs sont strictement alignées sur les enums du schéma Prisma
 * (apps/api/prisma/schema.prisma) ; les libellés français vivent dans labels.js.
 */

/** @param {Record<string, string>} obj */
const values = (obj) => Object.freeze(Object.values(obj));

/** Rôles applicatifs. `visitor` désigne un utilisateur non connecté (jamais persisté). */
export const ROLES = Object.freeze({
  CLIENT: 'client',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin',
});
export const ROLE_VALUES = values(ROLES);

/** Niveaux cavalier (fédération : initiation puis Galops 1 à 7). */
export const RIDER_LEVELS = Object.freeze({
  INITIATION: 'initiation',
  GALOP_1: 'galop_1',
  GALOP_2: 'galop_2',
  GALOP_3: 'galop_3',
  GALOP_4: 'galop_4',
  GALOP_5: 'galop_5',
  GALOP_6: 'galop_6',
  GALOP_7: 'galop_7',
});
export const RIDER_LEVEL_VALUES = values(RIDER_LEVELS);

/** Ordre croissant des niveaux, pour comparer cavalier/cheval (attribution). */
export const RIDER_LEVEL_ORDER = RIDER_LEVEL_VALUES;

/** Statut de validation d'un document cavalier (certificat médical, licence). */
export const DOCUMENT_STATUS = Object.freeze({
  MISSING: 'missing',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});
export const DOCUMENT_STATUS_VALUES = values(DOCUMENT_STATUS);

export const HORSE_STATUS = Object.freeze({
  FIT: 'fit',
  REST: 'rest',
  UNAVAILABLE: 'unavailable',
  INJURED: 'injured',
});
export const HORSE_STATUS_VALUES = values(HORSE_STATUS);

export const AFFINITY_TYPES = Object.freeze({
  FAVORITE: 'favorite',
  NEUTRAL: 'neutral',
  AVOID: 'avoid',
});
export const AFFINITY_TYPE_VALUES = values(AFFINITY_TYPES);

export const SPACE_TYPES = Object.freeze({
  INDOOR: 'indoor',
  OUTDOOR: 'outdoor',
  PADDOCK: 'paddock',
  STALL: 'stall',
});
export const SPACE_TYPE_VALUES = values(SPACE_TYPES);

/** Espaces de pratique (cours) — hors boxes / stalles. */
export const RIDING_SPACE_TYPE_VALUES = Object.freeze(
  SPACE_TYPE_VALUES.filter((type) => type !== SPACE_TYPES.STALL)
);

export const COURSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});
export const COURSE_STATUS_VALUES = values(COURSE_STATUS);

export const RECURRENCE_FREQUENCIES = Object.freeze({
  WEEKLY: 'weekly',
});
export const RECURRENCE_FREQUENCY_VALUES = values(RECURRENCE_FREQUENCIES);

export const ATTENDANCE_STATUS = Object.freeze({
  PENDING: 'pending',
  PRESENT: 'present',
  ABSENT: 'absent',
  EXCUSED: 'excused',
});
export const ATTENDANCE_STATUS_VALUES = values(ATTENDANCE_STATUS);

export const EVENT_TYPES = Object.freeze({
  STAGE: 'stage',
  COMPETITION_INTERNAL: 'competition_internal',
  COMPETITION_EXTERNAL: 'competition_external',
});
export const EVENT_TYPE_VALUES = values(EVENT_TYPES);

export const REGISTRATION_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
});
export const REGISTRATION_STATUS_VALUES = values(REGISTRATION_STATUS);

export const INVOICE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
});
export const INVOICE_STATUS_VALUES = values(INVOICE_STATUS);

export const HEALTH_LOG_TYPES = Object.freeze({
  VETERINARIAN: 'veterinarian',
  FARRIER: 'farrier',
  DENTIST: 'dentist',
  CARE: 'care',
  OBSERVATION: 'observation',
});
export const HEALTH_LOG_TYPE_VALUES = values(HEALTH_LOG_TYPES);

export const INCIDENT_SEVERITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});
export const INCIDENT_SEVERITY_VALUES = values(INCIDENT_SEVERITIES);

export const INCIDENT_STATUS = Object.freeze({
  OPEN: 'open',
  RESOLVED: 'resolved',
});
export const INCIDENT_STATUS_VALUES = values(INCIDENT_STATUS);

/** Types de notification — alignés sur les templates email (notifier.js, Phase 5). */
export const NOTIFICATION_TYPES = Object.freeze({
  SUBSCRIPTION_CONFIRMED: 'subscription_confirmed',
  INVOICE_CREATED: 'invoice_created',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  INVOICE_REMINDER: 'invoice_reminder',
  REGISTRATION_CONFIRMED: 'registration_confirmed',
  COURSE_ENROLLED: 'course_enrolled',
  COURSE_CANCELLED: 'course_cancelled',
  RIDER_ABSENCE: 'rider_absence',
});
export const NOTIFICATION_TYPE_VALUES = values(NOTIFICATION_TYPES);

/** Inscription à une séance : active, ou annulée (place libérée) — ADR 011. */
export const ENROLLMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
});
export const ENROLLMENT_STATUS_VALUES = values(ENROLLMENT_STATUS);

/** Droit consommé par une inscription. */
export const ENROLLMENT_ENTITLEMENTS = Object.freeze({
  SUBSCRIPTION: 'subscription',
  MAKEUP: 'makeup',
  FORCED: 'forced',
});
export const ENROLLMENT_ENTITLEMENT_VALUES = values(ENROLLMENT_ENTITLEMENTS);

/** Échéancier d'un forfait de saison. */
export const PAYMENT_SCHEDULES = Object.freeze({
  QUARTERLY: 'quarterly',
  TEN_INSTALLMENTS: 'ten_installments',
});
export const PAYMENT_SCHEDULE_VALUES = values(PAYMENT_SCHEDULES);

export const RIDER_SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'active',
  ENDED: 'ended',
});
export const RIDER_SUBSCRIPTION_STATUS_VALUES = values(RIDER_SUBSCRIPTION_STATUS);

/** Origine d'un crédit de rattrapage. */
export const SESSION_CREDIT_SOURCES = Object.freeze({
  CANCELLED_IN_TIME: 'cancelled_in_time',
  CLUB_CANCELLATION: 'club_cancellation',
});
export const SESSION_CREDIT_SOURCE_VALUES = values(SESSION_CREDIT_SOURCES);

/** Modes de règlement (en ligne et au club). */
export const PAYMENT_METHODS = Object.freeze({
  CARD_ONLINE: 'card_online',
  CARD_ONSITE: 'card_onsite',
  CASH: 'cash',
  CHEQUE: 'cheque',
  TRANSFER: 'transfer',
  ANCV: 'ancv',
  PASS_SPORT: 'pass_sport',
  OTHER: 'other',
});
export const PAYMENT_METHOD_VALUES = values(PAYMENT_METHODS);
