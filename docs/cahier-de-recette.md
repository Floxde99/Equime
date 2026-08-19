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
| T-A.1 | Navigation clavier | Parcourir login → dashboard → déconnexion au clavier | Focus visible, ordre logique | ✅ |
| T-A.2 | Lecteur d'écran | Badges de statut, labels de formulaire | Texte explicite, pas couleur seule | ⚠️ |

Légende T-A : ✅ critère du cahier atteint sur le périmètre exercé ; ⚠️ partie code / arbre d'accessibilité OK, session lecteur d'écran humaine restante. Détail au §4.

---

## 4. Journal d'exécution

| Date | Environnement | Exécutant | Parcours | Résultat | Observations |
|---|---|---|---|---|---|
| 2026-08-19 | Dev Docker (service web port 5173, seed développement `lina@equime.local`) | Lot 8 — revue du code UI + spot-check clavier Playwright headless (pas la suite E2E) | T-A.1 | ✅ | Skip-link, ordre Tab login → shell → déconnexion, anneau `:focus-visible`. Voir fiche ci-dessous. |
| 2026-08-19 | Idem + revue statique `apps/web` | Lot 8 — revue code + arbre d'accessibilité Chrome (Playwright `ariaSnapshot`). **Aucune session NVDA / VoiceOver / JAWS.** | T-A.2 | ⚠️ | Labels `Field`, landmarks, badges toujours textuels. Session lecteur d'écran humaine restante. |
| À compléter | Préproduction | — | E2E-1 à E2E-13 + T-S.1–T-S.4 | ⬜ | Première recette après déploiement préprod |

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

### T-A.2 — Badges, labels, jamais la couleur seule (2026-08-19)

**Ce qui est vérifié (code + arbre d'accessibilité Chrome).** Ce n'est **pas** un audit lecteur d'écran.

- Formulaires via `Field` : `<label htmlFor>` + `aria-invalid` / `aria-describedby` ; erreurs en texte (`role="alert"`), pas seulement `border-danger`.
- Login (arbre a11y) : `textbox "Email"`, `textbox "Mot de passe"` — le nom accessible n'est pas vide.
- Landmarks shell : `main#contenu`, `nav` nommé (`aria-label`, ex. « Navigation famille »), `aside` / `header` (complémentaire / bannière). Nom de l'utilisateur en `sr-only` dans le bandeau.
- `Badge` : toujours des enfants textuels (`HORSE_STATUS_LABELS`, `INVOICE_STATUS_LABELS`, `DOCUMENT_STATUS_LABELS`, `ATTENDANCE_STATUS_LABELS`, « En cours » / « Planifié », « Banni » / « Actif », « Lue » / « Nouvelle », « Favori »). Jamais une pastille couleur vide.
- Planning : pastilles de légende `aria-hidden` **et** libellé `COURSE_STATUS_LABELS` ; événements FullCalendar avec `aria-label` incluant le statut (`formatEventAriaLabel`).
- Occupation boxes : `role="img"` + `aria-label` chiffré ; barres de charge cheval `aria-hidden` avec les heures en texte adjacent.

**Reste à faire par un humain.** Parcours NVDA (Windows) ou VoiceOver (macOS) : annonce réelle des badges, des erreurs de formulaire, du skip-link, du piège de focus des modales, et des événements du planning. Mesure des contrastes (jetons, dont `danger-fg` du Lot 6) et revue RGAA 4.1 / WCAG 2.1 AA hors T-A.1–T-A.2.

### Fiche d'écart (T-A)

| ID test | Gravité | Description | Correctif | Statut |
|---|---|---|---|---|
| T-A.1 | Mineure | Tiroir de navigation mobile : pas de piège de focus (hors parcours desktop T-A.1). | À traiter si recette mobile / RGAA complète. | Ouvert |
| T-A.2 | Mineure | Critère « jamais couleur seule » OK en code ; aucune session lecteur d'écran consignée. | Exécuter NVDA ou VoiceOver et annexer le journal. | Ouvert |
| T-A.1 | Info | Piège de focus `Dialog` non rejoué live (seed sans séances à venir). | Spot-check manuel sur une fiche avec modale (absence, facture, confirmation). | Ouvert |

---

## 5. Critères de passage en production

- [ ] La suite étendue Playwright (E2E-1 à E2E-13) est **verte** en CI sur `develop`
- [ ] Recette manuelle E2E-1 à E2E-13 validée en préprod avec seed recette (`npm run e2e` ou CI)
- [ ] Journal §4 complété avec date, exécutant et observations
- [ ] Contrôles T-S.1 à T-S.4 et T-A.1 à T-A.2 sans écart bloquant (T-A.1 OK ; T-A.2 sans écart bloquant sur le critère « couleur seule », session lecteur d'écran restante ; T-S.x non exécutés)
- [ ] Variables `.env.prod` renseignées (secrets ≥ 32 car., SMTP, certificats SSL)
- [ ] Sauvegarde PostgreSQL testée et procédure de rollback documentée

---

## 6. Traçabilité et conformité

- Matrice US → code → tests : `docs/traceabilite.md`
- RGPD (consentement médical, anonymisation, durées) : `docs/rgpd.md`
- Plan de démonstration soutenance : `docs/soutenance-plan.md`

