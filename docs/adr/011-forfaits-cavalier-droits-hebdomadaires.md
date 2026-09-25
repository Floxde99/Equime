# ADR 011 — Forfaits par cavalier, droits hebdomadaires, échéanciers et règlements

- **Statut** : accepté (remplace le quota de séances de la famille)
- **Décideur** : fondateur et développeur principal
- **Date** : 2026-09-25
- **User stories** : US-10.3 (rattrapages), US-10.5 (forfaits par cavalier et échéanciers)

## Contexte

Le modèle v1.0 reposait sur un compteur `Family.sessionQuota`, fixé à
« séances par semaine × 4 » lors du choix de formule, décrémenté à chaque
inscription et **jamais rechargé ni recrédité**. Conséquences relevées par l'audit :

- au 2e mois, toutes les familles sont bloquées alors qu'elles sont facturées ;
- une absence signalée ou une séance annulée par le club est perdue ;
- trois enfants partagent le quota d'une seule formule ;
- huit séances peuvent être prises la même semaine ;
- la réduction famille compte des profils cavaliers que la famille crée librement.

Chez les concurrents (Kavalog, Equimondo, Céléris), le **forfait est attaché au
cavalier**, vendu **à la saison** et payable en plusieurs fois ; une annulation
faite à temps donne un **rattrapage** limité dans le temps.

Le club pilote vend des forfaits à la saison, **payables au trimestre ou en 10 fois**,
sans cartes de séances.

## Décision

### Forfait par cavalier (`RiderSubscription`)

Un cavalier souscrit une formule pour une **saison** (bornes dans les paramètres du
club, par défaut du 1er septembre au 30 juin, heure de Paris). La souscription fige :

- le **prix de la saison** (prix de la formule, au prorata des semaines restantes si
  le cavalier arrive en cours de saison et que le réglage du club l'active) ;
- la **réduction famille** appliquée, calculée sur le nombre de cavaliers de la
  famille ayant un forfait actif sur la même saison, celui-ci compris ;
- l'**échéancier** choisi : `quarterly` ou `ten_installments`.

Un cavalier a au plus un forfait actif par saison. `SubscriptionPlan.priceCents`
devient le **prix de la saison** (la migration convertit les anciens prix mensuels
× 10 mois).

### Droit hebdomadaire

Pendant son forfait, un cavalier peut s'inscrire à `sessionsPerWeek` séances par
**semaine ISO (heure de Paris)**. Au-delà, l'inscription consomme un **crédit de
rattrapage** encore valide à la date de la séance ; sans crédit, elle est refusée
avec un message explicite. L'admin peut toujours forcer : documents et droits sont
contournés (jamais la capacité) et l'action est tracée dans le journal d'audit.

Chaque inscription garde son origine (`subscription`, `makeup`, `forced`) pour savoir
ce qu'une annulation doit rendre. Le droit de la semaine compte **toutes** les
séances du forfait de la semaine, y compris celles annulées : une séance annulée à
temps a été convertie en crédit, la compter évite de la rendre deux fois.

L'inscription pose deux verrous (`SELECT … FOR UPDATE`) : la séance, pour la
dernière place, puis le cavalier, pour le droit de la semaine. Elle est refusée
pour une séance commencée ou un créneau qui chevauche une autre séance du cavalier.

### Annulations et rattrapages (`SessionCredit`)

| Cas | Place | Crédit |
|---|---|---|
| Parent qui annule une séance du forfait **avant** le délai du club (24 h par défaut) | libérée | 1 crédit, valable N jours après la séance (60 par défaut) |
| Parent qui annule un rattrapage avant le délai | libérée | le crédit consommé est rendu |
| Parent qui annule **après** le délai | libérée | aucun |
| Séance annulée par le club | — | 1 crédit par inscrit (le crédit d'un rattrapage est rendu) |
| Inscription forcée par l'admin | libérée | aucun |

Une inscription annulée n'occupe plus de place ni de charge cheval. Un crédit est
lié à l'inscription qui l'a produit (unicité : pas de double crédit) et à celle qui
l'a consommé.

Se réinscrire à une séance annulée réactive la même inscription : un crédit produit
et encore disponible est retiré ; après une annulation tardive, le droit d'origine
est repris tel quel ; sinon les règles normales s'appliquent.

### Échéancier et règlements

Toute facture porte au moins une **échéance** (`InvoiceInstallment`) ; une facture
de forfait en porte 3 ou 10. Le montant est réparti en centimes, le reste de la
division sur la première échéance. En cas d'arrivée en cours de saison, les
échéances déjà passées sont regroupées en une **échéance immédiate**, suivie des
échéances à venir.

Les **règlements** (`Payment`) enregistrent le mode (carte en ligne ou sur place,
espèces, chèque, virement, chèques-vacances ANCV, Pass'Sport, autre), le montant, la
date et une référence (n° de chèque). Ils couvrent les échéances dans l'ordre. La
facture est payée quand les règlements couvrent son total. Stripe Checkout règle
**l'échéance suivante** ; le webhook crée le règlement (idempotent par
`PaymentIntent`).

## Conséquences

- Suppression de `Family.sessionQuota`, `Family.subscriptionPlanId` et de la
  génération mensuelle des factures d'abonnement (plus de facturation mensuelle).
- Migration : forfait saison en 10 fois pour chaque cavalier des familles abonnées
  (sans refacturation) ; une échéance et, pour les factures payées, un règlement
  sont créés pour l'historique.
- Nouvelles routes :
  - forfaits : `GET /riders/:id/subscription-preview`, `POST /riders/:id/subscriptions`,
    équivalents `/admin/riders/:riderId/…` et `POST /admin/subscriptions/:id/end` ;
  - droits : `GET /client/entitlements`, `GET /courses/enrollable?riderId=` (droit
    consommé indiqué pour chaque séance) ;
  - annulation : `DELETE /courses/:id/enrollments/:enrollmentId` (la famille ne
    modifie plus la présence) ;
  - règlements : `POST /admin/invoices/:id/payments`.
- Le chiffre d'affaires du tableau de bord additionne les règlements reçus dans le
  mois, et non plus les factures soldées.
- Limites connues : pas de remboursement automatique d'un forfait arrêté en cours
  de saison (avoir manuel, lot C) ; la réduction n'est pas recalculée
  rétroactivement si un frère ou une sœur souscrit plus tard.
