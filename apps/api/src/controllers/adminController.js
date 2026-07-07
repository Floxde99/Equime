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

/** POST /api/v1/admin/members/:id/ban */
export async function banMember(req, res) {
  await authService.banUser(req.params.id);
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
    req.body.rejectionReason
  );
  res.json({ rider });
}
