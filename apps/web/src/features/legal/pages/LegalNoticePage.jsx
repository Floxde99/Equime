import { Link } from 'react-router';

import {
  LegalItem,
  LegalPageLayout,
  LegalSection,
} from '@/features/legal/components/LegalPageLayout.jsx';

/**
 * Mentions légales (LCEN, art. 1-1 depuis la loi SREN du 21/05/2024).
 * L'identité affichée est celle de l'instance : chaque club est éditeur de son site.
 */
export function LegalNoticePage() {
  return (
    <LegalPageLayout title="Mentions légales">
      {(info) => (
        <>
          <LegalSection title="Éditeur du site">
            {info.demo ? (
              <>
                <p>
                  Ce site est une instance de démonstration du logiciel{' '}
                  {info.softwareProvider ?? 'Equime'}, réalisée dans le cadre d’un projet de
                  formation (titre professionnel Concepteur développeur d’applications). Le centre
                  équestre « {info.club.name} » est fictif.
                </p>
                <p>
                  L’éditeur agit à titre non professionnel. Conformément à l’article 1-1, II de la
                  loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique, il a
                  communiqué ses éléments d’identification à l’hébergeur ci-dessous.
                </p>
                <dl className="space-y-1">
                  <LegalItem label="Contact" value={info.club.email} />
                </dl>
              </>
            ) : (
              <dl className="space-y-1">
                <LegalItem label="Raison sociale" value={info.club.legalName} />
                <LegalItem label="Forme juridique" value={info.club.legalForm} />
                <LegalItem label="Immatriculation" value={info.club.registration} />
                <LegalItem label="Siège" value={info.club.address} />
                <LegalItem label="Téléphone" value={info.club.phone} />
                <LegalItem label="Email" value={info.club.email} />
                <LegalItem
                  label="Directeur de la publication"
                  value={info.club.publicationDirector}
                />
              </dl>
            )}
          </LegalSection>

          <LegalSection title="Hébergeur">
            <dl className="space-y-1">
              <LegalItem label="Nom" value={info.host.name} />
              <LegalItem label="Adresse" value={info.host.address} />
              <LegalItem label="Téléphone" value={info.host.phone} />
            </dl>
          </LegalSection>

          <LegalSection title="Logiciel">
            <p>
              {info.softwareProvider ?? 'Le logiciel Equime'} est fourni au club par un prestataire
              technique. Pour les données personnelles, ce prestataire agit en qualité de
              sous-traitant du club au sens de l’article 28 du RGPD (voir la{' '}
              <Link to="/confidentialite" className="text-primary underline">
                politique de confidentialité
              </Link>
              ).
            </p>
          </LegalSection>

          <LegalSection title="Propriété intellectuelle">
            <p>
              Les textes, visuels et logos présents sur ce site sont protégés. Toute reproduction ou
              réutilisation sans autorisation de leurs auteurs est interdite.
            </p>
          </LegalSection>
        </>
      )}
    </LegalPageLayout>
  );
}
