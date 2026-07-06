// @ts-check
/**
 * Seed de DÉVELOPPEMENT — jeu de données minimal mais complet pour travailler.
 *
 * Comptes (mot de passe commun : Equime!2026) :
 *   admin@equime.local  (admin)  · coach@equime.local (moniteur)
 *   lina@equime.local   (client) · alex@equime.local  (client)
 * 15 chevaux, 3 espaces, 3 séries de cours hebdomadaires sur 8 semaines,
 * factures variées, événements, incident, mission bénévolat, conversation.
 *
 * Usage : npm run seed -w apps/api   (réinitialise les données à chaque exécution)
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

import { addMinutes, addWeeks, hashPassword, nextWeekday, resetDatabase } from './seed-helpers.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PASSWORD = 'Equime!2026';

async function main() {
  await resetDatabase(prisma);
  const passwordHash = await hashPassword(PASSWORD);

  // --- Abonnements & réductions ---
  const [planDecouverte, planClassique] = await Promise.all(
    [
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
    ].map((data) => prisma.subscriptionPlan.create({ data }))
  );

  await prisma.discountRule.createMany({
    data: [
      {
        label: 'Famille nombreuse',
        description: '2 cavaliers ou plus dans la famille',
        percentage: 10,
        minRiders: 2,
      },
      {
        label: 'Tribu',
        description: '3 cavaliers ou plus dans la famille',
        percentage: 15,
        minRiders: 3,
      },
    ],
  });

  // --- Utilisateurs ---
  const admin = await prisma.user.create({
    data: {
      email: 'admin@equime.local',
      passwordHash,
      firstName: 'Sophie',
      lastName: 'Marchand',
      role: 'admin',
    },
  });
  const coach = await prisma.user.create({
    data: {
      email: 'coach@equime.local',
      passwordHash,
      firstName: 'Julien',
      lastName: 'Berger',
      role: 'instructor',
    },
  });
  const lina = await prisma.user.create({
    data: {
      email: 'lina@equime.local',
      passwordHash,
      firstName: 'Lina',
      lastName: 'Moreau',
      role: 'client',
      family: { create: { subscriptionPlanId: planClassique.id, sessionQuota: 8 } },
    },
    include: { family: true },
  });
  const alex = await prisma.user.create({
    data: {
      email: 'alex@equime.local',
      passwordHash,
      firstName: 'Alex',
      lastName: 'Fontaine',
      role: 'client',
      family: { create: { subscriptionPlanId: planDecouverte.id, sessionQuota: 4 } },
    },
    include: { family: true },
  });
  const linaFamily = /** @type {NonNullable<typeof lina.family>} */ (lina.family);
  const alexFamily = /** @type {NonNullable<typeof alex.family>} */ (alex.family);

  // --- Cavaliers ---
  const emma = await prisma.rider.create({
    data: {
      familyId: linaFamily.id,
      firstName: 'Emma',
      lastName: 'Moreau',
      birthdate: new Date('2014-03-12'),
      level: 'galop_3',
      medicalCertificateStatus: 'approved',
      licenseStatus: 'approved',
      medicalConsentAt: new Date(),
    },
  });
  const lucas = await prisma.rider.create({
    data: {
      familyId: linaFamily.id,
      firstName: 'Lucas',
      lastName: 'Moreau',
      birthdate: new Date('2017-09-02'),
      level: 'initiation',
      medicalCertificateStatus: 'pending',
    },
  });
  const chloe = await prisma.rider.create({
    data: {
      familyId: alexFamily.id,
      firstName: 'Chloé',
      lastName: 'Fontaine',
      birthdate: new Date('2010-06-25'),
      level: 'galop_5',
      medicalCertificateStatus: 'approved',
      licenseStatus: 'pending',
      medicalConsentAt: new Date(),
    },
  });

  // --- Espaces ---
  const [manege, carriere, paddock] = await Promise.all(
    [
      { name: 'Manège principal', type: 'indoor', capacity: 12 },
      { name: 'Carrière de dressage', type: 'outdoor', capacity: 16 },
      { name: 'Paddock des poneys', type: 'paddock', capacity: 8 },
    ].map((data) => prisma.space.create({ data: /** @type {any} */ (data) }))
  );

  // --- Cavalerie : 15 chevaux ---
  /** @type {Array<[string, string, number, string, string, string, number]>} */
  const horsesData = [
    // [nom, race, année, statut, minLevel, maxLevel, charge hebdo]
    ['Ouragan', 'Selle Français', 2015, 'fit', 'galop_3', 'galop_7', 6],
    ['Caramel', 'Poney Landais', 2016, 'fit', 'initiation', 'galop_2', 4],
    ['Tempête', 'Anglo-Arabe', 2013, 'fit', 'galop_4', 'galop_7', 8],
    ['Réglisse', 'Shetland', 2018, 'fit', 'initiation', 'galop_1', 3],
    ['Indigo', 'Connemara', 2014, 'fit', 'galop_2', 'galop_5', 5],
    ['Perle', 'Camargue', 2012, 'rest', 'galop_1', 'galop_4', 0],
    ['Eclair', 'Selle Français', 2011, 'fit', 'galop_5', 'galop_7', 7],
    ['Noisette', 'Poney Français de Selle', 2017, 'fit', 'initiation', 'galop_3', 5],
    ['Baron', 'Trotteur Français', 2010, 'unavailable', 'galop_3', 'galop_6', 0],
    ['Luna', 'Pottok', 2016, 'fit', 'initiation', 'galop_2', 4],
    ['Sultan', 'Pur-sang Arabe', 2013, 'injured', 'galop_4', 'galop_7', 0],
    ['Biscotte', 'Haflinger', 2015, 'fit', 'galop_1', 'galop_4', 6],
    ['Orion', 'KWPN', 2014, 'fit', 'galop_5', 'galop_7', 9],
    ['Pompon', 'Shetland', 2019, 'fit', 'initiation', 'galop_1', 2],
    ['Vénus', 'Lusitanien', 2012, 'fit', 'galop_3', 'galop_6', 5],
  ];
  const horses = [];
  for (const [name, breed, birthYear, status, minLevel, maxLevel, weeklyLoadHours] of horsesData) {
    horses.push(
      await prisma.horse.create({
        data: /** @type {any} */ ({
          name,
          breed,
          birthYear,
          status,
          minLevel,
          maxLevel,
          weeklyLoadHours,
        }),
      })
    );
  }
  const byName = /** @param {string} n */ (n) => {
    const horse = horses.find((h) => h.name === n);
    if (!horse) throw new Error(`Cheval de seed introuvable : ${n}`);
    return horse;
  };

  // --- Affinités ---
  await prisma.horseAffinity.createMany({
    data: [
      { riderId: emma.id, horseId: byName('Indigo').id, affinity: 'favorite' },
      { riderId: emma.id, horseId: byName('Tempête').id, affinity: 'avoid' },
      { riderId: lucas.id, horseId: byName('Réglisse').id, affinity: 'favorite' },
      { riderId: lucas.id, horseId: byName('Pompon').id, affinity: 'favorite' },
      { riderId: chloe.id, horseId: byName('Eclair').id, affinity: 'favorite' },
      { riderId: chloe.id, horseId: byName('Caramel').id, affinity: 'avoid' },
    ],
  });

  // --- Carnet de santé ---
  await prisma.horseHealthLog.createMany({
    data: [
      {
        horseId: byName('Sultan').id,
        authorId: admin.id,
        type: 'veterinarian',
        notes: 'Tendinite antérieur droit — repos 6 semaines',
        occurredAt: addWeeks(new Date(), -2),
      },
      {
        horseId: byName('Perle').id,
        authorId: admin.id,
        type: 'farrier',
        notes: 'Ferrure complète',
        occurredAt: addWeeks(new Date(), -1),
      },
      {
        horseId: byName('Ouragan').id,
        authorId: coach.id,
        type: 'observation',
        notes: 'Légère raideur au trot, à surveiller',
        occurredAt: new Date(),
      },
    ],
  });

  // --- Cours : 3 séries hebdomadaires sur 8 semaines ---
  // La série est portée par la 1re séance (parent) ; les 7 suivantes pointent parentCourseId.
  /** @type {Array<{title: string, weekday: number, hour: number, durationMin: number, spaceId: string, minLevel: string, maxLevel: string, capacity: number}>} */
  const seriesDefs = [
    {
      title: 'Baby poney',
      weekday: 3,
      hour: 10,
      durationMin: 45,
      spaceId: paddock.id,
      minLevel: 'initiation',
      maxLevel: 'galop_1',
      capacity: 6,
    },
    {
      title: 'Cours Galop 2-4',
      weekday: 3,
      hour: 14,
      durationMin: 60,
      spaceId: manege.id,
      minLevel: 'galop_2',
      maxLevel: 'galop_4',
      capacity: 10,
    },
    {
      title: 'Perfectionnement Galop 5+',
      weekday: 6,
      hour: 9,
      durationMin: 90,
      spaceId: carriere.id,
      minLevel: 'galop_5',
      maxLevel: 'galop_7',
      capacity: 8,
    },
  ];
  /** @type {Record<string, import('../generated/prisma/client.js').Course[]>} */
  const seriesSessions = {};
  for (const def of seriesDefs) {
    const firstStart = nextWeekday(def.weekday, def.hour);
    const recurrenceEndDate = addWeeks(firstStart, 8);
    const parent = await prisma.course.create({
      data: /** @type {any} */ ({
        title: def.title,
        instructorId: coach.id,
        spaceId: def.spaceId,
        startAt: firstStart,
        endAt: addMinutes(firstStart, def.durationMin),
        capacity: def.capacity,
        minLevel: def.minLevel,
        maxLevel: def.maxLevel,
        status: 'scheduled',
        recurrenceRule: 'weekly',
        recurrenceEndDate,
      }),
    });
    const sessions = [parent];
    for (let week = 1; week < 8; week += 1) {
      const startAt = addWeeks(firstStart, week);
      sessions.push(
        await prisma.course.create({
          data: /** @type {any} */ ({
            title: def.title,
            instructorId: coach.id,
            spaceId: def.spaceId,
            startAt,
            endAt: addMinutes(startAt, def.durationMin),
            capacity: def.capacity,
            minLevel: def.minLevel,
            maxLevel: def.maxLevel,
            status: 'scheduled',
            parentCourseId: parent.id,
          }),
        })
      );
    }
    seriesSessions[def.title] = sessions;
  }

  // --- Inscriptions : cavaliers sur leurs séries respectives ---
  for (const session of seriesSessions['Baby poney']) {
    await prisma.courseEnrollment.create({ data: { courseId: session.id, riderId: lucas.id } });
  }
  for (const session of seriesSessions['Cours Galop 2-4']) {
    await prisma.courseEnrollment.create({ data: { courseId: session.id, riderId: emma.id } });
  }
  for (const session of seriesSessions['Perfectionnement Galop 5+']) {
    await prisma.courseEnrollment.create({ data: { courseId: session.id, riderId: chloe.id } });
  }
  // Un cheval déjà attribué sur la prochaine séance d'Emma (exemple d'attribution)
  const nextEmmaSession = seriesSessions['Cours Galop 2-4'][0];
  await prisma.courseEnrollment.update({
    where: { courseId_riderId: { courseId: nextEmmaSession.id, riderId: emma.id } },
    data: { horseId: byName('Indigo').id, horseAssignedAt: new Date() },
  });

  // --- Événements ---
  const stage = await prisma.event.create({
    data: {
      title: 'Stage vacances — progression Galop',
      description:
        'Stage de 3 jours pendant les vacances scolaires, tous niveaux à partir du Galop 1.',
      type: 'stage',
      startAt: addWeeks(new Date(), 3),
      endAt: addWeeks(addMinutes(new Date(), 3 * 24 * 60), 3),
      capacity: 12,
      priceCents: 15000,
      location: 'Centre équestre Equime',
    },
  });
  await prisma.event.create({
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
  await prisma.eventRegistration.create({
    data: { eventId: stage.id, riderId: emma.id, status: 'confirmed' },
  });

  // --- Factures variées ---
  const invoiceDefs = /** @type {const} */ ([
    {
      family: linaFamily,
      number: 'FAC-2026-0001',
      status: 'paid',
      label: 'Abonnement Classique — juin',
      total: 8010,
      paidAt: addWeeks(new Date(), -3),
    },
    {
      family: linaFamily,
      number: 'FAC-2026-0002',
      status: 'sent',
      label: 'Abonnement Classique — juillet',
      total: 8010,
      paidAt: null,
    },
    {
      family: linaFamily,
      number: 'FAC-2026-0003',
      status: 'draft',
      label: 'Stage vacances — Emma',
      total: 15000,
      paidAt: null,
    },
    {
      family: alexFamily,
      number: 'FAC-2026-0004',
      status: 'overdue',
      label: 'Abonnement Découverte — juin',
      total: 4900,
      paidAt: null,
    },
    {
      family: alexFamily,
      number: 'FAC-2026-0005',
      status: 'cancelled',
      label: 'Concours interne — annulation',
      total: 800,
      paidAt: null,
    },
  ]);
  for (const def of invoiceDefs) {
    await prisma.invoice.create({
      data: {
        familyId: def.family.id,
        number: def.number,
        status: def.status,
        issuedAt: def.status === 'draft' ? null : addWeeks(new Date(), -4),
        dueAt: def.status === 'draft' ? null : addWeeks(new Date(), -1),
        totalCents: def.total,
        paidAt: def.paidAt,
        items: {
          create: [{ label: def.label, quantity: 1, unitCents: def.total, totalCents: def.total }],
        },
      },
    });
  }

  // --- Incident, bénévolat, messagerie ---
  await prisma.incident.create({
    data: {
      reportedById: coach.id,
      horseId: byName('Ouragan').id,
      riderId: emma.id,
      severity: 'low',
      description:
        'Ouragan a trébuché à l’abord d’une cavalette, sans chute. Cavalier et cheval OK.',
      occurredAt: addWeeks(new Date(), -1),
    },
  });

  const mission = await prisma.volunteerMission.create({
    data: {
      title: 'Préparation du concours interne',
      description: 'Montage des lices, décoration de la carrière, buvette.',
      startAt: addWeeks(new Date(), 5),
      slots: 6,
    },
  });
  await prisma.volunteerSignup.create({ data: { missionId: mission.id, userId: lina.id } });

  await prisma.conversation.create({
    data: {
      subject: 'Progression d’Emma',
      participants: { create: [{ userId: lina.id }, { userId: coach.id }] },
      messages: {
        create: [
          {
            senderId: lina.id,
            body: 'Bonjour Julien, comment se passe la préparation du Galop 4 pour Emma ?',
          },
          {
            senderId: coach.id,
            body: 'Bonjour Lina ! Très bien, elle est à l’aise au trot enlevé. On travaille le galop en équilibre.',
          },
        ],
      },
    },
  });

  // --- Préférences de notification (défauts explicites pour les 4 comptes) ---
  const users = [admin, coach, lina, alex];
  const types = /** @type {const} */ ([
    'subscription_confirmed',
    'invoice_created',
    'payment_confirmed',
    'invoice_reminder',
    'registration_confirmed',
    'course_enrolled',
    'course_cancelled',
    'rider_absence',
  ]);
  await prisma.notificationPreference.createMany({
    data: users.flatMap((user) => types.map((type) => ({ userId: user.id, type }))),
  });

  const counts = {
    users: await prisma.user.count(),
    horses: await prisma.horse.count(),
    spaces: await prisma.space.count(),
    courses: await prisma.course.count(),
    enrollments: await prisma.courseEnrollment.count(),
    invoices: await prisma.invoice.count(),
  };
  console.error('Seed dev terminé :', JSON.stringify(counts));
}

main()
  .catch((err) => {
    console.error('Échec du seed :', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
