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
    }

    class ForfaitCavalier {
        +DateTime débutSaison
        +DateTime finSaison
        +Échéancier échéancier
        +Int prixCentimes
        +Int réductionPourcent
        +StatutForfait statut
    }

    class CréditRattrapage {
        +OrigineCrédit origine
        +DateTime expireLe
        +DateTime? utiliséLe
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
        +Float chargeHebdo(semaine) // dérivée, ADR 010
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
        +StatutInscription statut
        +DroitConsommé droit
        +DateTime? annuléeLe
        +DateTime? chevalAttribuéLe
    }

    class ServiceDroits {
        <<service>>
        +chooseEntitlement(parSemaine, prisesSemaine, crédit) Droit
        +resolveEntitlement(cavalier, dateSéance) Droit
        +isCancelledInTime(dateSéance, délaiHeures) Boolean
        +getRidersEntitlements(cavaliers) Droits[]
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
        +Int prixSaisonCentimes
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
    }

    class Échéance {
        +Int rang
        +DateTime dueLe
        +Int montantCentimes
        +DateTime? régléeLe
    }

    class Règlement {
        +ModeRèglement mode
        +Int montantCentimes
        +DateTime reçuLe
        +String? référence
    }

    class LigneFacture {
        +String libellé
        +Int quantité
        +Int totalCentimes
    }

    class ServiceFacturation {
        <<service>>
        +subscribeRider(cavalierId, forfait, échéancier) Facture
        +applyBestDiscount(prix, nbCavaliersAbonnés, règles) Int
        +buildInstallments(total, dates, maintenant) Échéance[]
        +sendInvoice(factureId) Facture
        +remindInvoice(factureId) Facture
        +recordPayment(factureId, règlement) Facture
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
    Cavalier "1" --> "0..*" ForfaitCavalier : souscrit (1 par saison)
    ForfaitCavalier "0..*" --> "1" PlanAbonnement
    ForfaitCavalier "0..1" --> "0..1" Facture : facturé par
    Cavalier "1" --> "0..*" CréditRattrapage : dispose
    InscriptionCours "0..1" --> "0..1" CréditRattrapage : produit / consomme
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
    Facture "1" --> "1..*" Échéance
    Facture "1" --> "0..*" Règlement
    Règlement "0..*" --> "0..1" Échéance : couvre
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
    ServiceDroits ..> InscriptionCours
    ServiceDroits ..> CréditRattrapage
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
| `Famille.réductionApplicable()` | `pricing.applyBestDiscount` (cavaliers ayant un forfait actif) |
| `Cavalier.peutRéserver()`, `Inscription.annuler()` | `entitlementService.resolveEntitlement`, `courseService.cancelEnrollment` (ADR 011) |
| `Facture.émettre()`, `encaisser()` | `billingService.sendInvoice`, `recordPayment` |
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
