// @ts-check
import { ROLES } from '@equime/shared';

import * as courseService from '../services/courseService.js';

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listPublicCourses(_req, res) {
  const courses = await courseService.listPublicCourses();
  res.json({ courses });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createCourse(req, res) {
  const course = await courseService.createCourse(req.body);
  res.status(201).json({ course });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function getCourse(req, res) {
  const course = await courseService.getCourse(req.params.id);
  res.json({ course });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateCourse(req, res) {
  const course = await courseService.updateCourse(req.params.id, req.body);
  res.json({ course });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function cancelCourse(req, res) {
  await courseService.cancelCourse(req.params.id, req.body.cancelSeries);
  res.status(204).send();
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function getPlanning(req, res) {
  const events = await courseService.getPlanningEvents({
    from: req.query.from,
    to: req.query.to,
    scope: req.query.scope,
    userId: req.user.id,
    role: req.user.role,
  });
  res.json({ events });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listEnrollable(req, res) {
  const courses = await courseService.listEnrollableCourses(req.user.id);
  res.json({ courses });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listMyEnrollments(req, res) {
  const enrollments = await courseService.listFamilyUpcomingEnrollments(req.user.id);
  res.json({ enrollments });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function enroll(req, res) {
  const force = req.user.role === ROLES.ADMIN && (req.body.force === true || req.query.force === true);
  const enrollment = await courseService.enrollRider(req.user.id, req.params.id, req.body.riderId, {
    role: req.user.role,
    force,
  });
  res.status(201).json({ enrollment });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listEnrollments(req, res) {
  const enrollments = await courseService.listEnrollments(req.params.id);
  res.json({ enrollments });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateAttendance(req, res) {
  const enrollment = await courseService.updateAttendance(
    req.params.id,
    req.params.enrollmentId,
    req.body.attendance,
    { id: req.user.id, role: req.user.role }
  );
  res.json({ enrollment });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function assignHorses(req, res) {
  const result = await courseService.assignHorses(req.params.id);
  res.json(result);
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listHorseOptions(req, res) {
  const options = await courseService.getHorseOverrideOptions(req.params.id, req.params.enrollmentId);
  res.json({ options });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function overrideHorse(req, res) {
  const enrollment = await courseService.overrideHorse(
    req.params.id,
    req.params.enrollmentId,
    req.body.horseId
  );
  res.json({ enrollment });
}
