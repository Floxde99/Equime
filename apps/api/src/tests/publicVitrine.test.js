/**
 * Tests d'intégration — vitrine publique (Excel 1.2).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

import {
  createUser,
  familyIdOf,
  resetAuthTables,
  resetCoreTables,
  resetRateLimits,
} from './coreHelpers.js';

const app = createApp();

beforeEach(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await resetRateLimits();
});

afterAll(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

describe('GET /api/v1/public/courses', () => {
  it('liste les séances à venir avec les champs publics seulement', async () => {
    const instructor = await createUser({ email: 'coach-vitrine@test.fr', role: 'instructor' });
    const client = await createUser({ email: 'eleve-vitrine@test.fr', role: 'client' });
    const familyId = await familyIdOf(client.id);
    const space = await prisma.space.create({
      data: { name: 'Manège vitrine', type: 'indoor', capacity: 12 },
    });
    const upcomingStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pastStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const upcoming = await prisma.course.create({
      data: {
        title: 'Dressage débutants',
        instructorId: instructor.id,
        spaceId: space.id,
        startAt: upcomingStart,
        endAt: new Date(upcomingStart.getTime() + 60 * 60 * 1000),
        capacity: 4,
        status: 'scheduled',
      },
    });
    await prisma.course.create({
      data: {
        title: 'Cours passé',
        instructorId: instructor.id,
        spaceId: space.id,
        startAt: pastStart,
        endAt: new Date(pastStart.getTime() + 60 * 60 * 1000),
        capacity: 4,
        status: 'scheduled',
      },
    });
    await prisma.course.create({
      data: {
        title: 'Brouillon',
        instructorId: instructor.id,
        spaceId: space.id,
        startAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        capacity: 4,
        status: 'draft',
      },
    });

    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Emma',
        lastName: 'Secret',
        birthdate: new Date('2012-01-01'),
        level: 'galop_2',
      },
    });
    await prisma.courseEnrollment.create({
      data: { courseId: upcoming.id, riderId: rider.id },
    });

    const res = await request(app).get('/api/v1/public/courses');

    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
    expect(res.body.courses[0]).toMatchObject({
      id: upcoming.id,
      title: 'Dressage débutants',
      type: 'indoor',
      remainingSpots: 3,
    });
    expect(res.body.courses[0]).not.toHaveProperty('instructorId');
    expect(res.body.courses[0]).not.toHaveProperty('enrollments');
    expect(JSON.stringify(res.body)).not.toMatch(/Emma|Secret|eleve-vitrine/i);
  });
});
