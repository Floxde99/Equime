# Schéma de navigation — enchaînement des écrans

> Répond au critère CDA C5 « L'enchaînement des maquettes est formalisé par un schéma »
> (RE TP-01281 v04). Format : **schéma de navigation d'interface** (SNI), un écran par
> nœud et une transition par flèche. Source de vérité : `apps/web/src/router.jsx`
> (routes), `apps/web/src/features/auth/guards.jsx` (redirections) et les layouts par
> rôle (`components/layouts/*Layout.jsx`, barre latérale). Les écrans correspondent aux
> maquettes Stitch (`docs/design-system.md`, ADR 006).

## Légende

- Flèche pleine : action de l'utilisateur (lien, bouton, envoi de formulaire).
- Flèche pointillée : **redirection automatique** par une garde de route.
- Double cadre : service externe.
- Chaque espace connecté a une **barre latérale** : tous ses écrans sont accessibles
  entre eux en un clic (non répété sur les schémas).

## 1. Visiteur et authentification

```mermaid
flowchart LR
  H[Vitrine /] -->|Connexion| L[Connexion /login]
  H -->|Nous rejoindre| R[Inscription /register]
  H -->|pied de page| ML[Mentions légales]
  H -->|pied de page| PC[Confidentialité]
  H -->|pied de page| CGV[CGV]
  R -->|compte créé| APP{{Espace du rôle}}
  L -->|identifiants valides| APP
  L -->|Mot de passe oublié| F["Mot de passe oublié (/mot-de-passe-oublie)"]
  F -->|lien reçu par email| RP["Réinitialisation (/reinitialisation)"]
  RP -->|nouveau mot de passe| L
  X[Page protégée sans session] -.RequireAuth.-> L
  C["Connexion ou inscription, déjà connecté"] -.RedirectIfAuthenticated.-> APP
  W[Rôle non autorisé] -.RequireAuth.-> APP
```

`APP` renvoie vers `/app` (client), `/moniteur` (moniteur) ou `/admin` (administrateur)
(`HOME_BY_ROLE`). Après connexion, l'utilisateur retrouve la page demandée à l'origine
(`state.from`).

## 2. Client (famille)

```mermaid
flowchart LR
  D[Accueil /app] --> FAM[Famille /app/cavaliers]
  FAM -->|ajout cavalier + documents| FAM
  FAM -->|documents validés| RES[Réservations /app/planning]
  D -->|Réserver| RES
  RES -->|inscription à un cours| RES
  D --> FAC[Facturation /app/factures]
  FAC -->|Payer| S[[Stripe Checkout]]
  S -->|succès ?paid=1| FAC
  S -->|annulation ?cancelled=1| FAC
  FAC -->|lien avant paiement| CGV[CGV]
  D --> EV[Événements /app/evenements]
  D --> BEN[Bénévolat /app/benevolat]
  D --> MSG[Messages /app/messages]
  D --> NOT[Notifications /app/notifications]
  D --> CPT[Mon compte /app/compte]
  CPT -->|export JSON, suppression| CPT
```

**Parcours critique** (scénario E2E-2) : Famille → ajout d'un cavalier → documents validés
par l'admin → Réservations → inscription. Sans cavalier, Réservations affiche un état
vide qui renvoie vers Famille.

## 3. Moniteur

```mermaid
flowchart LR
  MD[Accueil /moniteur] --> MP[Planning /moniteur/planning]
  MD -->|Faire l'appel| AP[Appel /moniteur/appel]
  MP -->|attribution auto des chevaux| MP
  MP -->|override manuel| MP
  AP -->|présences| AP
  MD --> INC[Incidents /moniteur/incidents]
  MD --> SAN[Santé /moniteur/sante]
  SAN -->|fiche cheval| SH[Santé cheval /moniteur/sante/:id]
  MD --> MM[Messages /moniteur/messages]
```

## 4. Administrateur

```mermaid
flowchart LR
  AD[Tableau de bord /admin] --> APL[Planning /admin/planning]
  AD -->|Nouveau cours| APL
  APL -->|audit de compatibilité| APL
  AD --> CAV[Cavalerie /admin/cavalerie]
  CAV -->|fiche| CH[Cheval /admin/cavalerie/:id]
  AD --> AEV[Événements /admin/evenements]
  AEV -->|attribution des chevaux du stage| AEV
  AD --> CLI[Clients /admin/clients]
  CLI -->|valider documents, téléverser licence| CLI
  AD --> AFA[Facturation /admin/facturation]
  AFA -->|émettre, relancer| AFA
  AD --> AI[Incidents] & AB[Bénévolat] & AM[Messages] & AN[Notifications]
```
