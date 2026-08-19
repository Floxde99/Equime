import { api } from '@/lib/apiClient.js';

export function fetchHorses() {
  return api.get('/horses').then((r) => r.horses);
}

/** @param {string} id */
export function fetchHorse(id) {
  return api.get(`/horses/${id}`).then((r) => r.horse);
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

/** @param {string} id @param {File} file */
export function uploadHorsePhoto(id, file) {
  const form = new FormData();
  form.append('file', file);
  return api.upload(`/horses/${id}/photo`, form).then((r) => r.horse);
}

/** @param {string} id */
export function deleteHorsePhoto(id) {
  return api.delete(`/horses/${id}/photo`).then((r) => r.horse);
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

/** @param {string} courseId @param {string} riderId @param {{ force?: boolean }} [options] */
export function enrollRider(courseId, riderId, options = {}) {
  return api
    .post(`/courses/${courseId}/enrollments`, { riderId, ...(options.force ? { force: true } : {}) })
    .then((r) => r.enrollment);
}

export function fetchMyEnrollments() {
  return api.get('/courses/my-enrollments').then((r) => r.enrollments);
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

/** @param {string} courseId @param {string} enrollmentId */
export function excuseEnrollment(courseId, enrollmentId) {
  return updateAttendance(courseId, enrollmentId, 'excused');
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

export function fetchDashboardKpis() {
  return api.get('/admin/dashboard-kpis').then((r) => r.kpis);
}

export function fetchMembers() {
  return api.get('/admin/members').then((r) => r.members);
}

/**
 * @param {{ email: string, password: string, firstName: string, lastName: string, phone?: string, role?: string }} body
 */
export function createMember(body) {
  return api.post('/admin/members', body).then((r) => r.member);
}

/** @param {{ email: string, password: string, firstName: string, lastName: string, phone?: string }} body */
export function createInstructor(body) {
  return createMember({ ...body, role: 'instructor' });
}

/**
 * @param {string} id
 * @param {{ firstName: string, lastName: string, phone?: string | null }} body
 */
export function updateMember(id, body) {
  return api.patch(`/admin/members/${id}`, body).then((r) => r.member);
}

/** @param {string} id */
export function banMember(id) {
  return api.post(`/admin/members/${id}/ban`);
}

/** @param {string} id */
export function unbanMember(id) {
  return api.post(`/admin/members/${id}/unban`);
}

export function fetchPendingDocuments() {
  return api.get('/admin/pending-documents').then((r) => r.riders);
}

/**
 * @param {string} riderId
 * @param {{ docType: string, decision: string, rejectionReason?: string, expiresAt?: string }} body
 */
export function reviewDocument(riderId, body) {
  return api.post(`/admin/riders/${riderId}/review-document`, body).then((r) => r.rider);
}

/** @param {string} riderId @param {'medical_certificate' | 'license'} docType */
export function getAdminRiderDocumentUrl(riderId, docType) {
  return `/api/v1/admin/riders/${riderId}/documents/${docType}`;
}

export function fetchInstructors() {
  return api.get('/admin/instructors').then((r) => r.instructors);
}

export function fetchAuditLogs() {
  return api.get('/admin/audit-logs').then((r) => r.logs);
}

/** @param {string} courseId @param {boolean} [cancelSeries] */
export function cancelCourse(courseId, cancelSeries = false) {
  return api.post(`/courses/${courseId}/cancel`, { cancelSeries });
}
