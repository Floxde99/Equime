# UML — Diagramme de classes du domaine

> Livrable Phase 1, **aligné sur le code livré** (Phase 7). Vue objet du domaine métier
> (indépendante de la persistance — voir `docs/merise/` pour les modèles de données).
> Les entités ne portent que des **données** ; les comportements sont portés par les
> **services** (`<<service>>`), avec les noms réels des fonctions de `apps/api/src/services/`.
> Ce choix est expliqué en fin de document.

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
    }

    class Famille {
        +String id
        +Int quotaSéances
    }

    class Cavalier {
        +String id
        +String prénom
        +Date dateNaissance
        +NiveauCavalier niveau
        +StatutDocument certificatMédical
        +StatutDocument licence
        +String? numéroLicence
    }

    class Cheval {
        +String id
        +String nom
        +StatutCheval statut
        +NiveauCavalier niveauMin
        +NiveauCavalier niveauMax
        +Float chargeHebdo
        +Float chargeMax
    }

    class Affinité {
        +TypeAffinité type
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
    }

    class InscriptionCours {
        +StatutPrésence présence
        +DateTime? chevalAttribuéLe
    }

    class ServiceAttribution {
        <<service>>
        +levelFit(niveau, cheval) Adéquation
        +scoreRiderHorse(cavalier, cheval, affinité) Int
        +rankCandidateHorses(cavalier, chevaux) Candidat[]
        +simulateHorseAssignments(cours, inscriptions) Résultat
        +assignHorsesForSession(coursId) Résultat
        +runCompatibilityAudit() Rapport
        +overrideAssignedHorse(coursId, inscriptionId, chevalId)
    }

    class Événement {
        +String id
        +TypeÉvénement type
        +Int prixCentimes
        +Int capacité
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
    }

    class Facture {
        +String numéro
        +StatutFacture statut
        +Int totalCentimes
        +String? stripeCheckoutSessionId
    }

    class LigneFacture {
        +String libellé
        +Int quantité
        +Int totalCentimes
    }

    class ServiceFacturation {
        <<service>>
        +generateSubscriptionInvoices() Facture[]
        +applyBestDiscount(prix, nbCavaliers, règles) Int
        +sendInvoice(factureId) Facture
        +remindInvoice(factureId) Facture
        +markInvoicePaidFromPayment(factureId) Facture
    }

    class Incident {
        +Gravité gravité
        +StatutIncident statut
    }

    class Conversation {
        +String? sujet
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
    }

    class ServiceJetons {
        <<service>>
        +issueTokenPair(utilisateur) PaireJetons
        +rotateRefreshToken(jeton) PaireJetons
        +revokeFamily(familleId) void
        +isBlacklisted(payload) Boolean
    }

    class Error {
        <<built-in>>
        +String message
    }

    class AppError {
        +Int statusCode
        +String code
        +Boolean isOperational
        +badRequest(message)$ AppError
        +unauthorized(message)$ AppError
        +forbidden(message)$ AppError
        +notFound(message)$ AppError
        +conflict(message)$ AppError
    }

    class ApiError {
        <<front>>
        +Int status
        +String code
    }

    Error <|-- AppError
    Error <|-- ApiError

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

### Un domaine « anémique », choisi et assumé

Les entités sont de simples structures de données (objets renvoyés par Prisma) ; toute
la logique vit dans des **services**. Martin Fowler appelle ce style un *modèle de
domaine anémique*, par opposition à un *modèle riche* où chaque entité porte ses règles
(`cheval.estÉligible()`). C'est un choix délibéré :

- les objets manipulés sont ceux de Prisma : les enrichir de méthodes imposerait une
  couche de conversion à chaque lecture ;
- l'architecture en couches d'Express (route → validation → contrôleur → service) place
  naturellement les règles dans les services ;
- les règles clés sont des **fonctions pures** (`scoreRiderHorse`, `levelFit`,
  `applyBestDiscount`, `expandWeeklyRecurrence`), testables sans base de données.

Où se trouvent les comportements qu'un modèle riche aurait portés :

| Responsabilité (modèle riche) | Fonction réelle |
|---|---|
| `Cheval.estÉligible()`, `niveauCompatible()` | `horseAssignment.isEligibleHorse`, `levelFit` (ADR 009) |
| `Cavalier.documentsValides()` | `lib/riderDocuments.assertRiderDocumentsApproved` |
| `Cours.duréeHeures()`, `expanserRécurrence()` | `durationHoursFromRange`, `recurrence.expandWeeklyRecurrence` |
| `Famille.réductionApplicable()` | `pricing.applyBestDiscount` |
| `Facture.émettre()`, `marquerPayée()` | `billingService.sendInvoice`, `markInvoicePaidFromPayment` |
| `JetonRafraîchissement.estValide()` | `tokenService.rotateRefreshToken` |
| `Utilisateur.peutAccéder()` | middlewares `requireAuth` / `requireRole` |

### Ce qui relève réellement de l'objet

- **Héritage** : `AppError extends Error` (API) et `ApiError extends Error` (front).
- **Méthodes de fabrique statiques** : `AppError.notFound()`, `AppError.conflict()`… Un seul
  constructeur, des fabriques qui nomment l'intention et fixent le code HTTP.
- **Polymorphisme** : le gestionnaire d'erreurs traite toute `AppError` de la même façon
  (code et message maîtrisés) et toute autre erreur comme un bug (500 générique).
- **Encapsulation par module** : chaque module n'exporte que son interface publique ; les
  détails (`isEligibleHorse`, `rotateRefreshTokenUnlocked`, la garde `inflightRotations`)
  restent privés au module.
- **Responsabilité unique** : une couche, un rôle ; aucun service ne connaît `req`/`res`.

### Autres points

- Les services (`<<service>>`) sont sans dépendance à Express et orchestrent les écritures
  dans `prisma.$transaction` quand plusieurs tables changent ensemble.
- Les énumérations (`Role`, `NiveauCavalier`, `StatutCheval`…) sont définies une seule fois
  dans `packages/shared/src/constants.js` et réutilisées par le front, l'API et Prisma.
