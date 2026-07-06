# ADR 005 — Tailwind CSS 4 (config CSS-first)

- **Statut** : accepté (Phase 0)
- **Décideur** : développeur principal · **Proposé par** : assistant

## Contexte

Le design system (`docs/design-system.md`) définit les tokens (couleurs navy/or, typographies Cormorant/Outfit) initialement au format `tailwind.config.js` de Tailwind 3. Tailwind 4 (standard actuel, défaut de shadcn/ui) déplace la configuration dans le CSS (`@theme`).

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| Tailwind 3 | Reprise « telle quelle » de l'extrait du design system | Version en fin de cycle pour un projet neuf, divergence avec l'outillage shadcn actuel |
| **Tailwind 4** | Version courante et maintenue, moteur plus rapide, configuration co-localisée avec le CSS, défaut de l'écosystème shadcn 2026 | Transposition (mécanique) des tokens nécessaire |

## Décision

**Tailwind 4.** Les tokens sont déclarés dans `apps/web/src/styles/index.css` via `@theme`, à l'identique (mêmes noms, mêmes hexadécimaux) ; les classes générées (`bg-surface-raised`, `text-muted`, `ring-primary/60`…) sont inchangées par rapport à la v3, le reste du design system s'applique donc tel quel. La section 10 du design system a été mise à jour en conséquence.

## Conséquences

- Plugin `@tailwindcss/vite` (pas de PostCSS à configurer).
- Utilitaires personnalisés `font-display` (Cormorant 700) et `font-display-semi` (Cormorant 600) via `@utility`.
- Polices auto-hébergées par `@fontsource` (RGPD : pas de CDN Google Fonts).
- Sujet de veille suggéré (RESEARCH-LOG personnel) : « Tailwind 3 → 4 : migration CSS-first ».
