# ADR 007 — Souscription client, changement de formule réservé à l'admin

- **Statut** : accepté (Excel 8.2)
- **Décideur** : développeur principal · **Proposé par** : assistant

## Contexte

Une famille (`Family.subscriptionPlanId`) peut n'avoir aucune formule à l'inscription. Le CDC / Excel 8.2 demande qu'un client puisse **choisir et ajouter** une formule s'il n'en a pas, tout en évitant qu'il change ensuite lui-même de tarif (effet sur le quota et la facturation).

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| **Client souscrit une fois ; admin seul change** | Simple, aligné secrétariat, pas de self-service tarifaire | Le client doit contacter le club pour un upgrade |
| Client peut changer à tout moment | Autonomie | Contournement du quota, litiges de facture |
| Admin seul attribue, jamais le client | Contrôle total | Inscription bloquée tant que le secrétariat n'a pas agi |

## Décision

Le **client** peut `POST /api/v1/client/family/subscription` **uniquement si** `Family.subscriptionPlanId` est `null`. Le quota initial vaut `sessionsPerWeek * 4`. Une formule déjà présente → **409** (« contactez le secrétariat »).

Le **changement** de formule (y compris reset du quota sur le nouveau plan) est un `PATCH /api/v1/admin/families/:id/subscription`. Aucun PATCH client n'existe.

Les formules actives sont exposées publiquement (`GET /api/v1/public/plans`) pour la vitrine et le compte famille.

## Conséquences

- Création admin d'un client : famille vide, quota 0, pas de formule (Excel 7.1).
- Le client voit sa formule et son quota sur `ClientAccountPage` ; le CTA « Choisir une formule » n'apparaît que s'il n'en a pas.
- L'admin édite la fiche (prénom, nom, téléphone) et change la formule d'une famille depuis `AdminMembersPage`.
