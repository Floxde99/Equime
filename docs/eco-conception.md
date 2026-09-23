# Éco-conception — Equime

> Répond au critère CDA C6 « Les besoins d'éco-conception de l'application sont
> identifiés » (RE TP-01281 v04). Référentiel : **RGESN 2024** (Arcep et Arcom, mai 2024,
> 78 critères en 9 thématiques : stratégie, spécifications, architecture, UX/UI, contenus,
> frontend, backend, hébergement, algorithmie), issu de la loi REEN.

## 1. Méthode de mesure : EcoIndex

L'EcoIndex (collectif GreenIT) note une page de 0 à 100, puis de A à G, à partir de
trois mesures pondérées :

| Mesure | Poids | Pourquoi |
|---|---|---|
| Taille du DOM (nombre d'éléments) | 3 | Coût de calcul du rendu (processeur, batterie) |
| Nombre de requêtes HTTP | 2 | Coût d'établissement de chaque échange réseau |
| Poids transféré (Ko) | 1 | Énergie du réseau et du centre de données |

Formule et quantiles : implémentation de référence `cnumr/ecoindex_python`.
Grades : A > 80, B > 70, C > 55, D > 40.

Protocole : page d'accueil (vitrine publique), fenêtre de 1280 × 800, même build de
production servi en local (`vite preview`) avant et après correction, et toutes les
images chargées (comme lorsque l'EcoIndex fait défiler la page).

## 2. Mesures

| | Production (avant) | Local avant | Local après | Après, arrivée sans défiler |
|---|---|---|---|---|
| Éléments DOM | 183 | 172 | 183 | 183 |
| Requêtes | 28 | 28 | 29 | 23 |
| Poids transféré | 1 232 Ko | 1 288 Ko | **529 Ko** | 397 Ko |
| dont images | 992 Ko | 990 Ko | **230 Ko** | 100 Ko |
| **EcoIndex** | **79 / B** | **79 / B** | **82 / A** | **84 / A** |
| Émissions estimées par visite | 1,42 g CO₂e | | 1,36 g CO₂e | |

Le DOM passe de 172 à 183 éléments à cause des liens vers les pages légales ajoutés
en pied de page. Les requêtes échouent en local (pas d'API), sans effet sur les images.

**Poids de la page : −59 %. Poids des images : −77 %.**

## 3. Diagnostic et correction

Les images pesaient **80 %** de la page et étaient toutes téléchargées en 1536 px,
quelle que soit leur taille d'affichage :

| Image | Téléchargée avant | Affichée (1280 px) | Téléchargée après |
|---|---|---|---|
| Vignettes « programme » ×3 | 1536 px, ≈ 110 Ko | 368 px | 480 px, ≈ 17 Ko |
| Images « expérience » ×2 | 1536 px, 180 et 258 Ko | 593 px | 640 à 1200 px selon l'écran, 35 à 41 Ko |
| Avatar du témoignage | 1024 × 1024, 66 Ko | 56 × 56 | 112 × 112, **2 Ko** |
| Photo d'accueil | 1536 px, 156 Ko | pleine largeur | 768 / 1280 / 1536 px selon l'écran |

Corrections appliquées :

1. **Variantes redimensionnées** générées par `scripts/optimize-images.mjs` (bibliothèque
   `sharp`, WebP qualité 80, jamais d'agrandissement) ; les originaux sont conservés.
2. **`srcSet` + `sizes`** dans `HomePage.jsx` : le navigateur choisit la plus petite
   image suffisante pour son écran et sa densité de pixels.
3. **`loading="lazy"` + `decoding="async"`** sur toutes les images sous la ligne de
   flottaison. Un visiteur qui ne fait pas défiler la page ne télécharge que 397 Ko.
4. **`width` / `height`** renseignés : le navigateur réserve la place, sans saut de mise en page.

## 4. Autres mesures d'éco-conception en place

| Thématique RGESN | Mesure | Où |
|---|---|---|
| Frontend | **Code-splitting** par page : bundle initial réduit de 309 à 162 Ko gzip ; le calendrier (228 Ko) ne se charge que sur les pages planning | `apps/web/src/router.jsx` (`lazyNamed`) |
| Frontend | Polices **hébergées localement** (aucun appel à un service tiers), sous-ensemble latin uniquement | `@fontsource/*` |
| Contenus | Images en **WebP** | `apps/web/public/images/` |
| Backend | **Cache Redis** du planning (5 min, vidé à chaque modification) | `apps/api/src/services/planningCache.js` |
| Backend | Listes bornées : notifications limitées aux 50 dernières | `notificationService.js` |
| UX/UI | Rafraîchissements **bornés** : cloche toutes les 30 s ; confirmation de paiement limitée à 2 min | `useNotificationsQuery.js`, `ClientInvoicesPage.jsx` |
| Stratégie | **Minimisation des données** : un seul cookie, aucun traceur ni outil d'analyse d'audience | `docs/rgpd.md` |
| Hébergement | Un seul VPS mutualisé pour la préprod et la prod (conteneurs isolés), images Alpine légères | `docker-compose.*.yml` |

## 5. Pistes identifiées (non réalisées)

- Appliquer la même optimisation aux images des espaces connectés (ex. `ecuries-or.webp`,
  180 Ko pour une colonne de 320 px sur la page Factures).
- Réduire les graisses de police chargées (5 fichiers, 89 Ko).
- Publier une déclaration d'éco-conception RGESN au passage en production réelle.
