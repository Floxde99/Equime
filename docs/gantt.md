# Gantt prévisionnel — Phases 2 → 7

> Livrable Phase 1. Planification indicative par sprints hebdomadaires à partir du 13 juillet 2026,
> ajustée en fin de chaque phase (vélocité constatée). Le passage d'une phase à la suivante est
> conditionné au GO explicite après recette de la phase.

```mermaid
gantt
    title Equime — planification prévisionnelle (phases 2 à 7)
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m

    section Sprint 2 — Authentification
    Services tokens + argon2 + rotation          :p2a, 2026-07-13, 5d
    Routes auth + rate limiting Redis            :p2b, after p2a, 3d
    Front auth (pages, store, refresh silencieux, guards) :p2c, after p2b, 4d
    Tests exhaustifs + docs/securite.md v1       :p2d, after p2c, 3d

    section Sprint 3 — Cœur métier
    Cavaliers + documents (upload) + affinités   :p3a, after p2d, 5d
    Cavalerie + carnet de santé + espaces        :p3b, after p3a, 4d
    Cours + récurrence + inscriptions + présences :p3c, after p3b, 5d
    Planning front (calendrier) + cache Redis    :p3d, after p3c, 4d

    section Sprint 4 — Attribution + facturation
    Service attribution + tests exhaustifs       :crit, p4a, after p3d, 5d
    Endpoint + audit batch + override front      :p4b, after p4a, 3d
    Pricing + factures + paiement simulé + relances :p4c, after p4b, 5d
    Dashboard admin KPIs                         :p4d, after p4c, 3d

    section Sprint 5 — Modules relationnels
    Événements + inscriptions                    :p5a, after p4d, 3d
    Messagerie (polling)                         :p5b, after p5a, 4d
    Incidents + bénévolat                        :p5c, after p5b, 3d
    Notifications in-app + email + préférences   :p5d, after p5c, 4d

    section Sprint 6 — E2E, CI/CD, déploiements
    Playwright (4 parcours critiques)            :p6a, after p5d, 4d
    Docker préprod/prod + Nginx SSL              :p6b, after p6a, 4d
    Pipeline complet + déploiements              :p6c, after p6b, 3d
    Cahier de recette en préprod + audits        :crit, p6d, after p6c, 4d

    section Sprint 7 — Dossier professionnel
    Jeu d'essai documenté                        :p7a, after p6d, 3d
    Consolidation cahiers + backlog + README     :p7b, after p7a, 3d
    Questions jury par CCP                       :p7c, after p7b, 2d
```

## Jalons

| Jalon | Condition de franchissement |
|---|---|
| Fin S2 | Parcours inscription → connexion → refresh → déconnexion démontrable ; tests auth verts |
| Fin S3 | Un client inscrit un cavalier à un cours récurrent visible au planning |
| Fin S4 | Attribution automatique + facture payée de bout en bout ; couverture ≥ 70 % maintenue |
| Fin S5 | Les 8 types de notification partent selon les préférences |
| Fin S6 | Cahier de recette exécuté en préprod, prod déployée avec approbation |
| Fin S7 | Dossier livrable au jury |

## Risques planifiés

| Risque | Impact | Mitigation |
|---|---|---|
| Complexité de la rotation des tokens | Glissement S2 | Séquence UML déjà validée ; tests écrits au fil de l'eau |
| Cas limites de l'attribution | Glissement S4 | Fonction de scoring pure isolée ; jeu d'essai défini dès la Phase 1 |
| Mise au point SSL/déploiement VPS | Glissement S6 | Préprod iso-prod dès le début du sprint ; procédure pas à pas documentée |
