# UML — Diagramme de séquence : attribution automatique des chevaux

> Livrable Phase 1. Pièce maîtresse métier, implémentée en Phase 4 :
> `assignHorsesForSession(courseId)` dans `apps/api/src/services/horseAssignment.js`.
> Architecture : **fonction de scoring pure** (testable sans base) + **orchestration transactionnelle**.

## Règles métier

| Règle | Valeur |
|---|---|
| Chevaux éligibles | statut `fit` **ET** charge hebdomadaire < maximum |
| Score : affinité `favorite` | **+10** |
| Score : niveau cavalier dans la plage du cheval | **+5** |
| Score : affinité `avoid` | **−15** |
| Score : charge hebdomadaire | **−5 × heures** déjà travaillées |
| Attribution | meilleur cheval disponible, non déjà pris dans la séance |
| Effet | `weeklyLoadHours` incrémenté de la durée du cours |
| Atomicité | tout ou rien — `prisma.$transaction` |

## Séquence

```mermaid
sequenceDiagram
    autonumber
    actor M as Moniteur
    participant W as SPA React<br/>(détail séance)
    participant A as API Express<br/>POST /courses/:id/assign-horses
    participant C as courseController
    participant S as horseAssignmentService
    participant P as scoreRiderHorse()<br/>(fonction pure)
    participant DB as PostgreSQL (transaction)
    participant R as Redis

    M->>W: clic « Attribuer les chevaux »
    W->>A: POST /api/v1/courses/:id/assign-horses (Bearer)
    A->>A: requireAuth + requireRole(instructor, admin)
    A->>A: validate(paramsSchema) — Zod
    A->>C: assignHorses(courseId)
    C->>S: assignHorsesForSession(courseId)

    S->>DB: BEGIN prisma.$transaction
    activate DB
    S->>DB: séance + inscriptions sans cheval (avec cavalier)
    S->>DB: chevaux `fit` AND chargeHebdo < chargeMax
    S->>DB: affinités des cavaliers concernés
    S->>DB: chevaux déjà attribués dans la séance

    loop pour chaque inscription sans cheval
        S->>P: scoreRiderHorse(cavalier, cheval, affinité, charge)<br/>pour chaque cheval candidat
        P-->>S: score = +10 favori · +5 niveau · −15 avoid · −5×h
        S->>S: trie les candidats, écarte les chevaux<br/>déjà pris dans la séance
        alt un cheval disponible
            S->>DB: UPDATE course_enrollments SET horseId, horseAssignedAt
            S->>DB: UPDATE horses SET weeklyLoadHours += duréeCours
            S->>S: marque le cheval comme pris (séance)
        else aucun cheval éligible restant
            S->>S: consigne un conflit {inscription, raison}
        end
    end

    S->>DB: COMMIT
    deactivate DB
    S->>R: DEL cache:planning:* — invalidation
    S-->>C: {attributions[], conflits[]}
    C-->>A: 200
    A-->>W: {attributions, conflits}
    W->>W: rafraîchit la séance (TanStack Query invalidate)
    W-->>M: chevaux affichés + conflits signalés

    Note over S,DB: En cas d'erreur en cours de boucle :<br/>ROLLBACK complet — aucune attribution partielle
```

## Audit de compatibilité (batch admin)

```mermaid
sequenceDiagram
    autonumber
    actor AD as Admin
    participant A as API Express<br/>POST /admin/compatibility-audit
    participant S as horseAssignmentService
    participant DB as PostgreSQL

    AD->>A: POST /api/v1/admin/compatibility-audit
    A->>A: requireAuth + requireRole(admin)
    A->>S: runCompatibilityAudit()
    S->>DB: séances à venir + inscriptions + chevaux + affinités
    loop pour chaque séance à venir
        S->>S: simulation d'attribution (scoring pur, SANS écriture)
    end
    S-->>A: rapport {séance, scores, conflits, chevaux manquants}
    A-->>AD: 200 — rapport affiché sur le dashboard
    Note over S: lecture seule : l'audit ne modifie<br/>ni inscriptions ni charges
```

## Découpage testable (Phase 4)

| Unité | Type de test | Cas couverts |
|---|---|---|
| `scoreRiderHorse()` | unitaire pur | nominal, favori, avoid, niveau hors plage, cumul charge |
| `assignHorsesForSession()` | unitaire (Prisma mocké) + intégration | cas nominal, cheval surchargé, aucun cheval éligible, égalité de scores (départage déterministe), cheval déjà pris dans la séance, rollback sur erreur |
| `runCompatibilityAudit()` | intégration | rapport complet, absence d'écriture en base |
