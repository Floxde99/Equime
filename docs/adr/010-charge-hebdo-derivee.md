# ADR 010 — Charge hebdomadaire des chevaux dérivée des affectations

- **Statut** : accepté (remplace le compteur `Horse.weeklyLoadHours`)
- **Décideur** : développeur principal
- **Date** : 2026-09-24
- **User story** : US-10.1 (v1.1, préparation du club pilote)

## Contexte

La charge hebdomadaire est au cœur de l'attribution automatique (US-5.1) :
éligibilité (`charge < maxWeeklyLoadHours`), pénalité de score (−5 × heures),
alertes du dashboard. Elle était stockée dans un compteur `Horse.weeklyLoadHours`,
incrémenté à chaque attribution et décrémenté lors d'un override ou d'une
annulation de stage.

L'analyse de la roadmap v1.1 a mis en évidence trois défauts :

1. **Aucune remise à zéro hebdomadaire.** Le compteur ne faisait que monter. Au
   bout de quelques semaines d'usage réel, tous les chevaux dépassaient leur
   plafond et l'attribution automatique ne trouvait plus aucun cheval :
   **bloquant pour le club pilote**.
2. **Pas de notion de semaine.** Attribuer une séance dans trois semaines
   chargeait le cheval « maintenant » ; une séance du lundi et une du mois
   suivant s'additionnaient.
3. **Dérive à chaque cas oublié.** L'annulation d'un cours (`cancelCourse`) ou
   l'absence excusée d'un cavalier ne décrémentaient rien.

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| A — Tâche planifiée qui remet le compteur à zéro chaque lundi | Correctif minimal | Ne règle ni la semaine de la séance (2), ni la dérive (3) ; dépend d'une tâche qui doit tourner exactement une fois |
| B — Compteur par semaine (table `horse_weekly_loads`) | Lecture rapide | Même dérive qu'aujourd'hui : chaque chemin d'écriture doit penser à mettre à jour la table |
| **C — Valeur dérivée, calculée à la lecture** | Toujours exacte, par construction ; semaine de la séance respectée ; aucun chemin d'écriture à maintenir | Une requête d'agrégation par lecture |

## Décision

**Option C.** La charge d'un cheval pour une semaine ISO est calculée à partir
des affectations réelles (`apps/api/src/services/horseLoad.js`) :

| Source | Comptée si | Heures retenues |
|---|---|---|
| `CourseEnrollment.horseId` | séance non annulée, cavalier non excusé | durée de la séance |
| `EventRegistration.horseId` | inscription non annulée | part du stage comprise dans la semaine |

- **Semaine** : ISO, du lundi 00:00 au lundi suivant 00:00, **heure de Paris**
  (`lib/weeks.js`, `CLUB_TIME_ZONE`). Le serveur tourne en UTC ; les semaines de
  changement d'heure durent 167 h ou 169 h.
- **Semaine de référence** : celle de la **séance à pourvoir** pour l'attribution,
  l'override et l'audit ; la **semaine en cours** pour les fiches chevaux, les
  alertes et le dashboard.
- **Contrat d'API inchangé** : les réponses exposent toujours `weeklyLoadHours`,
  désormais calculé. Le front n'a pas eu à changer.
- La colonne `horses.weeklyLoadHours` est **supprimée** (migration
  `20260924100000_horse_derived_weekly_load`) pour qu'aucun code ne puisse la
  réintroduire par erreur.

Les fonctions de scoring (`scoreRiderHorse`, `rankCandidateHorses`,
`simulateHorseAssignments`) restent pures et inchangées : elles reçoivent des
chevaux déjà enrichis de leur charge.

## Conséquences

- `horseAssignment.js` : plus aucune écriture de charge ; `assignmentWriter`
  n'écrit que l'affectation.
- `eventService.cancelRegistration` : libérer la monture suffit.
- `horseService` / `adminService` : charge calculée à la lecture (`withWeeklyLoad`).
- Performance : deux requêtes indexées (`course_enrollments.horseId`,
  `event_registrations.horseId`) par lecture, bornées à une semaine. Négligeable
  à l'échelle d'un centre (15 à 60 chevaux) ; à surveiller en multi-club (v1.3).
- Seeds : la charge de démonstration découle des séances attribuées. Le tirage
  aléatoire de l'ancienne colonne est conservé dans `seed-recette.js` pour que le
  jeu de recette reste identique.
- Tests : `weeks.test.js` (DST, bascule dimanche/lundi, changement d'année),
  `horseLoad.test.js` (chevauchement, agrégation) et tests d'intégration
  (semaine précédente ignorée, séance annulée, cavalier excusé, stage).
- **Limite connue** : un stage de plusieurs jours compte en heures continues
  (`endAt − startAt`), nuits comprises, comme avant. Un modèle de créneaux
  journaliers pour les stages reste à concevoir.
