# Veille sécurité — Equime

> Section exigée par le référentiel d'évaluation CDA (RE TP-01281 v04) : « description
> de la veille, effectuée par le candidat durant le projet, sur les vulnérabilités de
> sécurité, description des vulnérabilités éventuellement trouvées et des failles
> potentiellement corrigées ». Couvre aussi le critère C10 : « le système de veille
> permet de suivre les principales évolutions technologiques et les problématiques de
> sécurité liées au déploiement ».

## 1. Sources suivies

| Source | Ce qu'elle couvre | Fréquence |
|---|---|---|
| [CERT-FR](https://www.cert.ssi.gouv.fr/) (ANSSI) : avis et alertes | Vulnérabilités des produits (Node.js, nginx, PostgreSQL…) | Hebdomadaire |
| `npm audit` + GitHub Security Advisories | Dépendances npm du monorepo | **À chaque push** (CI, `scripts/audit-ci.mjs`) |
| [OWASP Top 10](https://top10.owasp.org/2025) | Catégories de risques applicatifs | À chaque nouvelle édition |
| Bulletins de sécurité Node.js | Runtime de l'API et du build | À chaque release de sécurité |
| [endoflife.date](https://endoflife.date/) | Fin de support des images de base (Node, nginx, PostgreSQL, Redis) | Mensuelle |
| Notes de version de GitHub Actions | Chaîne CI/CD | À chaque avertissement de la CI |

## 2. Méthode de tri : l'exploitabilité avant le score

Un score CVSS élevé ne suffit pas à décider. Pour chaque alerte :

1. **Le code vulnérable est-il présent en production ?** (dépendance de dev, de build, ou d'exécution)
2. **Est-il atteignable ?** (la fonction ou l'option vulnérable est-elle réellement appelée)
3. **Décision** : corriger, mettre à jour, ou accepter avec une **justification nominative et datée**.

Les exceptions acceptées vivent dans `scripts/audit-ci.mjs`. Toute nouvelle faille
élevée ou critique non listée **fait échouer la CI**. À la date de réexamen, le script
signale l'exception comme échue.

## 3. Vulnérabilités analysées

| # | Vulnérabilité | Analyse | Décision |
|---|---|---|---|
| 1 | **`qs` ≤ 6.15.3**, [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) (contournement de limite de tableau) et [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) (déni de service), modérées | Dépendance d'Express. **Non exploitable ici** : Express 5 analyse les paramètres de requête avec le parseur `simple` (`node:querystring`) et non `qs` ; l'API n'utilise pas `express.urlencoded` ; la première faille exige l'option `comma: true` | **Mise à jour vers 6.16.0** (`npm update qs`, compatible avec les plages d'Express). Corriger même sans exploitation possible évite qu'un changement de config futur l'active |
| 2 | **Node.js** : avis CERT-FR du 19/06/2026, CVE-2026-21637 (TLS/SNICallback) et CVE-2026-21710 (en-tête `__proto__`), déni de service à distance | Images en `node:22-alpine`, **étiquette flottante**. Mais `docker compose up --build` réutilise l'image de base **en cache** sur le VPS : les correctifs (22.22.2) n'étaient jamais récupérés | **`build --pull`** ajouté à `scripts/deploy-vps.sh` : chaque déploiement récupère la dernière image corrigée |
| 3 | **`nginx:1.27-alpine`** (image web) | **Fin de vie depuis le 24/06/2025** (dernier correctif 1.27.5) : plus aucun correctif de sécurité | **Passage à `nginx:1.30-alpine`**, branche stable courante |
| 4 | **`deepmerge-ts`**, [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), élevée | Uniquement dans la CLI Prisma (`@prisma/config`), **absente de l'image de production** (`npm ci --omit=dev`). L'entrée du merge est `prisma.config.js`, un fichier du dépôt non contrôlable par un tiers. Seul correctif proposé : Prisma 6, incompatible | Exception acceptée, réexamen le 19/11/2026 |
| 5 | **`fast-uri`** (4 advisories : SSRF, confusion d'hôte), élevées | Via `ajv` dans `@prisma/dev`, outillage de la CLI Prisma, absent de la production | Exceptions acceptées, réexamen le 23/12/2026 |
| 6 | **`mysql2`**, [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), élevée | Version figée par la CLI Prisma 7 ; Equime utilise **PostgreSQL**, le pilote MySQL n'est jamais chargé | Exception acceptée, réexamen le 23/12/2026 |
| 7 | **Compromission de paquets npm** (septembre 2025, compte d'un mainteneur piraté) | Risque de chaîne d'approvisionnement : un paquet légitime publie une version malveillante | Déjà couvert : **lockfile** versionné, **`npm ci`** (installation stricte du lockfile), audit bloquant en CI |
| 8 | **Actions GitHub en v4** (dépréciation de Node 20 sur les runners) | Avertissements CI ; fin de support annoncée | Passage de `checkout`, `setup-node` et `upload-artifact` en **v7**, après lecture des notes de version (aucun changement cassant pour nos usages) |

## 4. Failles trouvées dans le code et corrigées

Revue de code de la branche Stripe et notifications (PR #7) :

| Faille | Impact | Correctif |
|---|---|---|
| Le webhook marquait une facture payée sur `checkout.session.completed` **sans vérifier `payment_status`** | Avec un moyen de paiement différé (SEPA), facture « payée » alors que les fonds n'étaient pas encaissés | Encaissement seulement si `payment_status === 'paid'` ; `async_payment_failed` tracé |
| Nouvelle session Checkout créée à chaque clic, l'ancienne restant payable | **Double débit** possible | Réutilisation de la session encore ouverte |
| Passage à « payée » par lecture puis écriture | Webhook et confirmation simultanés : notification et email en double | `updateMany` conditionnel (`sent`/`overdue` → `paid`), une seule notification |
| Capacité d'événement vérifiée sans verrou (READ COMMITTED) | Surbooking de la dernière place | `SELECT … FOR UPDATE` sur l'événement |
| Rejeu d'un refresh token juste après sa rotation (second onglet) | Révocation injustifiée de toute la session | Fenêtre de grâce de 10 s, code `REFRESH_RACE` qui n'efface pas le cookie |

Et hors revue, trouvée en préparant le jeu d'essai (ADR 009) :

| Faille | Impact | Correctif |
|---|---|---|
| L'attribution automatique pouvait placer un cavalier **sous le niveau minimum** du cheval | **Sécurité physique** : galop 1 sur un cheval galop 3–7 | Exclusion automatique, avertissement dans l'override |

## 5. Suivi OWASP Top 10:2025

La version finale de l'OWASP Top 10:2025 (publiée en janvier 2026) remplace la 2021.
La correspondance mesure ↔ risque est tenue à jour dans `docs/securite.md`. Deux
catégories nouvelles concernent directement ce projet :

- **A03:2025 Software Supply Chain Failures** : lockfile, `npm ci`, audit bloquant avec exceptions datées (§3, lignes 4 à 7).
- **A10:2025 Mishandling of Exceptional Conditions** : gestion d'erreurs centralisée, rate limiting qui bloque quand Redis tombe, idempotence des paiements (§4).
