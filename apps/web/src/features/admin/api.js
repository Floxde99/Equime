import { api } from '@/lib/apiClient.js';

export function fetchHorses() {
  return api.get('/horses').then((r) => r.horses);
}

/** @param {object} body */
export function createHorse(body) {
  return api.post('/horses', body).then((r) => r.horse);
}

/** @param {string} id @param {object} body */
export function updateHorse(id, body) {
  return api.patch(`/horses/${id}`, body).then((r) => r.horse);
}

/** @param {string} id */
export function deleteHorse(id) {
  return api.delete(`/horses/${id}`);
}

/** @param {string} horseId */
export function fetchHealthLogs(horseId) {
  return api.get(`/horses/${horseId}/health-logs`).then((r) => r.logs);
}

/** @param {string} horseId @param {object} body */
export function createHealthLog(horseId, body) {
  return api.post(`/horses/${horseId}/health-logs`, body).then((r) => r.log);
}

export function fetchLoadAlerts() {
  return api.get('/horses/load-alerts').then((r) => r.horses);
}

export function fetchSpaces() {
  return api.get('/spaces').then((r) => r.spaces);
}

/** @param {object} body */
export function createSpace(body) {
  return api.post('/spaces', body).then((r) => r.space);
}

/** @param {string} id @param {object} body */
export function updateSpace(id, body) {
  return api.patch(`/spaces/${id}`, body).then((r) => r.space);
}

/** @param {string} id */
export function deleteSpace(id) {
  return api.delete(`/spaces/${id}`);
}

/** @param {object} body */
export function createCourse(body) {
  return api.post('/courses', body).then((r) => r.course);
}

/** @param {string} from @param {string} to @param {'mine' | 'all'} scope */
export function fetchPlanning(from, to, scope) {
  const params = new URLSearchParams({ from, to, scope });
  return api.get(`/courses/planning?${params}`).then((r) => r.events);
}

export function fetchEnrollableCourses() {
  return api.get('/courses/enrollable').then((r) => r.courses);
}

/** @param {string} courseId @param {string} riderId */
export function enrollRider(courseId, riderId) {
  return api.post(`/courses/${courseId}/enrollments`, { riderId }).then((r) => r.enrollment);
}

/** @param {string} courseId */
export function fetchEnrollments(courseId) {
  return api.get(`/courses/${courseId}/enrollments`).then((r) => r.enrollments);
}

/** @param {string} courseId @param {string} enrollmentId @param {string} attendance */
export function updateAttendance(courseId, enrollmentId, attendance) {
  return api
    .patch(`/courses/${courseId}/enrollments/${enrollmentId}/attendance`, { attendance })
    .then((r) => r.enrollment);
}

/** @param {string} courseId */
export function assignHorses(courseId) {
  return api.post(`/courses/${courseId}/assign-horses`, {}).then((r) => r);
}

/** @param {string} courseId @param {string} enrollmentId */
export function fetchHorseOptions(courseId, enrollmentId) {
  return api.get(`/courses/${courseId}/enrollments/${enrollmentId}/horse-options`).then((r) => r.options);
}

/** @param {string} courseId @param {string} enrollmentId @param {string} horseId */
export function overrideHorse(courseId, enrollmentId, horseId) {
  return api
    .patch(`/courses/${courseId}/enrollments/${enrollmentId}/horse`, { horseId })
    .then((r) => r.enrollment);
}

export function runCompatibilityAudit() {
  return api.post('/admin/compatibility-audit', {}).then((r) => r.report);
}
