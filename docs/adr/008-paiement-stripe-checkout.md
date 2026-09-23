# ADR 008 — Paiement via Stripe Checkout hébergé

- **Statut** : accepté
- **Décideur** : développeur principal · **Proposé par** : assistant
- **Date** : 2026-09-22

## Contexte

Equime facture les familles (abonnements, stages). La v1 utilisait un **paiement simulé** (`POST …/pay` → statut `paid`). Pour la soutenance CDA et une préprod/prod réaliste, il faut un PSP réel tout en restant hors périmètre PCI (aucune saisie de CB dans React).

Contraintes projet : 100 % JS ESM, couches route → Zod → controller → service → Prisma, secrets uniquement en `.env`.

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| **A — Stripe Checkout hébergé** | Redirect hors app ; PCI chez Stripe ; webhook signé = source de vérité ; intégration courte | UX hors SPA pendant le paiement |
| B — Stripe Payment Element (embedded) | UX in-app | Charge front + clé publishable ; plus de surface PCI / JS |
| C — Garder le simulé | Zéro dépendance | Non crédible en préprod/prod ; hors attente jury sur paiement réel |

## Décision

**Option A** : Stripe Checkout en `mode: 'payment'`.

1. Le client authentifié appelle `POST /api/v1/client/invoices/:id/checkout` ; l’API crée une Session, persiste `stripeCheckoutSessionId`, renvoie `{ url }`.
2. Le front fait `location.assign(url)` — **aucune carte dans le DOM Equime**.
3. Le webhook `POST /api/v1/webhooks/stripe` (body brut + `constructEvent`) traite `checkout.session.completed` (et `async_payment_succeeded` si besoin) et appelle `markInvoicePaidFromPayment` de façon **idempotente**.
4. **Clés test autorisées en préprod et en prod** jusqu’au go-live (`sk_test_` / `whsec_…`) : même code, bascule live uniquement via `.env` (`sk_live_`).
5. Sans `STRIPE_SECRET_KEY` et si `NODE_ENV` ∈ {`development`,`test`} : le chemin **simulé** `POST …/pay` reste disponible (CI / E2E locaux). Sinon → 410 Gone.

## Conséquences

- Champs `Invoice.stripeCheckoutSessionId` (unique) et `stripePaymentIntentId`.
- Variables `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY` (défaut `eur`) validées par Zod au boot.
- Endpoint public `GET /api/v1/public/payment-config` → `{ provider, mode }` pour le bandeau « Mode test ».
- Docs : `securite.md`, `rgpd.md` (Stripe = sous-traitant / processor), `deploiement.md` (CLI / Dashboard webhook).
- Hors scope v1 : abonnements Stripe récurrents, SEPA, remboursements automatiques, Payment Element.
