// @ts-check
/**
 * Seed de RECETTE (préproduction) — jeu de données réaliste et anonymisé,
 * volumétrie représentative d'un centre équestre en activité.
 *
 * Déterministe (RNG seedé) : deux exécutions produisent le même jeu de données,
 * condition d'un cahier de recette rejouable.
 *
 * Contenu : 25 familles clientes (~35 cavaliers), 2 moniteurs, 1 admin,
 * 15 chevaux, 3 espaces, 6 séries de cours sur 8 semaines (dont 4 semaines
 * passées avec présences renseignées), factures sur 3 mois, événements,
 * incidents, missions bénévolat, conversations.
 *
 * Usage : npm run seed:recette -w apps/api (préprod uniquement — jamais en prod)
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

import {
  addMinutes,
  addWeeks,
  createRng,
  hashPassword,
  nextWeekday,
  resetDatabase,
} from './seed-helpers.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const rng = createRng(20260706);
/** @template T @param {T[]} arr @returns {T} */
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
/** @param {number} min @param {number} max */
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));

const FIRST_NAMES = [
  'Camille',
  'Jade',
  'Louis',
  'Léa',
  'Hugo',
  'Manon',
  'Nathan',
  'Zoé',
  'Tom',
  'Inès',
  'Maël',
  'Rose',
  'Sacha',
  'Nina',
  'Gabin',
  'Eva',
  'Noah',
  'Lily',
  'Arthur',
  'Alice',
  'Jules',
  'Chloé',
  'Adam',
  'Louna',
  'Théo',
  'Mila',
  'Raphaël',
  'Anna',
  'Léon',
  'Julia',
  'Marius',
  'Romy',
  'Timéo',
  'Iris',
  'Côme',
];
const LAST_NAMES = [
  'Martin',
  'Bernard',
  'Thomas',
  'Petit',
  'Robert',
  'Richard',
  'Durand',
  'Dubois',
  'Moreau',
  'Laurent',
  'Simon',
  'Michel',
  'Lefebvre',
  'Leroy',
  'Roux',
  'David',
  'Bertrand',
  'Morel',
  'Fournier',
  'Girard',
  'Bonnet',
  'Dupont',
  'Lambert',
  'Fontaine',
  'Rousseau',
];
const LEVELS = [
  'initiation',
  'galop_1',
  'galop_2',
  'galop_3',
  'galop_4',
  'galop_5',
  'galop_6',
  'galop_7',
];

async function main() {
  await resetDatabase(prisma);
  const passwordHash = await hashPassword('Recette!2026');

  // --- Abonnements & réductions ---
  const plans = [];
  for (const data of [
    {
      name: 'Découverte',
      priceCents: 4900,
      sessionsPerWeek: 1,
      description: '1 séance par semaine',
    },
    {
      name: 'Classique',
      priceCents: 8900,
      sessionsPerWeek: 2,
      description: '2 séances par semaine',
    },
    {
      name: 'Intensif',
      priceCents: 12900,
      sessionsPerWeek: 3,
      description: '3 séances par semaine',
    },
  ]) {
    plans.push(await prisma.subscriptionPlan.create({ data }));
  }
  await prisma.discountRule.createMany({
    data: [
      {
        label: 'Famille nombreuse',
        description: '2 cavaliers ou plus',
        percentage: 10,
        minRiders: 2,
      },
      { label: 'Tribu', description: '3 cavaliers ou plus', percentage: 15, minRiders: 3 },
    ],
  });

  // --- Équipe ---
  const admin = await prisma.user.create({
    data: {
      email: 'admin@recette.equime.local',
      passwordHash,
      firstName: 'Direction',
      lastName: 'Equime',
      role: 'admin',
    },
  });
  const instructors = [];
  for (let i = 1; i <= 2; i += 1) {
    instructors.push(
      await prisma.user.create({
        data: {
          email: `moniteur${i}@recette.equime.local`,
          passwordHash,
          firstName: pick(FIRST_NAMES),
          lastName: pick(LAST_NAMES),
          role: 'instructor',
        },
      })
    );
  }

  // --- 25 familles clientes, ~35 cavaliers ---
  const riders = [];
  const families = [];
  for (let i = 1; i <= 25; i += 1) {
    const lastName = LAST_NAMES[(i - 1) % LAST_NAMES.length];
    const plan = pick(plans);
    const user = await prisma.user.create({
      data: {
        email: `client${String(i).padStart(2, '0')}@recette.equime.local`,
        passwordHash,
        firstName: pick(FIRST_NAMES),
        lastName,
        role: 'client',
        banned: i === 25, // un compte banni pour la recette du module membres
        family: { create: { subscriptionPlanId: plan.id, sessionQuota: plan.sessionsPerWeek * 4 } },
      },
      include: { family: true },
    });
    const family = /** @type {NonNullable<typeof user.family>} */ (user.family);
    families.push({ user, family });
    const riderCount = i <= 8 ? 2 : 1; // 8 familles à 2 cavaliers
    for (let r = 0; r < riderCount; r += 1) {
      const level = pick(LEVELS);
      riders.push(
        await prisma.rider.create({
          data: /** @type {any} */ ({
            familyId: family.id,
            firstName: pick(FIRST_NAMES),
            lastName,
            birthdate: new Date(Date.UTC(randInt(2008, 2018), randInt(0, 11), randInt(1, 28))),
            level,
            medicalCertificateStatus: pick([
              'approved',
              'approved',
              'approved',
              'pending',
              'missing',
            ]),
            licenseStatus: pick(['approved', 'approved', 'pending', 'missing']),
            medicalConsentAt: rng() > 0.2 ? new Date() : null,
          }),
        })
      );
    }
  }

  // --- Espaces & cavalerie ---
  const spaces = [];
  for (const data of [
    { name: 'Manège principal', type: 'indoor', capacity: 12 },
    { name: 'Carrière de dressage', type: 'outdoor', capacity: 16 },
    { name: 'Paddock des poneys', type: 'paddock', capacity: 8 },
  ]) {
    spaces.push(await prisma.space.create({ data: /** @type {any} */ (data) }));
  }

  const HORSES = [
    ['Ouragan', 'Selle Français', 2015, 'fit', 'galop_3', 'galop_7'],
    ['Caramel', 'Poney Landais', 2016, 'fit', 'initiation', 'galop_2'],
    ['Tempête', 'Anglo-Arabe', 2013, 'fit', 'galop_4', 'galop_7'],
    ['Réglisse', 'Shetland', 2018, 'fit', 'initiation', 'galop_1'],
    ['Indigo', 'Connemara', 2014, 'fit', 'galop_2', 'galop_5'],
    ['Perle', 'Camargue', 2012, 'rest', 'galop_1', 'galop_4'],
    ['Eclair', 'Selle Français', 2011, 'fit', 'galop_5', 'galop_7'],
    ['Noisette', 'Poney Français de Selle', 2017, 'fit', 'initiation', 'galop_3'],
    ['Baron', 'Trotteur Français', 2010, 'unavailable', 'galop_3', 'galop_6'],
    ['Luna', 'Pottok', 2016, 'fit', 'initiation', 'galop_2'],
    ['Sultan', 'Pur-sang Arabe', 2013, 'injured', 'galop_4', 'galop_7'],
    ['Biscotte', 'Haflinger', 2015, 'fit', 'galop_1', 'galop_4'],
    ['Orion', 'KWPN', 2014, 'fit', 'galop_5', 'galop_7'],
    ['Pompon', 'Shetland', 2019, 'fit', 'initiation', 'galop_1'],
    ['Vénus', 'Lusitanien', 2012, 'fit', 'galop_3', 'galop_6'],
  ];
  const horses = [];
  for (const [name, breed, birthYear, status, minLevel, maxLevel] of HORSES) {
    horses.push(
      await prisma.horse.create({
        data: /** @type {any} */ ({
          name,
          breed,
          birthYear,
          status,
          minLevel,
          maxLevel,
          weeklyLoadHours: randInt(0, 8),
        }),
      })
    );
  }

  // --- Affinités : ~2 par cavalier ---
  for (const rider of riders) {
    const favorite = pick(horses);
    let avoid = pick(horses);
    if (avoid.id === favorite.id) avoid = pick(horses);
    await prisma.horseAffinity.create({
      data: { riderId: rider.id, horseId: favorite.id, affinity: 'favorite' },
    });
    if (avoid.id !== favorite.id) {
      await prisma.horseAffinity.create({
        data: { riderId: rider.id, horseId: avoid.id, affinity: 'avoid' },
      });
    }
  }

  // --- Carnet de santé ---
  for (const horse of horses) {
    await prisma.horseHealthLog.create({
      data: /** @type {any} */ ({
        horseId: horse.id,
        authorId: admin.id,
        type: pick(['veterinarian', 'farrier', 'dentist', 'care', 'observation']),
        notes: 'Visite de routine — RAS',
        occurredAt: addWeeks(new Date(), -randInt(1, 8)),
      }),
    });
  }

  // --- 6 séries hebdo sur 8 semaines : 4 passées (présences), 4 à venir ---
  const seriesDefs = [
    {
      title: 'Baby poney',
      weekday: 3,
      hour: 10,
      durationMin: 45,
      space: spaces[2],
      minLevel: 'initiation',
      maxLevel: 'galop_1',
      capacity: 6,
    },
    {
      title: 'Débutants Galop 1-2',
      weekday: 3,
      hour: 16,
      durationMin: 60,
      space: spaces[0],
      minLevel: 'galop_1',
      maxLevel: 'galop_2',
      capacity: 10,
    },
    {
      title: 'Cours Galop 2-4',
      weekday: 2,
      hour: 18,
      durationMin: 60,
      space: spaces[0],
      minLevel: 'galop_2',
      maxLevel: 'galop_4',
      capacity: 10,
    },
    {
      title: 'Dressage Galop 3-5',
      weekday: 4,
      hour: 17,
      durationMin: 60,
      space: spaces[1],
      minLevel: 'galop_3',
      maxLevel: 'galop_5',
      capacity: 8,
    },
    {
      title: 'Obstacle Galop 4-6',
      weekday: 6,
      hour: 11,
      durationMin: 90,
      space: spaces[1],
      minLevel: 'galop_4',
      maxLevel: 'galop_6',
      capacity: 8,
    },
    {
      title: 'Perfectionnement Galop 5+',
      weekday: 6,
      hour: 9,
      durationMin: 90,
      space: spaces[1],
      minLevel: 'galop_5',
      maxLevel: 'galop_7',
      capacity: 8,
    },
  ];
  const levelIndex = /** @param {string} lvl */ (lvl) => LEVELS.indexOf(lvl);
  let enrollmentCount = 0;
  for (const [index, def] of seriesDefs.entries()) {
    const firstStart = addWeeks(nextWeekday(def.weekday, def.hour), -4);
    const instructor = instructors[index % instructors.length];
    const eligible = riders.filter(
      (r) =>
        levelIndex(r.level) >= levelIndex(def.minLevel) &&
        levelIndex(r.level) <= levelIndex(def.maxLevel)
    );
    const enrolled = eligible.slice(0, Math.min(def.capacity - 1, eligible.length));
    /** @type {string | null} */
    let parentId = null;
    for (let week = 0; week < 8; week += 1) {
      const startAt = addWeeks(firstStart, week);
      const isPast = startAt < new Date();
      const course = await prisma.course.create({
        data: /** @type {any} */ ({
          title: def.title,
          instructorId: instructor.id,
          spaceId: def.space.id,
          startAt,
          endAt: addMinutes(startAt, def.durationMin),
          capacity: def.capacity,
          minLevel: def.minLevel,
          maxLevel: def.maxLevel,
          status: isPast ? 'completed' : 'scheduled',
          ...(week === 0
            ? { recurrenceRule: 'weekly', recurrenceEndDate: addWeeks(firstStart, 8) }
            : { parentCourseId: parentId }),
        }),
      });
      if (week === 0) parentId = course.id;
      for (const rider of enrolled) {
        const fitHorses = horses.filter(
          (h) =>
            h.status === 'fit' &&
            levelIndex(rider.level) >= levelIndex(h.minLevel) &&
            levelIndex(rider.level) <= levelIndex(h.maxLevel)
        );
        const horse = isPast && fitHorses.length > 0 ? pick(fitHorses) : null;
        await prisma.courseEnrollment.create({
          data: /** @type {any} */ ({
            courseId: course.id,
            riderId: rider.id,
            horseId: horse?.id ?? null,
            horseAssignedAt: horse ? startAt : null,
            attendance: isPast
              ? pick(['present', 'present', 'present', 'present', 'absent', 'excused'])
              : 'pending',
          }),
        });
        enrollmentCount += 1;
      }
    }
  }

  // --- Événements ---
  const stage = await prisma.event.create({
    data: {
      title: 'Stage vacances — progression Galop',
      description: 'Stage de 3 jours, tous niveaux à partir du Galop 1.',
      type: 'stage',
      startAt: addWeeks(new Date(), 3),
      endAt: addWeeks(addMinutes(new Date(), 3 * 24 * 60), 3),
      capacity: 12,
      priceCents: 15000,
      location: 'Centre équestre Equime',
    },
  });
  const concours = await prisma.event.create({
    data: {
      title: 'Concours interne de dressage',
      description: 'Compétition amicale ouverte à tous les cavaliers du club.',
      type: 'competition_internal',
      startAt: addWeeks(new Date(), 5),
      endAt: addWeeks(addMinutes(new Date(), 8 * 60), 5),
      capacity: 30,
      priceCents: 800,
      location: 'Carrière de dressage',
    },
  });
  for (const rider of riders.slice(0, 10)) {
    await prisma.eventRegistration.create({
      data: /** @type {any} */ ({
        eventId: rng() > 0.5 ? stage.id : concours.id,
        riderId: rider.id,
        status: pick(['confirmed', 'confirmed', 'pending']),
      }),
    });
  }

  // --- Factures : 3 mois d'abonnements par famille ---
  let invoiceNumber = 0;
  for (const { family } of families) {
    const plan = plans.find((p) => p.id === family.subscriptionPlanId) ?? plans[0];
    for (let month = 3; month >= 1; month -= 1) {
      invoiceNumber += 1;
      const isPast = month > 1;
      const status = isPast ? pick(['paid', 'paid', 'paid', 'overdue']) : pick(['sent', 'draft']);
      await prisma.invoice.create({
        data: /** @type {any} */ ({
          familyId: family.id,
          number: `REC-2026-${String(invoiceNumber).padStart(4, '0')}`,
          status,
          issuedAt: status === 'draft' ? null : addWeeks(new Date(), -month * 4),
          dueAt: status === 'draft' ? null : addWeeks(new Date(), -month * 4 + 2),
          totalCents: plan.priceCents,
          paidAt: status === 'paid' ? addWeeks(new Date(), -month * 4 + 1) : null,
          items: {
            create: [
              {
                label: `Abonnement ${plan.name}`,
                quantity: 1,
                unitCents: plan.priceCents,
                totalCents: plan.priceCents,
              },
            ],
          },
        }),
      });
    }
  }

  // --- Incidents, bénévolat, messagerie ---
  for (let i = 0; i < 5; i += 1) {
    await prisma.incident.create({
      data: /** @type {any} */ ({
        reportedById: pick(instructors).id,
        horseId: pick(horses).id,
        riderId: rng() > 0.5 ? pick(riders).id : null,
        severity: pick(['low', 'low', 'medium', 'high', 'critical']),
        status: rng() > 0.4 ? 'resolved' : 'open',
        description: 'Incident consigné pour la recette — description anonymisée.',
        occurredAt: addWeeks(new Date(), -randInt(0, 4)),
        resolvedAt: rng() > 0.4 ? new Date() : null,
      }),
    });
  }

  const mission = await prisma.volunteerMission.create({
    data: {
      title: 'Préparation du concours interne',
      description: 'Montage des lices, décoration, buvette.',
      startAt: addWeeks(new Date(), 5),
      slots: 6,
    },
  });
  for (const { user } of families.slice(0, 4)) {
    await prisma.volunteerSignup.create({ data: { missionId: mission.id, userId: user.id } });
  }

  for (const { user } of families.slice(0, 6)) {
    await prisma.conversation.create({
      data: {
        subject: 'Question planning',
        participants: { create: [{ userId: user.id }, { userId: pick(instructors).id }] },
        messages: {
          create: [
            {
              senderId: user.id,
              body: 'Bonjour, la séance de la semaine prochaine est-elle maintenue ?',
            },
          ],
        },
      },
    });
  }

  // --- Préférences de notification pour tous les comptes ---
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const types = [
    'subscription_confirmed',
    'invoice_created',
    'payment_confirmed',
    'invoice_reminder',
    'registration_confirmed',
    'course_enrolled',
    'course_cancelled',
    'rider_absence',
  ];
  await prisma.notificationPreference.createMany({
    data: allUsers.flatMap((user) =>
      types.map((type) => /** @type {any} */ ({ userId: user.id, type }))
    ),
  });

  const counts = {
    users: await prisma.user.count(),
    riders: await prisma.rider.count(),
    horses: await prisma.horse.count(),
    courses: await prisma.course.count(),
    enrollments: enrollmentCount,
    invoices: await prisma.invoice.count(),
  };
  console.error('Seed recette terminé :', JSON.stringify(counts));
}

main()
  .catch((err) => {
    console.error('Échec du seed recette :', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
