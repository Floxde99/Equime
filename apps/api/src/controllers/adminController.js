// @ts-check
import * as adminService from '../services/adminService.js';
import * as authService from '../services/authService.js';
import * as riderService from '../services/riderService.js';

/** GET /api/v1/admin/dashboard-kpis */
export async function dashboardKpis(_req, res) {
  const kpis = await adminService.getDashboardKpis();
  res.json({ kpis });
}

/** GET /api/v1/admin/members */
export async function listMembers(_req, res) {
  const members = await adminService.listMembers();
  res.json({ members });
}

/** POST /api/v1/admin/members */
export async function createMember(req, res) {
  const member = await authService.createMember(req.body);
  res.status(201).json({ member });
}

/** PATCH /api/v1/admin/members/:id */
export async function updateMember(req, res) {
  const member = await authService.updateMemberProfile(req.params.id, req.body);
  res.json({ member });
}

/** POST /api/v1/admin/members/:id/ban */
export async function banMember(req, res) {
  await authService.banUser(req.params.id, req.user.id);
  res.status(204).end();
}

/** POST /api/v1/admin/members/:id/unban */
export async function unbanMember(req, res) {
  await authService.unbanUser(req.params.id);
  res.status(204).end();
}

/** GET /api/v1/admin/pending-documents */
export async function listPendingDocuments(_req, res) {
  const riders = await riderService.listPendingDocuments();
  res.json({ riders });
}

/** POST /api/v1/admin/riders/:riderId/review-document */
export async function reviewDocument(req, res) {
  const rider = await riderService.reviewRiderDocument(
    req.params.riderId,
    req.body.docType,
    req.body.decision,
    req.body.rejectionReason,
    req.user.id,
    req.body.expiresAt
  );
  res.json({ rider });
}

/** GET /api/v1/admin/riders/missing-license */
export async function listRidersMissingLicense(_req, res) {
  const riders = await riderService.listRidersMissingLicense();
  res.json({ riders });
}

/** POST /api/v1/admin/riders/:riderId/license */
export async function uploadLicense(req, res) {
  const rider = await riderService.adminUploadLicense(
    req.user.id,
    req.params.riderId,
    req.file,
    req.body
  );
  res.json({ rider });
}

/** GET /api/v1/admin/riders/:riderId/documents/:docType */
export async function downloadRiderDocument(req, res, next) {
  const path = await riderService.getAdminRiderDocumentPath(
    req.user.id,
    req.params.riderId,
    req.params.docType
  );
  const { streamStoredFile } = await import('../lib/uploads.js');
  streamStoredFile(path, res, next);
}

/** GET /api/v1/admin/instructors */
export async function listInstructors(_req, res) {
  const instructors = await adminService.listInstructors();
  res.json({ instructors });
}

/** GET /api/v1/admin/audit-logs */
export async function listAuditLogs(_req, res) {
  const logs = await adminService.listAuditLogs();
  res.json({ logs });
}
