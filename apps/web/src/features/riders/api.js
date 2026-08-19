import { api } from '@/lib/apiClient.js';

export function fetchRiders() {
  return api.get('/riders').then((r) => r.riders);
}

/** @param {object} body */
export function createRider(body) {
  return api.post('/riders', body).then((r) => r.rider);
}

/** @param {string} id @param {object} body */
export function updateRider(id, body) {
  return api.patch(`/riders/${id}`, body).then((r) => r.rider);
}

/** @param {string} id */
export function deleteRider(id) {
  return api.delete(`/riders/${id}`);
}

/** @param {string} riderId @param {'medical_certificate' | 'license'} docType @param {File} file @param {boolean} [medicalConsent] @param {string} [expiresAt] */
export function uploadRiderDocument(riderId, docType, file, medicalConsent, expiresAt) {
  const form = new FormData();
  form.append('file', file);
  if (medicalConsent) form.append('medicalConsent', 'true');
  if (expiresAt) form.append('expiresAt', expiresAt);
  return api.upload(`/riders/${riderId}/documents/${docType}`, form).then((r) => r.rider);
}

/** @param {string} riderId */
export function fetchRiderAffinities(riderId) {
  return api.get(`/riders/${riderId}/affinities`).then((r) => r.affinities);
}

/** @param {string} riderId @param {string} horseId @param {string} affinity */
export function upsertRiderAffinity(riderId, horseId, affinity) {
  return api.put(`/riders/${riderId}/affinities/${horseId}`, { affinity }).then((r) => r.affinity);
}

export function fetchHorses() {
  return api.get('/horses').then((r) => r.horses);
}
