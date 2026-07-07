# Questions anticipées du jury — Equime

## Technique

1. **Pourquoi pas TypeScript ?** Choix projet CDA : Zod + JSDoc + ESLint strict pour la sûreté à l’exécution ; schémas partagés front/back.
2. **Pourquoi JWT maison plutôt qu’OAuth ?** Contrôle pédagogique sur rotation refresh, détection de réutilisation, blacklist Redis.
3. **Comment évitez-vous les IDOR ?** Filtrage par `familyId` / rôle dans les services ; tests recette T-S.4.
4. **Attribution des chevaux ?** Score dans `horseAssignment.js` (niveau, affinités, charge, statut cheval) — tests unitaires.
5. **Cache planning ?** `planningCache.js` + invalidation à la mutation des cours.

## Sécurité & RGPD

6. **Données médicales ?** Consentement explicite avant upload ; stockage fichiers hors webroot, servi via Nginx contrôlé.
7. **Suppression de compte ?** Anonymisation + conservation factures — `docs/rgpd.md`.
8. **Rate limiting ?** Redis sur auth ; script `playwright/clear-rate-limits.mjs` pour E2E.

## Méthode & qualité

9. **GitFlow ?** `main` prod, `develop` préprod, branches `feature/*` ; commits conventionnels.
10. **Traçabilité exigences → tests ?** `docs/traceabilite.md` + backlog MoSCoW.
11. **CI ?** Lint, tests API couverture 70 %, job Playwright sur les 4 parcours.

## Métier

12. **Règles de facturation ?** `pricing.js` + formules admin ; réductions familiales.
13. **Cours récurrents ?** `recurrence.js` — génération des occurrences sur fenêtre glissante.

## Pièges à préparer

- Différence **préprod** vs **prod** (compose + Nginx SSL).
- Limites connues : paiement simulé, KPIs dashboard partiels, export portabilité à venir.

