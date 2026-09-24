# Plan de soutenance — Equime

> Construit sur le **référentiel d'évaluation officiel** du titre CDA (RE TP-01281 v04 du
> 13/05/2023, RNCP37873). Projet réalisé en formation : le plan « entreprise » est suivi
> quand même, parce qu'il couvre toutes les compétences évaluées.

## 1. Déroulé réel de l'épreuve (2 h 15)

| Ordre | Épreuve | Durée | À savoir |
|---|---|---|---|
| 1 | **Questionnaire professionnel** | 30 min | Sur poste, **sans internet**. Documentation technique **en anglais** : 2 QCM en français + **2 questions ouvertes en anglais, réponses rédigées en anglais**. Corrigé par le jury **avant** la présentation. |
| 2 | **Présentation du projet** | 40 min | Le jury a lu le **dossier imprimé** avant. Il **n'interrompt pas** : personne n'arrête un dépassement, il faut se chronométrer. |
| 3 | **Entretien technique** | 45 min | Questions sur le dossier et la présentation, puis sur les compétences non couvertes par le projet. Le jury peut demander d'ouvrir l'IDE ou l'application. |
| 4 | **Entretien final** | 20 min | Échange sur le dossier professionnel (DP). |

**Dossier de projet** : 40 à 60 pages hors garde, sommaire et annexes (schémas compris) ;
annexes limitées à 40 pages. Il suit le même plan que la présentation ci-dessous.

## 2. Présentation minutée (40 min)

| Min | Contenu (ordre du plan officiel) | Diapos | Sources |
|---|---|---|---|
| 0–4 | Contexte, **expression des besoins**, contraintes, livrables attendus | 3 | `backlog.md` |
| 4–8 | **Gestion de projet** : planning et suivi, un **retard réel** (quand, ce qui a été décalé, qui a été prévenu), environnement humain et technique, objectifs qualité (CI bloquante, couverture ≥ 70 %) | 4 | `gantt.md`, `traceabilite.md` |
| 8–16 | **Spécifications fonctionnelles** : architecture en couches, maquettes (1 ou 2 écrans) et **leur enchaînement**, diagramme de cas d'utilisation, **diagramme de séquence** (authentification) | 7 | `architecture.md`, `uml/navigation.md`, `uml/cas-utilisation.md`, `uml/sequence-authentification.md` |
| 16–20 | **MCD** et **MPD**, extrait de **migration SQL** (script de création) | 3 | `merise/`, `apps/api/prisma/migrations/` |
| 20–28 | **Réalisations**, capture d'écran et code : une interface, un **composant métier** (attribution des chevaux), un **accès aux données** (verrou `FOR UPDATE` des inscriptions), un contrôleur ou utilitaire (`validate`, `errorHandler`). **Démo courte, 3–4 min au plus**, avec une vidéo de secours | 6 | `horseAssignment.js`, `eventService.js` |
| 28–32 | **Sécurité** : défense en profondeur par couche, authentification (jetons, rotation), Stripe (aucune carte chez Equime, webhook signé), OWASP Top 10:2025 | 3 | `securite.md` |
| 32–36 | **Plan de tests** puis **jeu d'essai** de l'attribution : entrée, attendu, obtenu, **analyse des écarts** avant et après correction | 3 | `cahier-de-tests.md` (Module 5, jeu d'essai) |
| 36–38 | **Veille sécurité** : méthode (exploitabilité avant score), `qs`, Node CERT-FR, nginx en fin de vie, failles trouvées en revue | 2 | `veille-securite.md` |
| 38–40 | **Synthèse** : satisfactions, difficultés, perspectives (SaaS, application mobile) | 1 | — |

Environ **32 diapositives**, plus des diapositives de **réserve** après la conclusion,
pour l'entretien technique :

- EcoIndex avant/après (`eco-conception.md`) ;
- table OWASP 2025 complète ;
- exceptions de `scripts/audit-ci.mjs` ;
- ADR 009 (règle de niveau) ;
- pages légales et modèle SaaS (une instance par club) ;
- compatibilité avec une application mobile.

## 3. Démonstration (dans le créneau 20–28)

Comptes du jeu de recette (`docs/cahier-de-recette.md`) : `admin@recette.equime.local`,
`moniteur1@recette.equime.local`, `client01@recette.equime.local`, mot de passe
`Recette!2026`.

| # | Acteur | Écran | Message clé |
|---|---|---|---|
| 1 | Moniteur | Planning → attribution automatique | Score + règle de niveau (ADR 009), override avec avertissement |
| 2 | Client | Factures → Payer (Stripe mode test) | Aucune carte dans l'application, webhook signé |

**Plan B** : réseau indisponible → vidéo de la démo, ou captures + `npm test -w apps/api`.

## 4. Entretien technique : préparation

- Bien distinguer tests d'**intégration** (composants ensemble), **système** (application
  déployée) et **d'acceptation** (recette en préproduction).
- **NoSQL** : Redis (rate limiting, liste noire des JWT, cache du planning).
- **POO** : domaine anémique assumé, héritage `AppError`, fabriques statiques,
  polymorphisme du gestionnaire d'erreurs (`uml/classes-domaine.md`). Ne pas prétendre
  que le code est orienté objet quand il ne l'est pas.
- **Éco-conception** : EcoIndex 79 / B → 82 / A, images −77 %.
- **Restauration de la base** : sauvegarde automatique avant chaque déploiement en prod,
  procédure documentée (`deploiement.md`).
- Questions probables et réponses : `docs/questions-jury.md`.

## 5. Supports à avoir sous la main

- Dossier de projet imprimé et diaporama
- `docs/questions-jury.md`, `docs/cahier-de-recette.md`
- Rapport de couverture CI (seuil 70 %)
- ADR 002 (JWT), ADR 008 (Stripe), ADR 009 (niveau)
