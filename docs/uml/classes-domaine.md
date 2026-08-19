# UML — Diagramme de classes du domaine

> Livrable Phase 1. Vue objet du domaine métier (indépendante de la persistance —
> voir `docs/merise/` pour les modèles de données). Les méthodes listées correspondent
> aux services métier prévus (`apps/api/src/services/`).

```mermaid
classDiagram
    direction LR

    class Utilisateur {
        +String id
        +String email
        +String prénom
        +String nom
        +Role rôle
        +Boolean banni
        +estClient() Boolean
        +peutAccéder(ressource) Boolean
    }

    class Famille {
        +String id
        +Int quotaSéances
        +consommerQuota(n) void
        +réductionApplicable(règles) RègleRéduction?
    }

    class Cavalier {
        +String id
        +String prénom
        +Date dateNaissance
        +NiveauCavalier niveau
        +StatutDocument certificatMédical
        +StatutDocument licence
        +documentsValides() Boolean
    }

    class Cheval {
        +String id
        +String nom
        +StatutCheval statut
        +NiveauCavalier niveauMin
        +NiveauCavalier niveauMax
        +Float chargeHebdo
        +Float chargeMax
        +estÉligible() Boolean
        +niveauCompatible(cavalier) Boolean
        +enSurcharge() Boolean
    }

    class Affinité {
        +TypeAffinité type
        +score() Int
    }

    class Espace {
        +String id
        +String nom
        +TypeEspace type
        +Int capacité
    }

    class Cours {
        +String id
        +String titre
        +DateTime débutLe
        +DateTime finLe
        +Int capacité
        +StatutCours statut
        +RègleRécurrence? récurrence
        +duréeHeures() Float
        +estComplet() Boolean
        +expanserRécurrence() Cours[]
    }

    class InscriptionCours {
        +StatutPrésence présence
        +DateTime? chevalAttribuéLe
        +attribuerCheval(cheval) void
        +marquerPrésence(statut) void
    }

    class ServiceAttribution {
        <<service>>
        +assignHorsesForSession(coursId) RésultatAttribution
        +scorerCouple(cavalier, cheval, affinité) Int
        +auditCompatibilité() Rapport
    }

    class Événement {
        +String id
        +TypeÉvénement type
        +Int prixCentimes
        +Int capacité
        +placesRestantes() Int
    }

    class InscriptionÉvénement {
        +StatutInscription statut
    }

    class PlanAbonnement {
        +String nom
        +Int prixCentimes
        +Int séancesParSemaine
    }

    class RègleRéduction {
        +Int pourcentage
        +Int? minCavaliers
        +sApplique(famille) Boolean
    }

    class Facture {
        +String numéro
        +StatutFacture statut
        +Int totalCentimes
        +émettre() void
        +marquerPayée() void
        +estEnRetard() Boolean
    }

    class LigneFacture {
        +String libellé
        +Int quantité
        +Int totalCentimes
    }

    class ServiceFacturation {
        <<service>>
        +générerFacture(famille, lignes) Facture
        +calculerPrix(plan, règles) Int
        +relancerImpayés() void
    }

    class Incident {
        +Gravité gravité
        +StatutIncident statut
        +résoudre() void
    }

    class Conversation {
        +String? sujet
        +messagesNonLus(participant) Int
    }

    class Message {
        +String contenu
        +DateTime envoyéLe
    }

    class Notification {
        +TypeNotification type
        +DateTime? luLe
    }

    class JetonRafraîchissement {
        +String hash
        +String familleId
        +DateTime expireLe
        +DateTime? révoquéLe
        +estValide() Boolean
    }

    class ServiceJetons {
        <<service>>
        +émettre(utilisateur) PaireJetons
        +tourner(jeton) PaireJetons
        +détecterRéutilisation(jeton) Boolean
        +révoquerFamille(familleId) void
    }

    Utilisateur "1" --> "0..1" Famille : possède
    Famille "1" --> "1..*" Cavalier : compte
    Famille "0..*" --> "0..1" PlanAbonnement : souscrit
    Cavalier "1" --> "0..*" Affinité
    Affinité "0..*" --> "1" Cheval
    Cours "1" --> "0..*" InscriptionCours
    InscriptionCours "0..*" --> "1" Cavalier
    InscriptionCours "0..*" --> "0..1" Cheval : monté par
    Cours "0..*" --> "1" Espace : se déroule dans
    Cours "0..*" --> "1" Utilisateur : encadré par
    Cours "0..*" --> "0..1" Cours : occurrence de
    Événement "1" --> "0..*" InscriptionÉvénement
    InscriptionÉvénement "0..*" --> "1" Cavalier
    Famille "1" --> "0..*" Facture
    Facture "1" --> "1..*" LigneFacture
    Conversation "1" --> "0..*" Message
    Conversation "1" --> "2..*" Utilisateur : réunit
    Utilisateur "1" --> "0..*" Notification
    Utilisateur "1" --> "0..*" JetonRafraîchissement
    Incident "0..*" --> "0..1" Cheval : concerne
    Incident "0..*" --> "0..1" Cavalier : concerne

    ServiceAttribution ..> Cours
    ServiceAttribution ..> Cheval
    ServiceAttribution ..> Affinité
    ServiceFacturation ..> Facture
    ServiceFacturation ..> RègleRéduction
    ServiceJetons ..> JetonRafraîchissement
```

## Notes de conception

- Les **services** (stéréotype `<<service>>`) portent la logique transverse à plusieurs entités ;
  ils sont implémentés en fonctions pures + orchestration transactionnelle (`prisma.$transaction`),
  sans dépendance à Express (`req`/`res` interdits dans la couche service).
- `ServiceAttribution.scorerCouple` est une **fonction pure** : entrées (cavalier, cheval, affinité,
  charge) → score entier, testable unitairement sans base de données.
- Les énumérations (`Role`, `NiveauCavalier`, `StatutCheval`…) sont définies une seule fois dans
  `packages/shared/src/constants.js` et réutilisées par le front, l'API et le schéma Prisma.
