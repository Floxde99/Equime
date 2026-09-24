# Gantt — Equime

## Vue d'ensemble : avril 2026 → mars 2027

> Réalisé (conception, développement v1.0, certification) et roadmap post-certification
> (v1.1 à v1.3, voir `docs/backlog.md`, EPIC 10 à 12). Les dates de conception sont
> reconstituées (le dépôt actuel démarre au bootstrap du 6 juillet). Même découpage que le
> projet GitHub **Equime — Roadmap** (vue Roadmap), qui fait référence au quotidien.

```mermaid
gantt
    title Equime — de la conception au lancement commercial
    dateFormat  YYYY-MM-DD
    axisFormat  %b %y
    tickInterval 1month

    section Conception
    Analyse du besoin, cahier des charges        :done, c1, 2026-04-06, 2026-04-24
    Étude de l'existant, benchmark               :done, c2, 2026-04-20, 2026-05-01
    Merise MCD / MLD / MPD                       :done, c3, 2026-04-27, 2026-05-22
    UML (cas d'utilisation, classes, séquences)  :done, c4, 2026-05-18, 2026-06-12
    Maquettes Stitch, design system              :done, c5, 2026-06-01, 2026-06-19
    Architecture, ADR 001 à 005                  :done, c6, 2026-06-15, 2026-06-26
    Backlog MoSCoW, jeux d'essai, Gantt          :done, c7, 2026-06-22, 2026-07-03

    section v1.0 — Développement
    S0 Bootstrap (monorepo, Docker, CI)          :done, s0, 2026-07-06, 2026-07-10
    S2 Authentification                          :done, s2, 2026-07-13, 2026-07-27
    S3 Cœur métier (cavaliers, cavalerie, cours) :done, s3, 2026-07-27, 2026-08-07
    S4 Attribution des chevaux, facturation      :crit, done, s4, 2026-08-03, 2026-08-14
    S5 Messagerie, incidents, événements, notifs :done, s5, 2026-08-10, 2026-08-19
    Conformité cahier des charges (Excel)        :done, cdc, 2026-08-17, 2026-08-21

    section v1.0 — Recette et certification
    S6 E2E, CI/CD, préprod, prod, Stripe         :done, s6, 2026-08-20, 2026-09-23
    S7 Dossier professionnel                     :done, s7, 2026-09-07, 2026-09-23
    Production déployée                          :milestone, done, m1, 2026-09-23, 0d

    section v1.1 — Club pilote
    US-10.1 Charge hebdo fiable                  :done, u101, 2026-09-24, 2026-09-25
    US-10.2 Tâches automatiques                  :u102, 2026-09-28, 2026-10-09
    US-10.3 Rattrapages                          :crit, u103, 2026-10-05, 2026-10-16
    US-10.4 Liste d'attente                      :u104, 2026-10-12, 2026-10-23
    US-10.5 Cartes de séances                    :u105, 2026-10-12, 2026-10-23
    US-10.6 Facture conforme (TVA)               :crit, u106, 2026-10-19, 2026-10-30
    US-10.7 Import des données du club           :u107, 2026-10-26, 2026-11-06
    Mise en service au club pilote               :milestone, m2, 2026-11-09, 0d

    section v1.2 — Différenciation
    US-11.1 PWA et notifications push            :u111, 2026-11-09, 2026-11-27
    US-11.2 Suivi pédagogique Galops             :u112, 2026-11-23, 2026-12-11
    US-11.3 Cheval du jour                       :u113, 2026-11-30, 2026-12-04
    US-11.4 Bien-être de la cavalerie            :u114, 2026-12-07, 2026-12-18
    US-11.5 Relance de rétention                 :u115, 2026-12-14, 2026-12-18
    US-11.6 Messagerie temps réel, annonces      :u116, 2026-12-14, 2027-01-01

    section v1.3 — SaaS commercial
    US-12.1 Multi-club                           :crit, u121, 2027-01-04, 2027-01-29
    US-12.2 Stripe Connect, prélèvement SEPA     :u122, 2027-01-25, 2027-02-12
    US-12.3 Facture électronique Factur-X        :crit, u123, 2027-02-08, 2027-02-26
    US-12.4 Pont FFE                             :u124, 2027-02-15, 2027-02-26
    US-12.5 Inscription d'un club en autonomie   :u125, 2027-02-22, 2027-03-12
    US-12.6 Assistant IA parents                 :u126, 2027-03-01, 2027-03-12
    Ouverture commerciale                        :milestone, m3, 2027-03-15, 0d
```

**Échéance externe :** émission obligatoire des factures électroniques au 1er septembre 2027
pour les clubs assujettis à la TVA (réception depuis le 1er septembre 2026). US-12.3 doit être
livrée et éprouvée bien avant.

---

## Gantt prévisionnel initial — Phases 2 → 7

> Livrable Phase 1, conservé pour comparer le prévu et le réalisé.
> Planification indicative par sprints hebdomadaires à partir du 13 juillet 2026,
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
| Fin S6 | Cahier de recette exécuté (CI + smoke préprod/prod), prod déployée avec approbation — **atteint 2026-09-23** |
| Fin S7 | Dossier livrable au jury — **atteint** (traçabilité, soutenance, questions, cahiers alignés) |

## Risques planifiés

| Risque | Impact | Mitigation |
|---|---|---|
| Complexité de la rotation des tokens | Glissement S2 | Séquence UML déjà validée ; tests écrits au fil de l'eau |
| Cas limites de l'attribution | Glissement S4 | Fonction de scoring pure isolée ; jeu d'essai défini dès la Phase 1 |
| Mise au point SSL/déploiement VPS | Glissement S6 | Préprod iso-prod dès le début du sprint ; procédure pas à pas documentée |
