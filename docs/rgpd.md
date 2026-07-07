# Conformité RGPD — Equime

> Livrable Phase 7. Document de référence pour la soutenance CDA et l’exploitation du centre.
> Responsable de traitement : le centre équestre (client métier). Equime est l’outil de traitement.

## 1. Finalités et bases légales

| Finalité | Données concernées | Base légale (RGPD art. 6) |
|---|---|---|
| Gestion des comptes et authentification | Identité, email, mot de passe (hash), rôle | Exécution du contrat / intérêt légitime (sécurité) |
| Gestion des familles et cavaliers | Identité, date de naissance, niveau | Exécution du contrat |
| Dossier administratif cavaliers | Certificat médical, licence (fichiers) | Consentement explicite (données de santé / sensibles) |
| Planning, présences, attribution chevaux | Inscriptions, présences, affinités | Exécution du contrat |
| Facturation | Coordonnées, lignes de facturation, statuts de paiement | Obligation légale (comptabilité) + exécution du contrat |
| Messagerie, incidents, bénévolat, événements | Contenus saisis par les utilisateurs | Exécution du contrat / intérêt légitime (sécurité des personnes) |
| Notifications | Préférences, historique des notifications | Exécution du contrat |

## 2. Catégories de données traitées

- **Compte utilisateur** : email, nom, téléphone (optionnel), rôle, statut (actif / banni), dates de création.
- **Famille / cavaliers** : lien parent–enfant, profil cavalier, niveau, documents administratifs.
- **Données sensibles** : certificat médical (fichier) — **uniquement** après case de consentement dédiée côté client (`EnrollSection` / flux documents).
- **Cavalerie** : fiche cheval, carnet de santé (notes vétérinaires — données opérationnelles du centre).
- **Facturation** : factures, montants, références ; pas de stockage de données de carte bancaire (paiement simulé / marquage manuel en recette).
- **Traces techniques** : logs applicatifs (pino) sans mot de passe ni jeton en clair ; refresh tokens hashés en base.

## 3. Consentement médical

- Le téléversement du **certificat médical** exige un consentement **explicite, granulaire et révocable** (case non pré-cochée + libellé clair sur la finalité et la durée).
- Implémentation : schéma Zod côté `packages/shared` (cavaliers), contrôle API dans `riderService` / `uploads`, UI client avec mention RGPD.
- Refus du consentement : le cavalier peut être créé sans certificat ; statut document « manquant » ; pas de traitement du fichier médical.

## 4. Droits des personnes

| Droit | Mise en œuvre dans Equime |
|---|---|
| Accès | Export / consultation via l’espace client (profil, cavaliers, factures) |
| Rectification | Modification des cavaliers et du profil |
| Effacement | Suppression de compte (US-1.6) — voir anonymisation |
| Limitation / opposition | À traiter manuellement par l’administrateur du centre (hors périmètre automatique v1) |
| Portabilité | Export structuré : évolution possible (non bloquant soutenance) |

## 5. Suppression de compte et anonymisation

Conformément à la règle projet (pas de hard delete de la facturation) :

1. **Données personnelles** : email remplacé par un identifiant technique, nom/prénom/téléphone effacés ou pseudonymisés, documents médicaux supprimés du volume `/uploads`.
2. **Factures** : conservées avec référence anonymisée du payeur (obligation comptable 10 ans — voir §6).
3. **Sessions** : révocation de toute la famille de refresh tokens ; blacklist Redis des access tokens restants.
4. **Messagerie / incidents** : contenus pouvant identifier la personne sont anonymisés ou attribués à « Utilisateur supprimé » selon le modèle Prisma.

Fichiers de référence : service auth (suppression), `docs/securite.md` (contrôle d’accès).

## 6. Durées de conservation

| Donnée | Durée | Justification |
|---|---|---|
| Compte actif | Durée de la relation | Contrat |
| Logs techniques | 12 mois glissants (recommandation) | Sécurité / incident |
| Certificats médicaux | Saison sportive + 1 an | Intérêt légitime sécurité |
| Factures et pièces | 10 ans | Code de commerce |
| Tokens reset mot de passe | 1 h | Minimisation |
| Refresh tokens révoqués | Purge périodique (job à planifier en prod) | Minimisation |

## 7. Sous-traitants et transferts

- **Hébergement** : serveur du centre ou prestataire (à renseigner en fiche prod).
- **Email transactionnel** : SendGrid (UE / clauses contractuelles si hors UE).
- Pas de revente de données ; pas de profilage publicitaire.

## 8. Sécurité (mesures techniques et organisationnelles)

Voir `docs/securite.md` : chiffrement TLS, argon2id, cookies httpOnly, rate limiting, validation Zod, contrôle d’accès par rôle, IDOR testé en recette (T-S.4).

## 9. Registre et DPO

- Le centre tient le **registre des activités de traitement** (modèle CNIL) en complément de ce document.
- DPO : à désigner par le centre si seuils CNIL atteints.

## 10. Évolutions identifiées

- Export portabilité JSON/PDF.
- Purge automatisée des refresh tokens expirés.
- Journal d’audit admin (qui a consulté un certificat médical).

