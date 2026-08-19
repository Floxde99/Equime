# EQUIME — Design System

> Document de référence UI. Toute interface doit dériver de ces tokens.
> Aucune couleur, police ou espacement hors de ce document.
> Implémentation : Tailwind CSS 4 — les tokens sont déclarés dans `apps/web/src/styles/index.css` (voir §10).
> Maquette source : projet Stitch « Gestion Centre Équestre » (vert forêt, cartes claires).

---

## 1. Direction

**Sobriété équestre.** Toute l’app suit la vitrine Stitch : fond papier `#f6f4ef`, cartes et headers **blancs**, titres **Cormorant Garamond**, corps Outfit, vert forêt `#1b4332`. L’encre `#0c1210` est réservée aux overlays (hero, CTA vitrine). Espaces connectés : sidebar claire, item actif barre verte.

**Règle signature — « le vert est rare » :** le vert `#1b4332` est réservé aux CTA et au KPI clé dans l’app. La vitrine Stitch autorise header + hero + bandeau citation (comme la maquette).

Trois principes d'exécution :
1. **La hiérarchie par la typographie, pas par la couleur.** Un titre Cormorant suffit à structurer.
2. **Les surfaces créent la profondeur.** Papier (`background` / `paper`) → blanc (`card` / `surface`) → hover (`surface-raised`). Jamais d'ombres lourdes hors modales.
3. **Le statut se lit d'un coup d'œil.** Chevaux, factures, présences : chaque état métier a une couleur sémantique fixe et un badge cohérent partout dans l'app.

---

## 2. Couleurs (tokens)

| Token | Hex | Usage | Contraste vérifié |
|---|---|---|---|
| `ink` | `#0c1210` | Hero vitrine, CTA final, overlay | — |
| `background` | `#f6f4ef` | Fond des espaces connectés | — |
| `surface` | `#ffffff` | Header client/moniteur | — |
| `surface-raised` | `#eeeae1` | Hover nav claire | — |
| `border` | `#e4e0d6` | Bordures | — |
| `text` | `#1a1a1a` | Texte courant | ✅ AAA |
| `card` | `#ffffff` | Cartes, vitrine, formulaires | — |
| `on-card` | `#1a1a1a` | Texte sur carte / vitrine — classe `text-on-card` | ✅ AAA |
| `muted-on-card` | `#5c6b63` | Secondaire sur fond clair | ✅ AA |
| `border-on-card` | `#e4e0d6` | Bordures sur fond clair | — |
| `paper` | `#f6f4ef` | Bandes vitrine, footer | — |
| `gold` | `#c4a35a` | Sceau « Grand manège » vitrine uniquement | — |
| `primary` | `#1b4332` | **Vert forêt Stitch** — CTA | ✅ AA large |
| `primary-light` | `#2d6a4f` | Hover du vert | — |
| `primary-fg` | `#ffffff` | Texte sur fond vert | ✅ AAA |
| `accent` | `#2f6b45` | Sélection calendrier, état actif secondaire | — |
| `success` | `#3d9a6b` | Payé, présent, cheval `fit` | |
| `warning` | `#d4a017` | Repos, en attente, alerte de charge | |
| `danger` | `#c94c4c` | Erreur, blessé, impayé, destructif | |
| `info` | `#4a8fd4` | Information neutre | |

**Interdits :** or hors sceau vitrine, dégradés décoratifs, vert en fond de grande surface dans l’app (hors bandeau citation vitrine).

**Fonds sémantiques** (badges, alertes) : couleur sémantique à **15 % d'opacité** en fond + couleur pleine en texte/bordure.

---

## 3. Typographie

| Rôle | Police | Classe | Usage |
|---|---|---|---|
| Display | **Cormorant Garamond 600** | `font-display` | H1, wordmark, citations |
| Display semi | Cormorant 600 | `font-display-semi` | H2 |
| Corps | **Outfit 400–500** | `font-sans` | Texte, formulaires, tableaux |
| UI forte | Outfit 600–700 | `font-sans font-semibold` | Boutons, onglets, labels de badge |

Échelle (Tailwind) :

| Élément | Classes |
|---|---|
| H1 page | `font-display text-3xl md:text-4xl text-text` |
| H2 section | `font-display-semi text-2xl text-text` |
| H3 / titre de carte | `font-sans font-semibold text-lg` (hérite `text-on-card` dans une Card) |
| Corps | `font-sans text-base` |
| Secondaire / meta | `font-sans text-sm text-muted` (chrome) ou `text-muted-on-card` (carte) |
| Label formulaire | `font-sans text-sm font-medium text-muted-on-card uppercase tracking-wide` |
| KPI | `font-display text-4xl text-primary` + label `text-sm text-muted` |

---

## 4. Espacement, rayons, élévation

- Grille d'espacement : multiples de 4 px. Padding de carte : `p-5` (mobile `p-4`). Écart entre cartes : `gap-4`.
- Rayons : `rounded-xl` (12 px) pour cartes et modales, `rounded-lg` (8 px) pour boutons et inputs, `rounded-full` pour badges et avatars.
- Élévation : pas de box-shadow marquée. Modales : `shadow-2xl` autorisé + overlay `ink/80`.
- Largeur max du contenu : `max-w-7xl mx-auto` (admin), `max-w-3xl` (formulaires).

---

## 5. Composants

### Button
| Variant | Style | Usage |
|---|---|---|
| `primary` | fond `primary`, texte `primary-fg`, hover `primary-light` | **Max 1 par écran** — action principale |
| `secondary` | bordure `border-on-card`, fond `card`, texte courant | Actions courantes |
| `ghost` | transparent, texte `muted`, hover `paper` | Actions tertiaires, icônes |
| `danger` | fond `danger`, texte blanc | Destructif — toujours avec confirmation |

Tailles `sm / md / lg` (h-8 / h-10 / h-12). État loading : spinner + texte conservé + `aria-busy`. Disabled : opacité 50 % + `cursor-not-allowed`.

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
`bg-card text-on-card border border-border-on-card rounded-xl p-5`. Titre optionnel en `font-sans font-semibold`. Variante cliquable : `hover:bg-card/90 transition-colors`.

### Inputs (react-hook-form)
- `bg-card border border-border-on-card rounded-lg h-10 px-3 text-on-card placeholder:text-muted-on-card`
- Focus : `ring-2 ring-primary/60 border-primary` (seul usage secondaire du vert autorisé)
- Erreur : bordure `danger` + message `text-sm text-danger` sous le champ, lié par `aria-describedby`
- Label toujours visible au-dessus (jamais placeholder seul)

### Table
En-tête : `text-xs uppercase tracking-wide text-muted-on-card`, fond `card`. Lignes : séparateur `border-on-card`. Sur mobile : tableaux denses en liste de cartes.

### EmptyState
Icône lucide en `muted-on-card`, une phrase d'invitation, bouton `primary` si une action existe.

### Skeleton
Blocs `bg-surface-raised animate-pulse rounded-lg` reproduisant la forme du contenu. Jamais de spinner plein écran. Respecter `prefers-reduced-motion`.

### Modale / Toast
Modale : `card`, titre semibold, actions alignées à droite (secondaire à gauche du primaire), fermeture Échap + clic overlay. Toast : succès `success`, erreur `danger`, auto-dismiss 4 s.

---

## 6. Layouts par rôle

| Rôle | Structure |
|---|---|
| Visiteur | **Landing Stitch (fond `card`)** : header blanc (logo · ancres · Login ghost · un bouton `primary` « Nous rejoindre »), hero photo plein écran, programmes 3 colonnes, bandeau citation `primary`, événements en rangées, CTA final sur `background`. Photos locales `public/images/` |
| Client | Sidebar claire `w-72` (item actif : barre verticale 4 px `primary`) + header sticky Equime + cloche + initiales. CTA sidebar « Réserver ». Drawer hamburger mobile. |
| Moniteur | Même chrome. CTA sidebar « Faire l’appel ». |
| Admin | Même chrome. CTA sidebar « Nouveau cours ». Zone contenu `max-w-7xl`. |

Calendrier planning : jour sélectionné en `accent`, pastilles de séances en couleur de statut, aujourd'hui cerclé `primary`.

Lien d'évitement « Aller au contenu » en tête de chaque layout.

---

## 7. Iconographie & imagerie

- **lucide-react** exclusivement pour l’UI (taille 20 px par défaut, 16 px dans les badges/inputs), `stroke-width: 2`.
- Marque équestre : `HorseIcon` (fer à cheval) + `BrandLockup` — pas de patte d’animal.
- Photos (vitrine) : fichiers locaux `apps/web/public/images/`, `rounded-xl`, ratio 16/9, fallback `surface-raised` + fer à cheval si absente. Pas de CDN.

---

## 8. États & interactions

- Transitions : `transition-colors duration-150` uniquement. Respecter `prefers-reduced-motion`.
- Focus clavier : `focus-visible:ring-2 ring-primary/60` sur **tout** élément interactif.
- Zones cliquables ≥ 40 × 40 px sur mobile.
- Actions destructives : toujours une modale de confirmation nommant l'objet (« Supprimer le cheval Ouragan ? »).
- Formulaire en soumission : bouton en loading (`aria-busy`), champs désactivés.

---

## 9. Accessibilité (rappels bloquants)

- Contrastes : `text`/`muted` AA sur papier ; `text-on-card`/`muted-on-card` AA sur `card` ; `primary-fg` AAA sur sidebar `primary`.
- Chaque icône seule porte un `aria-label`.
- Le statut n'est **jamais** porté par la couleur seule : badge = couleur + libellé texte.
- Ordre de tabulation logique, `<main>`, `<nav>`, landmarks ARIA, skip link.

---

## 10. Config Tailwind 4 (extrait)

```css
@import 'tailwindcss';

@theme {
  --color-ink: #0c1210;
  --color-background: #f6f4ef;
  --color-surface: #ffffff;
  --color-surface-raised: #eeeae1;
  --color-border: #e4e0d6;
  --color-text: #1a1a1a;
  --color-muted: #5c6b63;
  --color-card: #ffffff;
  --color-on-card: #1a1a1a;
  --color-muted-on-card: #5c6b63;
  --color-border-on-card: #e4e0d6;
  --color-paper: #f6f4ef;
  --color-gold: #c4a35a;
  --color-primary: #1b4332;
  --color-primary-light: #2d6a4f;
  --color-primary-fg: #ffffff;
  --color-accent: #2d6a4f;

  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-sans: 'Outfit', system-ui, sans-serif;
}
```

Polices chargées via `@fontsource/cormorant-garamond` et `@fontsource/outfit` dans `apps/web/src/main.jsx` — pas de CDN Google Fonts (RGPD).

---

## 11. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Un seul bouton vert par écran **dans l’app** ; vitrine Stitch : header + hero + CTA de clôture | Du vert sur les bordures de cartes, les icônes de nav, les fonds de l’espace connecté |
| Outfit pour le corps, Cormorant pour les titres (vitrine Stitch) | Police CDN Google Fonts |
| Badge = fond 15 % + texte sémantique + libellé | Pastille de couleur seule sans texte |
| Profondeur papier → blanc | Ombres portées multiples |
| EmptyState avec action | Écran vide ou « Aucune donnée » sec |
| Skeleton à la forme du contenu | Spinner plein écran |
