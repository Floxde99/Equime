-- AlterEnum
ALTER TYPE "AdminAuditAction" ADD VALUE 'license_uploaded_by_admin';

-- AlterTable
ALTER TABLE "riders" ADD COLUMN     "licenseNumber" TEXT;
