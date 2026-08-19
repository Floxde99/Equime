# Cahier de recette — Equime

> Support Phase 6 pour la préproduction. Dérivé de `docs/cahier-de-tests.md` (
> **4 parcours métier critiques (E2E-1–4) + extension fumée/modules (E2E-5–13)**
> + contrôles transverses T-S.x / T-A.x). Les exécutions sont consignées ici avant
> ouverture de la production.

## 1. Préparation de l'environnement

### Stack

```bash
cp .env.preprod.example .env.preprod
docker compose -f docker-compose.preprod.yml --env-file .env.preprod up -d --build
npm run migrate -w apps/api
npm run seed:recette -w apps/api
```

### Comptes de recette (seed `apps/api/prisma/seed-recette.js`)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@recette.equime.local` | `Recette!2026` |
| Moniteur | `moniteur1@recette.equime.local` | `Recette!2026` |
| Client | `client01@recette.equime.local` | `Recette!2026` |

### Données représentatives

- 25 familles (~35 cavaliers), 15 chevaux, 3 espaces
- 6 séries de cours sur 8 semaines (4 semaines passées avec présences)
- Factures sur 3 mois, événements, incidents, bénévolat, conversations
- Jeu **déterministe** (RNG seedé) : deux exécutions du seed produisent les mêmes données

### Automatisation de référence

La suite étendue (E2E-1 à E2E-13) est rejouable en local :

```bash
docker compose up -d postgres redis
npm run e2e:prepare
npm run e2e
```

---

## 2. Parcours fonctionnels (recette manuelle)

**4 parcours métier critiques (E2E-1–4) + extension fumée/modules (E2E-5–13).**

| ID | Parcours | Étapes clés | Résultat attendu | Auto Playwright | Statut |
|---|---|---|---|---|---|
| E2E-1 | Inscription client | `/register` → création compte → déconnexion | Dashboard client puis retour `/login` | `auth.spec.js` | ✅ auto |
| E2E-2 | Client cavaliers + planning | Connexion client → ajout cavalier → réservation cours → planning | Cavalier visible, inscription confirmée, séance au planning | `client-flow.spec.js` | ✅ auto |
| E2E-3 | Moniteur planning + appel | Connexion moniteur → planning → appel séance | Filtre planning, attribution chevaux, sélection séance appel | `instructor-flow.spec.js` | ✅ auto |
| E2E-4 | Paiement facture | Client paie FAC-2026-0002 → admin vérifie statut | Statut « Payée » côté client et admin | `billing-flow.spec.js` | ✅ auto |
| E2E-5 | Vitrine | Nav Accueil / Formules / Cours, CTA Connexion | Pages publiques accessibles, lien vers `/login` | `public.spec.js` | ⬜ |
| E2E-6 | Isolation des rôles | Client ouvre `/admin` ; visiteur ouvre `/app` | Client renvoyé vers `/app` ; visiteur vers `/login` | `guards.spec.js` | ⬜ |
| E2E-7 | Inscription aux stages | Client → Inscriptions aux stages → inscrire Emma au Stage vacances (seed) | Inscription confirmée | `client-engagement.spec.js` | ⬜ |
| E2E-8 | Cavalerie admin | Vue d'ensemble → Cavalerie & espaces → 1re fiche cheval | Fiche cheval affichée | `admin-flow.spec.js` | ⬜ |
| E2E-9 | Fumée client | Navigation Messages / Bénévolat / Compte / Notifications | Chaque écran se charge sans erreur | `client-engagement.spec.js` | ⬜ |
| E2E-10 | Fumée moniteur | Santé (Carnet de santé) + Incidents | Chaque écran se charge sans erreur | `instructor-smoke.spec.js` | ⬜ |
| E2E-11 | Fumée admin | Vue d'ensemble → Adhérents | Chaque écran se charge sans erreur | `admin-flow.spec.js` | ⬜ |
| E2E-12 | Page 404 | Ouvrir une URL inconnue | Écran « Page introuvable » | `public.spec.js` | ⬜ |
| E2E-13 | Newsletter vitrine | Formulaire newsletter sur l'accueil | Inscription acceptée (email valide) | `public.spec.js` | ⬜ |

---

## 3. Contrôles transverses (sécurité & accessibilité)

| ID | Contrôle | Procédure | Résultat attendu | Statut |
|---|---|---|---|---|
| T-S.1 | Injection SQL | Recherche avec `' OR 1=1 --` | Aucune fuite, requête paramétrée | ⬜ |
| T-S.2 | XSS messagerie | Envoyer `<script>alert(1)</script>` | Texte échappé, pas d'exécution | ⬜ |
| T-S.3 | Headers sécurité | `curl -I` sur le frontal Nginx | X-Content-Type-Options, X-Frame-Options, Referrer-Policy | ⬜ |
| T-S.4 | IDOR | Client tente un ID d'une autre famille | 403 ou 404, pas de fuite | ⬜ |
| T-A.1 | Navigation clavier | Parcourir login → dashboard → déconnexion au clavier | Focus visible, ordre logique | ⬜ |
| T-A.2 | Lecteur d'écran | Badges de statut, labels de formulaire | Texte explicite, pas couleur seule | ⬜ |

---

## 4. Journal d'exécution

| Date | Environnement | Exécutant | Parcours | Résultat | Observations |
|---|---|---|---|---|---|
| À compléter | Préproduction | — | E2E-1 à E2E-13 + T-S/T-A | ⬜ | Première recette après déploiement préprod |

### Modèle de fiche d'écart

| ID test | Gravité | Description | Correctif | Statut |
|---|---|---|---|---|
| — | — | — | — | — |

---

## 5. Critères de passage en production

- [ ] La suite étendue Playwright (E2E-1 à E2E-13) est **verte** en CI sur `develop`
- [ ] Recette manuelle E2E-1 à E2E-13 validée en préprod avec seed recette (`npm run e2e` ou CI)
- [ ] Journal §4 complété avec date, exécutant et observations
- [ ] Contrôles T-S.1 à T-S.4 et T-A.1 à T-A.2 sans écart bloquant
- [ ] Variables `.env.prod` renseignées (secrets ≥ 32 car., SMTP, certificats SSL)
- [ ] Sauvegarde PostgreSQL testée et procédure de rollback documentée

---

## 6. Traçabilité et conformité

- Matrice US → code → tests : `docs/traceabilite.md`
- RGPD (consentement médical, anonymisation, durées) : `docs/rgpd.md`
- Plan de démonstration soutenance : `docs/soutenance-plan.md`

