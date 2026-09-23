import {
  LegalItem,
  LegalPageLayout,
  LegalSection,
} from '@/features/legal/components/LegalPageLayout.jsx';

/** Finalités et bases légales (RGPD art. 6) — source : docs/rgpd.md §1. */
const PURPOSES = [
  ['Comptes et authentification', 'Identité, email, mot de passe (haché), rôle', 'Contrat'],
  ['Familles et cavaliers', 'Identité, date de naissance, niveau', 'Contrat'],
  ['Dossier administratif', 'Certificat médical, licence', 'Consentement explicite'],
  ['Planning, présences, chevaux', 'Inscriptions, présences, affinités', 'Contrat'],
  ['Facturation', 'Coordonnées, factures, statut de paiement', 'Obligation légale et contrat'],
  ['Messagerie, incidents, bénévolat', 'Contenus saisis', 'Contrat, intérêt légitime (sécurité)'],
  ['Notifications', 'Préférences, historique', 'Contrat'],
  ['Newsletter', 'Email, date du consentement', 'Consentement'],
];

/** Durées de conservation — source : docs/rgpd.md §6. */
const RETENTION = [
  ['Compte actif', 'Durée de la relation'],
  ['Certificats médicaux', 'Saison sportive + 1 an'],
  ['Factures et pièces comptables', '10 ans (Code de commerce)'],
  ['Journaux techniques', '12 mois glissants'],
  ['Newsletter', 'Jusqu’à la désinscription'],
];

/**
 * Politique de confidentialité (RGPD art. 13). Le club est responsable de
 * traitement ; le fournisseur du logiciel est son sous-traitant (art. 28).
 */
export function PrivacyPage() {
  return (
    <LegalPageLayout title="Politique de confidentialité">
      {(info) => (
        <>
          <LegalSection title="Responsable du traitement">
            <dl className="space-y-1">
              <LegalItem label="Club" value={info.club.legalName} />
              <LegalItem label="Adresse" value={info.club.address} />
              <LegalItem label="Contact" value={info.club.email} />
            </dl>
          </LegalSection>

          <LegalSection title="Données, finalités et bases légales">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border-on-card">
                    <th scope="col" className="py-2 pr-4">
                      Finalité
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      Données
                    </th>
                    <th scope="col" className="py-2">
                      Base légale
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PURPOSES.map(([purpose, data, basis]) => (
                    <tr key={purpose} className="border-b border-border-on-card align-top">
                      <td className="py-2 pr-4">{purpose}</td>
                      <td className="py-2 pr-4">{data}</td>
                      <td className="py-2">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Le certificat médical est une donnée de santé : il n’est téléversé qu’après un
              consentement explicite, que vous pouvez retirer à tout moment. Sans ce consentement,
              aucun fichier médical n’est traité.
            </p>
          </LegalSection>

          <LegalSection title="Destinataires et sous-traitants">
            <ul className="list-disc space-y-1 pl-5">
              <li>Le personnel habilité du club (administration, moniteurs).</li>
              <li>
                {info.softwareProvider ?? 'Le fournisseur du logiciel Equime'} : sous-traitant du
                club (article 28 du RGPD).
              </li>
              <li>{info.host.name ?? 'L’hébergeur'} : hébergement des serveurs.</li>
              <li>
                Stripe : paiement en ligne. La saisie de la carte bancaire se fait chez Stripe ; le
                club ne conserve aucune donnée de carte.
              </li>
              <li>SendGrid : envoi des emails transactionnels.</li>
            </ul>
            <p>
              Lorsque des données sont transférées hors de l’Union européenne (Stripe, SendGrid),
              ces transferts sont encadrés par les garanties du chapitre V du RGPD (décision
              d’adéquation ou clauses contractuelles types). Aucune donnée n’est vendue ni utilisée
              à des fins publicitaires.
            </p>
          </LegalSection>

          <LegalSection title="Durées de conservation">
            <dl className="space-y-1">
              {RETENTION.map(([label, value]) => (
                <LegalItem key={label} label={label} value={value} />
              ))}
            </dl>
          </LegalSection>

          <LegalSection title="Cookies">
            <p>
              Ce site dépose un seul cookie, <code>equime_refresh</code>, strictement nécessaire au
              maintien de votre session sécurisée (inaccessible au JavaScript). Conformément aux
              lignes directrices de la CNIL (délibération n° 2020-091), il est exempté de
              consentement. Aucun cookie publicitaire ni de mesure d’audience n’est utilisé, et les
              polices de caractères sont hébergées localement.
            </p>
          </LegalSection>

          <LegalSection title="Vos droits">
            <p>
              Vous disposez des droits d’accès, de rectification, d’effacement, de limitation,
              d’opposition et de portabilité, ainsi que du droit de retirer votre consentement.
              Depuis « Mon compte », vous pouvez exporter vos données (format JSON) et supprimer
              votre compte. Pour les autres demandes, écrivez au club : {info.club.email}.
            </p>
            <p>
              Vous pouvez introduire une réclamation auprès de la CNIL (
              <a
                href="https://www.cnil.fr/fr/plaintes"
                className="text-primary underline"
                rel="noreferrer"
                target="_blank"
              >
                cnil.fr
              </a>
              ).
            </p>
          </LegalSection>
        </>
      )}
    </LegalPageLayout>
  );
}
