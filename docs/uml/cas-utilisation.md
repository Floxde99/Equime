# UML — Diagrammes de cas d'utilisation

> Livrable Phase 1. Un diagramme par rôle (`visitor`, `client`, `instructor`, `admin`).
> Mermaid ne proposant pas de diagramme de cas d'utilisation natif, la convention retenue est :
> acteur = nœud arrondi, cas d'utilisation = ellipse (parenthèses), `<<include>>` = flèche pointillée.

## Visiteur (non connecté)

```mermaid
flowchart LR
    V(["🧑 Visiteur"])
    V --> UC1(["Consulter la vitrine<br/>(hero, stats, stages à venir)"])
    V --> UC2(["Créer un compte"])
    V --> UC3(["Se connecter"])
    V --> UC4(["Demander la réinitialisation<br/>du mot de passe"])
    UC2 -.->|include| UC5(["Créer automatiquement la famille"])
```

## Client (famille / cavalier)

```mermaid
flowchart LR
    C(["🧑 Client"])

    subgraph Famille
        F1(["Gérer les cavaliers (CRUD)"])
        F2(["Téléverser certificat médical / licence"])
        F3(["Déclarer les affinités chevaux"])
    end
    subgraph Activités
        A1(["Inscrire un cavalier à un cours"])
        A2(["Réserver un événement (stage, compétition)"])
        A3(["Consulter le planning de la famille"])
        A4(["Se porter volontaire sur une mission"])
        A5(["Excuser une séance à venir"])
    end
    subgraph "Compte & facturation"
        B1(["Consulter et payer ses factures (simulé)"])
        B2(["Gérer son abonnement"])
        B3(["Gérer ses préférences de notification"])
        B4(["Supprimer son compte (anonymisation RGPD)"])
    end
    M1(["Échanger par messagerie"])

    C --> F1 & F2 & F3
    C --> A1 & A2 & A3 & A4 & A5
    C --> B1 & B2 & B3 & B4
    C --> M1
    F2 -.->|include| F2b(["Donner le consentement médical explicite"])
    A1 -.->|include| A1b(["Vérifier quota d'abonnement"])
```

## Moniteur

```mermaid
flowchart LR
    I(["🧑 Moniteur"])
    I --> P1(["Consulter le planning<br/>(mon planning / structure)"])
    I --> P2(["Consulter le détail d'une séance"])
    I --> P3(["Faire l'appel (présences)"])
    I --> P4(["Lancer l'attribution automatique des chevaux"])
    I --> P5(["Modifier manuellement un cheval attribué"])
    I --> P6(["Déclarer un incident"])
    I --> P7(["Échanger par messagerie"])
    P4 -.->|include| P4b(["Calculer les scores cavalier/cheval"])
    P5 -.->|extend| P4
```

## Admin (secrétariat / direction)

```mermaid
flowchart LR
    AD(["🧑 Admin"])

    subgraph Pilotage
        D1(["Consulter le dashboard KPIs<br/>(occupation, CA, charge chevaux)"])
        D2(["Consulter les alertes"])
        D3(["Lancer l'audit de compatibilité"])
    end
    subgraph Activité
        G1(["Gérer les cours et leur récurrence (CRUD)"])
        G2(["Gérer les événements (CRUD)"])
        G3(["Gérer les espaces (CRUD)"])
        G4(["Gérer les missions bénévolat (CRUD)"])
    end
    subgraph Cavalerie
        H1(["Gérer les fiches chevaux (CRUD)"])
        H2(["Tenir le carnet de santé"])
        H3(["Changer le statut d'un cheval"])
        H4(["Suivre la charge hebdomadaire"])
    end
    subgraph Membres
        M1(["Gérer les membres (CRUD, rôles)"])
        M2(["Bannir / débannir un membre"])
        M3(["Valider les documents des cavaliers"])
        M4(["Créer un compte moniteur"])
    end
    subgraph Facturation
        K1(["Créer et envoyer des factures"])
        K2(["Marquer une facture payée"])
        K3(["Relancer les impayés"])
        K4(["Gérer formules et règles de réduction"])
    end
    MSG(["Échanger par messagerie"])

    AD --> D1 & D2 & D3
    AD --> G1 & G2 & G3 & G4
    AD --> H1 & H2 & H3 & H4
    AD --> M1 & M2 & M3 & M4
    AD --> K1 & K2 & K3 & K4
    AD --> MSG
```

## Matrice rôles ↔ modules (synthèse)

| Module | Visiteur | Client | Moniteur | Admin |
|---|:---:|:---:|:---:|:---:|
| Vitrine / événements publics | ✅ lecture | ✅ | ✅ | ✅ |
| Authentification | ✅ | ✅ | ✅ | ✅ |
| Famille & cavaliers | — | ✅ (sa famille) | — | ✅ (toutes) |
| Planning & inscriptions cours | — | ✅ (sa famille) | ✅ (présences, chevaux) | ✅ (CRUD) |
| Attribution des chevaux | — | — | ✅ (lancer, override) | ✅ (audit batch) |
| Cavalerie & carnet de santé | — | affinités seulement | consultation | ✅ (CRUD) |
| Événements | lecture publique | ✅ (réserver) | consultation | ✅ (CRUD) |
| Facturation & abonnements | — | ✅ (consulter, payer) | — | ✅ (CRUD, relances) |
| Incidents | — | — | ✅ (déclarer) | ✅ (traiter) |
| Bénévolat | — | ✅ (s'inscrire) | — | ✅ (CRUD) |
| Messagerie | — | ✅ | ✅ | ✅ |
| Notifications & préférences | — | ✅ | ✅ | ✅ |
| Administration (membres, KPIs) | — | — | — | ✅ |
