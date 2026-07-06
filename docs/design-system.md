# EQUIME — Design System

> Document de référence UI. Toute interface doit dériver de ces tokens.
> Aucune couleur, police ou espacement hors de ce document.
> Implémentation : Tailwind CSS 4 — les tokens sont déclarés dans `apps/web/src/styles/index.css` (voir §10).

---

## 1. Direction

**Élégance équestre, sobriété numérique.** Un centre équestre haut de gamme : nuit bleue profonde, or discret, typographie de caractère. L'application doit paraître **calme et fiable** — c'est un outil de gestion quotidien, pas une vitrine marketing.

**Règle signature — « l'or est rare » :** l'or `#c9a84c` est réservé à **une seule chose par écran** : l'action principale (bouton primaire) ou la donnée clé (KPI, prix). Tout le reste vit en navy, blanc cassé et gris bleuté. Si un écran contient de l'or à plus de deux endroits, c'est un bug de design.

Trois principes d'exécution :
1. **La hiérarchie par la typographie, pas par la couleur.** Un titre Cormorant suffit à structurer ; on n'ajoute pas de fond coloré pour « faire section ».
2. **Les surfaces créent la profondeur.** Trois niveaux de fond maximum (`background` → `surface` → `surface-raised`), jamais d'ombres lourdes.
3. **Le statut se lit d'un coup d'œil.** Chevaux, factures, présences : chaque état métier a une couleur sémantique fixe et un badge cohérent partout dans l'app.

---

## 2. Couleurs (tokens)

| Token | Hex | Usage | Contraste vérifié |
|---|---|---|---|
| `background` | `#0b1220` | Fond de page | — |
| `surface` | `#162033` | Cartes, panneaux, sidebar | — |
| `surface-raised` | `#1e2a42` | Modales, dropdowns, hover de ligne | — |
| `border` | `#243350` | Bordures, séparateurs | — |
| `text` | `#f5f3ee` | Texte principal | ✅ AAA sur background/surface |
| `muted` | `#8fa0c0` | Texte secondaire, labels, placeholders | ✅ AA sur background/surface |
| `primary` | `#c9a84c` | **Or** — action principale, KPI clé, lien actif | ✅ AA large sur navy |
| `primary-light` | `#e6c76a` | Hover de l'or | — |
| `primary-fg` | `#0b1220` | Texte sur fond or | ✅ AAA |
| `accent` | `#2351a4` | Bleu — sélection calendrier, éléments actifs secondaires | — |
| `success` | `#3d9a6b` | Payé, présent, cheval `fit` | |
| `warning` | `#d4a017` | Repos, en attente, alerte de charge | |
| `danger` | `#c94c4c` | Erreur, blessé, impayé, destructif | |
| `info` | `#4a8fd4` | Information neutre | |

**Interdits :** blanc pur `#ffffff` (toujours `text`), noir pur, dégradés décoratifs, or en fond de grande surface.

**Fonds sémantiques** (badges, alertes) : couleur sémantique à **15 % d'opacité** en fond + couleur pleine en texte/bordure. Ex. badge « Payé » : fond `success/15`, texte `success`.

---

## 3. Typographie

| Rôle | Police | Classe | Usage |
|---|---|---|---|
| Display | **Cormorant Garamond 700** | `font-display` | H1, KPIs chiffrés, nom de l'app |
| Display semi | Cormorant Garamond 600 | `font-display-semi` | H2, titres de cartes |
| Corps | **Outfit 400–500** | `font-sans` | Texte, formulaires, tableaux |
| UI forte | Outfit 600–700 | `font-sans font-semibold` | Boutons, onglets, labels de badge |

Échelle (Tailwind) :

| Élément | Classes |
|---|---|
| H1 page | `font-display text-3xl md:text-4xl text-text` |
| H2 section | `font-display-semi text-2xl text-text` |
| H3 / titre de carte | `font-sans font-semibold text-lg text-text` |
| Corps | `font-sans text-base text-text` |
| Secondaire / meta | `font-sans text-sm text-muted` |
| Label formulaire | `font-sans text-sm font-medium text-muted uppercase tracking-wide` |
| KPI | `font-display text-4xl text-primary` + label `text-sm text-muted` |

Cormorant **jamais** en dessous de `text-xl` (illisible en petit), **jamais** dans les formulaires ni les tableaux.

---

## 4. Espacement, rayons, élévation

- Grille d'espacement : multiples de 4 px. Padding de carte : `p-5` (mobile `p-4`). Écart entre cartes : `gap-4`.
- Rayons : `rounded-xl` (12 px) pour cartes et modales, `rounded-lg` (8 px) pour boutons et inputs, `rounded-full` pour badges et avatars. **Un seul style de rayon par famille**, pas de mélange.
- Élévation : pas de box-shadow marquée sur fond sombre — la profondeur vient du **changement de surface** + une bordure `border`. Modales : `shadow-2xl` autorisé + overlay `background/80`.
- Largeur max du contenu : `max-w-7xl mx-auto` (admin), `max-w-3xl` (formulaires).

---

## 5. Composants

### Button
| Variant | Style | Usage |
|---|---|---|
| `primary` | fond `primary`, texte `primary-fg`, hover `primary-light` | **Max 1 par écran** — action principale |
| `secondary` | fond `surface-raised`, texte `text`, bordure `border` | Actions courantes |
| `ghost` | transparent, texte `muted`, hover texte `text` | Actions tertiaires, icônes |
| `danger` | fond `danger`, texte `text` | Destructif — toujours avec confirmation |

Tailles `sm / md / lg` (h-8 / h-10 / h-12). État loading : spinner + texte conservé (pas de bouton qui rétrécit). Disabled : opacité 50 % + `cursor-not-allowed`.

### Badge de statut (mapping métier fixe)
| Donnée | Valeur → couleur |
|---|---|
| Cheval | fit → `success` · rest → `warning` · unavailable → `muted` · injured → `danger` |
| Facture | paid → `success` · sent → `info` · overdue → `danger` · draft → `muted` · cancelled → `muted` barré |
| Présence | present → `success` · pending → `muted` · absent → `danger` · excused → `warning` |
| Cours | scheduled → `info` · ongoing → `accent` · completed → `success` · cancelled → `muted` |
| Incident | low → `info` · medium → `warning` · high/critical → `danger` |

Forme : `rounded-full px-2.5 py-0.5 text-xs font-semibold`, fond sémantique 15 % + texte plein. Libellés français via `packages/shared/labels.js`.

### Card
`bg-surface border border-border rounded-xl p-5`. Titre optionnel en `font-display-semi`. Variante cliquable : `hover:bg-surface-raised transition-colors` + curseur pointer sur toute la carte.

### Inputs (react-hook-form)
- `bg-surface-raised border border-border rounded-lg h-10 px-3 text-text placeholder:text-muted`
- Focus : `ring-2 ring-primary/60 border-primary` (le seul usage secondaire de l'or autorisé)
- Erreur : bordure `danger` + message `text-sm text-danger` sous le champ, lié par `aria-describedby`
- Label toujours visible au-dessus (jamais placeholder seul)

### Table
En-tête : `text-xs uppercase tracking-wide text-muted`, fond `surface`. Lignes : séparateur `border`, hover `surface-raised`. Alignement : texte à gauche, montants et nombres à droite. Sur mobile : les tableaux denses (factures, membres) basculent en liste de cartes.

### EmptyState
Icône lucide en `muted`, une phrase d'invitation à l'action, bouton `primary` si une action existe. Ex : « Aucun cavalier enregistré. Ajoutez votre premier cavalier pour commencer. »

### Skeleton
Blocs `bg-surface-raised animate-pulse rounded-lg` reproduisant la forme du contenu attendu. Jamais de spinner plein écran.

### Modale / Toast
Modale : `surface-raised`, titre `font-display-semi`, actions alignées à droite (secondaire à gauche du primaire), fermeture Échap + clic overlay. Toast : succès `success`, erreur `danger`, auto-dismiss 4 s, coin bas-droit (bas centré mobile).

---

## 6. Layouts par rôle

| Rôle | Structure |
|---|---|
| Visiteur | Vitrine une colonne, hero plein écran (H1 Cormorant grand format sur `background`, un seul CTA or) |
| Client | Barre d'onglets (bas sur mobile, haut sur desktop) : Accueil · Réservations · Famille · Facturation · Messages |
| Moniteur | Header simple + planning en écran principal, accès rapides (incidents, messages) en icônes ghost |
| Admin | **Sidebar fixe** `surface` (icônes + libellés, item actif : texte `primary` + barre verticale or 2 px) + zone de contenu `max-w-7xl` |

Calendrier planning : jour sélectionné en `accent`, pastilles de séances en couleur de statut, aujourd'hui cerclé `primary`.

---

## 7. Iconographie & imagerie

- **lucide-react** exclusivement, taille 20 px par défaut (16 px dans les badges/inputs), `stroke-width: 2`, couleur `muted` par défaut, `text` au hover/actif.
- Photos (chevaux, vitrine) : `rounded-xl`, ratio 4/3 ou 16/9 fixe, avec fallback `surface-raised` + icône si absente.

---

## 8. États & interactions

- Transitions : `transition-colors duration-150` uniquement. Pas d'animations d'entrée décoratives ; respecter `prefers-reduced-motion`.
- Focus clavier : `focus-visible:ring-2 ring-primary/60` sur **tout** élément interactif — non négociable.
- Zones cliquables ≥ 40 × 40 px sur mobile.
- Actions destructives : toujours une modale de confirmation nommant l'objet (« Supprimer le cheval Ouragan ? »).
- Formulaire en soumission : bouton en loading, champs désactivés, jamais de double soumission.

---

## 9. Accessibilité (rappels bloquants)

- Contrastes : `text` et `muted` validés AA sur les trois surfaces ; ne jamais mettre `muted` sur `surface-raised` en dessous de `text-sm`.
- Chaque icône seule porte un `aria-label`.
- Le statut n'est **jamais** porté par la couleur seule : badge = couleur + libellé texte.
- Ordre de tabulation logique, `<main>`, `<nav>`, landmarks ARIA sur les layouts.

---

## 10. Config Tailwind 4 (extrait à reprendre tel quel)

Tailwind 4 déclare le thème directement en CSS (`@theme`), dans `apps/web/src/styles/index.css` :

```css
@import 'tailwindcss';

@theme {
  --color-background: #0b1220;
  --color-surface: #162033;
  --color-surface-raised: #1e2a42;
  --color-border: #243350;
  --color-text: #f5f3ee;
  --color-muted: #8fa0c0;
  --color-primary: #c9a84c;
  --color-primary-light: #e6c76a;
  --color-primary-fg: #0b1220;
  --color-accent: #2351a4;
  --color-success: #3d9a6b;
  --color-warning: #d4a017;
  --color-danger: #c94c4c;
  --color-info: #4a8fd4;

  --font-display: 'Cormorant Garamond', serif;
  --font-sans: 'Outfit', system-ui, sans-serif;
}

/* Display = Cormorant 700 ; Display semi = Cormorant 600 (voir §3) */
@utility font-display {
  font-family: var(--font-display);
  font-weight: 700;
}
@utility font-display-semi {
  font-family: var(--font-display);
  font-weight: 600;
}
```

Les classes générées sont identiques à la v3 (`bg-surface-raised`, `text-muted`, `ring-primary/60`…) : le reste du document s'applique tel quel.

Polices chargées via `@fontsource/cormorant-garamond` (600, 700) et `@fontsource/outfit` (400, 500, 600, 700), importées dans `apps/web/src/main.jsx` — pas de CDN Google Fonts (RGPD).

---

## 11. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Un seul bouton or par écran | De l'or sur les bordures de cartes, les icônes de nav, les fonds |
| Cormorant pour H1/H2/KPIs uniquement | Cormorant dans un tableau ou un input |
| Badge = fond 15 % + texte sémantique + libellé | Pastille de couleur seule sans texte |
| Profondeur par changement de surface | Ombres portées multiples sur fond sombre |
| EmptyState avec action | Écran vide ou « Aucune donnée » sec |
| Skeleton à la forme du contenu | Spinner plein écran |