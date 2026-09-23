# Questions anticipées du jury — Equime

## Technique

1. **Pourquoi pas TypeScript ?** Choix projet CDA : Zod + JSDoc + ESLint strict pour la sûreté à l’exécution ; schémas partagés front/back (ADR 004).
2. **Pourquoi JWT maison plutôt qu’OAuth ?** Contrôle pédagogique sur rotation refresh, détection de réutilisation, blacklist Redis (ADR 002).
3. **Comment évitez-vous les IDOR ?** Filtrage par `familyId` / rôle dans les services ; tests T-S.4 (`phase4` / `phase5` / `core`).
4. **Attribution des chevaux ?** Score dans `horseAssignment.js` (niveau, affinités, charge, statut cheval) — tests unitaires + stages (Excel 11.2).
5. **Cache planning ?** `planningCache.js` + invalidation à la mutation des cours ; isolation par scope client.
6. **Paiement Stripe ?** Checkout hébergé (ADR 008) : webhook `constructEvent` = source de vérité ; `confirm-checkout` = filet côté serveur après retour ; clés `sk_test_` jusqu’au go-live.

## Sécurité & RGPD

7. **Données médicales ?** Consentement explicite avant upload ; stockage fichiers hors webroot, servi authentifié.
8. **Suppression de compte ?** Anonymisation + conservation factures — `docs/rgpd.md` ; export portabilité JSON depuis « Mon compte ».
9. **Rate limiting ?** Redis fail-closed sur auth ; `trust proxy 1` + Caddy seul hop pour `req.ip` correct.
10. **Headers / HSTS ?** Helmet + image web CSP ; Caddy hôte pour TLS/HSTS — validés sur préprod et prod (2026-09-23).

## Méthode & qualité

11. **GitFlow ?** `main` prod, `develop` préprod, branches `feature/*` ; commits conventionnels ; déploiement CI avec environnement GitHub (approbation manuelle prod).
12. **Traçabilité exigences → tests ?** `docs/traceabilite.md` + backlog MoSCoW + cahiers de tests / recette.
13. **CI ?** Lint, format, audit-ci, tests API couverture 70 %, build web, Playwright E2E-1–13, deploy préprod/prod.

## Métier

14. **Règles de facturation ?** `pricing.js` + formules admin ; réductions familiales ; batch abonnements (Excel 12.1).
15. **Cours récurrents ?** `recurrence.js` — génération des occurrences ; annulation séance ≠ série.
16. **Documents bloquants ?** Certificat + licence approuvés et non expirés (Excel 7.2) ; force admin (Excel 10.4).

## Pièges à préparer

- Différence **préprod** vs **prod** (ports, Basic Auth éventuel préprod, compose + Caddy TLS).
- Limites connues : abonnements Stripe récurrents / SEPA hors v1 (Checkout one-shot livré) ; pas de WebSocket ; pas de PWA (Excel 4.7) ; KPIs sans ML (Excel 5.1).
- **Paiement** : aucune CB dans React ; confirmation via webhook signé ; carte test `4242…` ; bandeau « Mode test ».
- Écart a11y mineur : tiroir navigation mobile sans piège de focus (non bloquant).
