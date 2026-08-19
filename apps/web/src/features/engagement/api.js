import { api, apiFetch } from '@/lib/apiClient.js';

export function fetchPublicEvents() {
  return apiFetch('/events').then((r) => r.events);
}

export function fetchAdminEvents() {
  return api.get('/events/admin').then((r) => r.events);
}

/** @param {object} body */
export function createEvent(body) {
  return api.post('/events', body).then((r) => r.event);
}

/** @param {string} id @param {object} body */
export function updateEvent(id, body) {
  return api.patch(`/events/${id}`, body).then((r) => r.event);
}

/** @param {string} id */
export function deleteEvent(id) {
  return api.delete(`/events/${id}`);
}

/** @param {string} eventId */
export function assignEventHorses(eventId) {
  return api.post(`/events/${eventId}/assign-horses`, {});
}

/** @param {string} eventId @param {string} registrationId */
export function cancelEventRegistration(eventId, registrationId) {
  return api
    .post(`/events/${eventId}/registrations/${registrationId}/cancel`, {})
    .then((r) => r.registration);
}

/** @param {string} eventId @param {string} registrationId @param {string} horseId */
export function overrideEventHorse(eventId, registrationId, horseId) {
  return api
    .patch(`/events/${eventId}/registrations/${registrationId}/horse`, { horseId })
    .then((r) => r.registration);
}

/** @param {string} eventId @param {string} riderId @param {{ force?: boolean }} [options] */
export function registerForEvent(eventId, riderId, options = {}) {
  return api
    .post(`/events/${eventId}/registrations`, {
      riderId,
      ...(options.force ? { force: true } : {}),
    })
    .then((r) => r.registration);
}

export function fetchNotificationPreferences() {
  return api.get('/notifications/preferences').then((r) => r.preferences);
}

/** @param {string} type @param {object} body */
export function updateNotificationPreference(type, body) {
  return api.put(`/notifications/preferences/${type}`, body).then((r) => r.preference);
}

export function fetchNotifications() {
  return api.get('/notifications').then((r) => r.notifications);
}

/** @param {string} id */
export function markNotificationRead(id) {
  return api.post(`/notifications/${id}/read`, {}).then((r) => r.notification);
}

export function fetchIncidents(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.severity) params.set('severity', filters.severity);
  const query = params.toString();
  return api.get(`/incidents${query ? `?${query}` : ''}`).then((r) => r.incidents);
}

export function fetchCriticalIncidentCount() {
  return api.get('/incidents/critical-count').then((r) => r.count);
}

/** @param {object} body */
export function createIncident(body) {
  return api.post('/incidents', body).then((r) => r.incident);
}

/** @param {string} id */
export function resolveIncident(id) {
  return api.post(`/incidents/${id}/resolve`, {}).then((r) => r.incident);
}

export function fetchVolunteerMissions() {
  return api.get('/volunteer-missions').then((r) => r.missions);
}

/** @param {object} body */
export function createVolunteerMission(body) {
  return api.post('/volunteer-missions', body).then((r) => r.mission);
}

/** @param {string} id @param {object} body */
export function updateVolunteerMission(id, body) {
  return api.patch(`/volunteer-missions/${id}`, body).then((r) => r.mission);
}

/** @param {string} id */
export function deleteVolunteerMission(id) {
  return api.delete(`/volunteer-missions/${id}`);
}

/** @param {string} id */
export function signupVolunteerMission(id) {
  return api.post(`/volunteer-missions/${id}/signups`, {}).then((r) => r.signup);
}

export function fetchMessageContacts() {
  return api.get('/messages/contacts').then((r) => r.contacts);
}

export function fetchConversations() {
  return api.get('/messages/conversations').then((r) => r.conversations);
}

/** @param {object} body */
export function createConversation(body) {
  return api.post('/messages/conversations', body).then((r) => r.conversation);
}

/** @param {string} conversationId */
export function fetchConversationMessages(conversationId) {
  return api.get(`/messages/conversations/${conversationId}/messages`).then((r) => r.messages);
}

/** @param {string} conversationId @param {string} body */
export function sendMessage(conversationId, body) {
  return api
    .post(`/messages/conversations/${conversationId}/messages`, { body })
    .then((r) => r.message);
}

/** @param {string} conversationId */
export function markConversationRead(conversationId) {
  return api.post(`/messages/conversations/${conversationId}/read`, {}).then((r) => r.participant);
}
