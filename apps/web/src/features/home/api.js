import { api } from '@/lib/apiClient.js';

/** @param {string} email */
export function subscribeNewsletter(email) {
  return api.post('/public/newsletter', { email });
}

export function fetchPublicCourses() {
  return api.get('/public/courses').then((r) => r.courses);
}
