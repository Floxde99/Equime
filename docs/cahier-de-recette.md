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
| E2E-4 | Paiement facture | Client paie FAC-2026-0002 → admin vérifie statut | Statut « Payée » côté client et admin (simulé si pas de Stripe ; sinon Checkout + webhook) | `billing-flow.spec.js` | ✅ auto |
| E2E-5 | Vitrine | Nav Accueil / Formules / Cours, CTA Connexion | Pages publiques accessibles, lien vers `/login` | `public.spec.js` | ✅ auto |
| E2E-6 | Isolation des rôles | Client ouvre `/admin` ; visiteur ouvre `/app` | Client renvoyé vers `/app` ; visiteur vers `/login` | `guards.spec.js` | ✅ auto |
| E2E-7 | Inscription aux stages | Client → Inscriptions aux stages → inscrire Emma au Stage vacances (seed) | Inscription confirmée | `client-engagement.spec.js` | ✅ auto |
| E2E-8 | Cavalerie admin | Vue d'ensemble → Cavalerie & espaces → 1re fiche cheval | Fiche cheval affichée | `admin-flow.spec.js` | ✅ auto |
| E2E-9 | Fumée client | Navigation Messages / Bénévolat / Compte / Notifications | Chaque écran se charge sans erreur | `client-engagement.spec.js` | ✅ auto |
| E2E-10 | Fumée moniteur | Santé (Carnet de santé) + Incidents | Chaque écran se charge sans erreur | `instructor-smoke.spec.js` | ✅ auto |
| E2E-11 | Fumée admin | Vue d'ensemble → Adhérents | Chaque écran se charge sans erreur | `admin-flow.spec.js` | ✅ auto |
| E2E-12 | Page 404 | Ouvrir une URL inconnue | Écran « Page introuvable » | `public.spec.js` | ✅ auto |
| E2E-13 | Newsletter vitrine | Formulaire newsletter sur l'accueil | Inscription acceptée (email valide) | `public.spec.js` | ✅ auto |

---

## 3. Contrôles transverses (sécurité & accessibilité)

| ID | Contrôle | Procédure | Résultat attendu | Statut |
|---|---|---|---|---|
| T-S.1 | Injection SQL | Recherche avec `' OR 1=1 --` | Aucune fuite, requête paramétrée | ✅ |
| T-S.2 | XSS messagerie | Envoyer `<script>alert(1)</script>` | Texte échappé, pas d'exécution | ✅ |
| T-S.3 | Headers sécurité | `curl -I` sur le frontal (Caddy + web) | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS | ✅ |
| T-S.4 | IDOR | Client tente un ID d'une autre famille | 403 ou 404, pas de fuite | ✅ |
| T-A.1 | Navigation clavier | Parcourir login → dashboard → déconnexion au clavier | Focus visible, ordre logique | ✅ |
| T-A.2 | Lecteur d'écran | Badges de statut, labels de formulaire | Texte explicite, pas couleur seule | ✅ |

Légende T-A : ✅ critère du cahier atteint sur le périmètre exercé (arbre d’accessibilité prod + revue code). Écart mineur tiroir mobile documenté §4.

---

## 4. Journal d'exécution

| Date | Environnement | Exécutant | Parcours | Résultat | Observations |
|---|---|---|---|---|---|
| 2026-08-19 | Dev Docker (service web port 5173, seed développement `lina@equime.local`) | Lot 8 — revue du code UI + spot-check clavier Playwright headless (pas la suite E2E) | T-A.1 | ✅ | Skip-link, ordre Tab login → shell → déconnexion, anneau `:focus-visible`. Voir fiche ci-dessous. |
| 2026-08-19 | Idem + revue statique `apps/web` | Lot 8 — revue code + arbre d'accessibilité Chrome (Playwright `ariaSnapshot`). | T-A.2 | ✅ | Labels `Field`, landmarks, badges toujours textuels. |
| 2026-09-23 | CI `develop` / `main` + préprod / prod VPS | Clôture Phase 6 | E2E-1–13, T-S.1–4, T-A.2, SSL/HSTS | ✅ | Voir fiche « Recette 2026-09-23 » ci-dessous. |

### T-A.1 — Navigation clavier (2026-08-19)

**Périmètre exercé.** Parcours demandé : `/login` → dashboard client `/app` → déconnexion, au clavier, viewport desktop 1280×800. Stack Docker locale déjà levée (`equime-web-1`). Pas de rejeu de la suite Playwright E2E-1–13.

**Implémenté dans le code (Lot 6 inclus).**

- Lien d'évitement `SkipLink` en premier élément tabulable (`AuthLayout` → `#auth`, `ConnectedShell` → `#contenu`).
- Focus visible global : `apps/web/src/styles/index.css` (`:focus-visible` → `ring-2 ring-primary/60`, `outline-none`).
- Modale `Dialog` : `useId()` pour `aria-labelledby`, focus initial, piège Tab / Maj+Tab, restauration du focus, Échap.
- `Button` : `disabled` / `aria-busy` posés **après** `{...rest}` (état chargement non écrasable).
- Déconnexion : bouton réel « Se déconnecter » (pas une icône seule).

**Constat live (spot-check).**

- Premier Tab sur `/login` : lien « Aller au contenu ». Suite : marque Equime, champ email, mot de passe, « Mot de passe oublié ? », « Se connecter », « Créer un compte », puis boucle.
- `html lang="fr"`. Anneau de focus présent (`box-shadow` oklab, outline CSS volontairement `none`).
- Après connexion : premier Tab = skip-link `#contenu`, puis nav « Navigation famille » (Accueil → … → Mon compte), CTA « Réserver », « Se déconnecter », cloche Notifications du bandeau.
- Entrée sur « Se déconnecter » ramène `/login` (titre « Connexion »).

**Hors périmètre / non exercé live.** Menu tiroir mobile (pas de piège de focus dédié, viewport desktop uniquement). Modale non ouverte sur ce seed (aucune séance à venir donc pas de « Signaler une absence ») — le piège de focus reste justifié par le code Lot 6, pas par une session manuelle.

### T-A.2 — Badges, labels, jamais la couleur seule (2026-08-19 + 2026-09-23)

**Ce qui est vérifié (code + arbre d'accessibilité Chrome + prod).**

- Formulaires via `Field` : `<label htmlFor>` + `aria-invalid` / `aria-describedby` ; erreurs en texte (`role="alert"`), pas seulement `border-danger`.
- Login (arbre a11y) : `textbox "Email"`, `textbox "Mot de passe"` — le nom accessible n'est pas vide.
- Landmarks shell : `main#contenu`, `nav` nommé (`aria-label`, ex. « Navigation famille »), `aside` / `header` (complémentaire / bannière). Nom de l'utilisateur en `sr-only` dans le bandeau.
- `Badge` : toujours des enfants textuels (`HORSE_STATUS_LABELS`, `INVOICE_STATUS_LABELS`, `DOCUMENT_STATUS_LABELS`, `ATTENDANCE_STATUS_LABELS`, « En cours » / « Planifié », « Banni » / « Actif », « Lue » / « Nouvelle », « Favori »). Jamais une pastille couleur vide.
- Planning : pastilles de légende `aria-hidden` **et** libellé `COURSE_STATUS_LABELS` ; événements FullCalendar avec `aria-label` incluant le statut (`formatEventAriaLabel`).
- Occupation boxes : `role="img"` + `aria-label` chiffré ; barres de charge cheval `aria-hidden` avec les heures en texte adjacent.
- **Prod 2026-09-23** (`https://equime.florianfaucher.dev/`) : skip-link « Aller au contenu », `nav` « Navigation principale », champ newsletter `textbox "Email"`, titres et liens nommés — arbre d’accessibilité navigateur sans nœud anonyme bloquant.

**Hors périmètre clôturé.** Session NVDA/VoiceOver native non rejouée (optionnel pour oral) ; tiroir mobile sans piège de focus (écart mineur).

### Recette 2026-09-23 — clôture préprod / prod

| Preuve | Détail |
|---|---|
| E2E-1–13 | Job CI **E2E** vert — runs [35836772102](https://github.com/Floxde99/Equime/actions/runs/35836772102) (`develop`) et [35840685324](https://github.com/Floxde99/Equime/actions/runs/35840685324) (`main`) |
| Déploiement préprod | Job **Déploiement préproduction** réussi (run 35834346267 après correction `REDIS_PASSWORD`) ; `GET https://prequime.florianfaucher.dev/health` → `{"status":"ok","redis":"up"}` |
| Déploiement prod | Job **Déploiement production** réussi (run 35840685324, environnement `production` approuvé) ; `GET https://equime.florianfaucher.dev/health` → `{"status":"ok","redis":"up"}` |
| T-S.1 | Prisma paramétré ; Zod sur les entrées ; pas d’accès SQL brut utilisateur |
| T-S.2 | `phase5.test.js` stocke le littéral `<script>…</script>` ; affichage React échappe ; CSP `script-src 'self'` (prod) |
| T-S.3 | Prod : `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, CSP ; préprod : HSTS + headers Caddy (Basic Auth frontal) |
| T-S.4 | Isolation famille / contacts : `core.test.js`, `phase4.test.js` (PDF autre famille 404), `phase5.test.js` (messages 404) |
| T-A.2 | Arbre a11y prod + revue code (voir fiche ci-dessus) |
| SSL / HSTS | Caddy hôte + `Strict-Transport-Security` observé sur préprod et prod |

### Fiche d'écart (T-A)

| ID test | Gravité | Description | Correctif | Statut |
|---|---|---|---|---|
| T-A.1 | Mineure | Tiroir de navigation mobile : pas de piège de focus (hors parcours desktop T-A.1). | Amélioration post-soutenance si audit RGAA mobile. | Ouvert (non bloquant) |
| T-A.1 | Info | Piège de focus `Dialog` non rejoué live sur seed sans séances. | Couvert par le code Lot 6 ; non bloquant. | Accepté |

### Recette manuelle Stripe (hors CI)

1. Renseigner `STRIPE_SECRET_KEY` (`sk_test_`) + `STRIPE_WEBHOOK_SECRET` (`stripe listen` ou Dashboard).
2. Client → Facturation → **Payer** → redirect Checkout → carte `4242…`.
3. Retour `?paid=1` : statut **Payée** après webhook (bandeau « Mode test » visible).
4. Sans clés Stripe : le parcours E2E-4 utilise le **paiement simulé** (inchangé).

---

## 5. Critères de passage en production

- [x] La suite étendue Playwright (E2E-1 à E2E-13) est **verte** en CI sur `develop` / `main`
- [x] Recette E2E-1 à E2E-13 validée via CI + smoke health préprod/prod (2026-09-23)
- [x] Journal §4 complété avec date, exécutant et observations
- [x] Contrôles T-S.1 à T-S.4 et T-A.1 à T-A.2 sans écart bloquant
- [x] Variables `.env.prod` renseignées (secrets ≥ 32 car., Stripe test, Redis) — déploiement prod réussi
- [x] Procédure de rollback documentée dans `docs/deploiement.md`

---

## 6. Traçabilité et conformité

- Matrice US → code → tests : `docs/traceabilite.md`
- RGPD (consentement médical, anonymisation, durées) : `docs/rgpd.md`
- Plan de démonstration soutenance : `docs/soutenance-plan.md`

