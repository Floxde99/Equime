-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('medical_document_viewed', 'medical_document_reviewed');

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "riderId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_riderId_idx" ON "admin_audit_logs"("riderId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
