import { Link } from 'react-router';

import { LegalPageLayout, LegalSection } from '@/features/legal/components/LegalPageLayout.jsx';

/**
 * Conditions générales de vente — modèle de démonstration, à adapter par chaque
 * club avant toute vente réelle. L'exception au droit de rétractation des stages
 * à date fixe (C. consom. L221-28 12°) doit être connue AVANT le paiement : elle
 * est aussi rappelée sur la page Factures.
 */
export function TermsPage() {
  return (
    <LegalPageLayout title="Conditions générales de vente">
      {(info) => (
        <>
          <p className="rounded-lg border border-border-on-card bg-card p-4">
            Modèle de conditions générales fourni avec le logiciel. Chaque club le complète et
            l’adapte à son activité avant toute vente réelle.
          </p>

          <LegalSection title="1. Objet">
            <p>
              Les présentes conditions régissent la vente, par {info.club.legalName}, des
              prestations proposées depuis l’espace famille : formules d’abonnement, cours, stages
              et événements.
            </p>
          </LegalSection>

          <LegalSection title="2. Prix et facturation">
            <p>
              Les prix sont indiqués en euros sur la vitrine et sur chaque facture émise par le
              club. La facture précise les prestations, le montant et, le cas échéant, sa date
              d’échéance.
            </p>
          </LegalSection>

          <LegalSection title="3. Paiement">
            <p>
              Les factures se règlent en ligne par l’intermédiaire de Stripe, prestataire de
              paiement sécurisé. Les données de carte bancaire sont saisies et traitées par Stripe ;
              le club n’y a jamais accès. Une facture n’est considérée comme payée qu’après
              confirmation de l’encaissement par Stripe.
            </p>
          </LegalSection>

          <LegalSection title="4. Droit de rétractation">
            <p>
              Pour un contrat conclu à distance, vous disposez d’un délai de 14 jours pour vous
              rétracter (article L221-18 du Code de la consommation). Si vous demandez que
              l’abonnement commence avant la fin de ce délai, le montant correspondant aux
              prestations déjà fournies reste dû (article L221-25).
            </p>
            <p className="font-semibold">
              Exception : les stages et événements fournis à une date ou une période déterminée ne
              sont pas soumis au droit de rétractation (article L221-28, 12° du Code de la
              consommation).
            </p>
          </LegalSection>

          <LegalSection title="5. Annulation par le club">
            <p>
              Si le club annule un cours, un stage ou un événement, la famille en est informée par
              notification et par email ; la prestation est reportée ou remboursée.
            </p>
          </LegalSection>

          <LegalSection title="6. Médiation de la consommation">
            <p>
              En cas de litige non résolu avec le club, vous pouvez recourir gratuitement à un
              médiateur de la consommation (article L612-1 du Code de la consommation) :{' '}
              {info.club.mediator ?? 'coordonnées à renseigner par le club'}.
            </p>
          </LegalSection>

          <LegalSection title="7. Données personnelles et droit applicable">
            <p>
              Le traitement de vos données est décrit dans la{' '}
              <Link to="/confidentialite" className="text-primary underline">
                politique de confidentialité
              </Link>
              . Les présentes conditions sont soumises au droit français.
            </p>
          </LegalSection>
        </>
      )}
    </LegalPageLayout>
  );
}
