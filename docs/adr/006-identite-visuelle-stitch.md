# ADR 006 — Identité visuelle Stitch (vert forêt)

- **Statut** : accepté (Phase 6 — alignement maquettes)
- **Décideur** : développeur principal · **Proposé par** : assistant

## Contexte

Le design system initial (navy `#0b1220` + or `#c9a84c`, Cormorant Garamond) visait une « élégance équestre » documentée en Phase 0. Les maquettes de référence du projet, produites dans Stitch (« Gestion Centre Équestre »), utilisent un **chrome sombre, des cartes claires et un vert forêt** comme couleur de marque, avec une typographie exclusivement sans-serif.

Conserver l’or tout en « collant à Stitch » produisait deux langages visuels incompatibles (et un argument faible en soutenance : doc ≠ maquette ≠ app).

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| Garder navy/or, layouts Stitch seulement | Pas de réécriture du DS | Écart visible avec la maquette |
| **Recalage Stitch complet** | Une seule source visuelle (maquette + DS + UI) | Mise à jour des tokens, contrastes RGAA à revalider |
| Thème hybride (or + photos Stitch) | Compromis | Ni le DS ni Stitch ne sont respectés |

## Décision

**Recalage Stitch complet.** Les tokens Tailwind (`apps/web/src/styles/index.css`) et `docs/design-system.md` adoptent le vert forêt comme `primary`, un fond papier clair, des cartes blanches, Cormorant pour les titres et Outfit pour le corps.

La règle signature devient **« le vert est rare »** : un seul bouton `primary` par écran dans l’app (la vitrine autorise header + hero + CTA de clôture).

## Conséquences

- Contrastes AA à revalider sur papier **et** cartes blanches.
- Composants `Card`, `Input`, `Field` héritent du texte foncé sur fond clair.
- **Vitrine et espaces connectés** partagent le même langage clair. Sidebar admin en `primary` (texte `primary-fg`). Photos locales (`public/images/`) — pas de CDN (RGPD). Or réservé au sceau « Grand manège » de la vitrine.
- Sujet de veille suggéré (RESEARCH-LOG personnel) : « contrastes WCAG 2.1 AA thèmes mixtes sidebar verte / pages papier ».
