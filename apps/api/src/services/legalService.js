// @ts-check
/**
 * Informations légales publiques de l'instance (mentions légales, politique de
 * confidentialité, CGV). Lues à l'exécution depuis la configuration : une même
 * image sert tous les clubs, chacun avec sa propre identité (modèle SaaS,
 * une instance par club).
 */
import { env } from '../config/env.js';

/**
 * @returns {{
 *   demo: boolean,
 *   club: { name: string, legalName: string, legalForm: string | null, registration: string | null,
 *     address: string, phone: string, email: string, publicationDirector: string | null,
 *     mediator: string | null },
 *   host: { name: string | null, address: string | null, phone: string | null },
 *   softwareProvider: string | null,
 * }}
 */
export function getPublicLegalInfo() {
  return {
    demo: env.LEGAL_DEMO_INSTANCE,
    club: {
      name: env.CLUB_NAME,
      legalName: env.CLUB_LEGAL_NAME ?? env.CLUB_NAME,
      legalForm: env.CLUB_LEGAL_FORM ?? null,
      registration: env.CLUB_REGISTRATION ?? null,
      address: env.CLUB_ADDRESS,
      phone: env.CLUB_PHONE,
      email: env.CLUB_EMAIL,
      publicationDirector: env.CLUB_PUBLICATION_DIRECTOR ?? null,
      mediator: env.CLUB_MEDIATOR ?? null,
    },
    host: {
      name: env.HOST_NAME ?? null,
      address: env.HOST_ADDRESS ?? null,
      phone: env.HOST_PHONE ?? null,
    },
    softwareProvider: env.SOFTWARE_PROVIDER ?? null,
  };
}
