-- ADR 011 : forfaits par cavalier, droits hebdomadaires, échéanciers et règlements.
-- Ordre : nouvelles structures, reprise des données, puis suppression des anciennes colonnes.

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "EnrollmentEntitlement" AS ENUM ('subscription', 'makeup', 'forced');

-- CreateEnum
CREATE TYPE "PaymentSchedule" AS ENUM ('quarterly', 'ten_installments');

-- CreateEnum
CREATE TYPE "RiderSubscriptionStatus" AS ENUM ('active', 'ended');

-- CreateEnum
CREATE TYPE "SessionCreditSource" AS ENUM ('cancelled_in_time', 'club_cancellation');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('card_online', 'card_onsite', 'cash', 'cheque', 'transfer', 'ancv', 'pass_sport', 'other');

-- AlterEnum
ALTER TYPE "AdminAuditAction" ADD VALUE 'enrollment_forced';

-- AlterTable
ALTER TABLE "course_enrollments" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "entitlement" "EnrollmentEntitlement" NOT NULL DEFAULT 'subscription',
ADD COLUMN     "status" "EnrollmentStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "rider_subscriptions" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "seasonStart" TIMESTAMP(3) NOT NULL,
    "seasonEnd" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "paymentSchedule" "PaymentSchedule" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "status" "RiderSubscriptionStatus" NOT NULL DEFAULT 'active',
    "endedAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_credits" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "source" "SessionCreditSource" NOT NULL,
    "sourceEnrollmentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedByEnrollmentId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_installments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "stripeCheckoutSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "installmentId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "stripePaymentIntentId" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Reprise des données
-- ---------------------------------------------------------------------------

-- Le prix d'une formule devient le prix de la saison (10 mois).
UPDATE "subscription_plans" SET "priceCents" = "priceCents" * 10;

-- Chaque cavalier d'une famille abonnée reçoit un forfait sur la saison en cours,
-- payable en 10 fois, sans refacturation.
DO $$
DECLARE
  start_md TEXT := COALESCE((SELECT "seasonStart" FROM "club_settings" WHERE "id" = 1), '09-01');
  end_md TEXT := COALESCE((SELECT "seasonEnd" FROM "club_settings" WHERE "id" = 1), '06-30');
  start_month INT := split_part(start_md, '-', 1)::INT;
  start_day INT := split_part(start_md, '-', 2)::INT;
  end_month INT := split_part(end_md, '-', 1)::INT;
  end_day INT := split_part(end_md, '-', 2)::INT;
  today DATE := (now() AT TIME ZONE 'Europe/Paris')::DATE;
  start_year INT;
  season_start DATE;
  season_end DATE;
BEGIN
  start_year := EXTRACT(YEAR FROM today)::INT;
  IF today < make_date(start_year, start_month, start_day) THEN
    start_year := start_year - 1;
  END IF;
  season_start := make_date(start_year, start_month, start_day);
  season_end := make_date(
    CASE WHEN end_month < start_month THEN start_year + 1 ELSE start_year END,
    end_month, end_day) + 1;
  -- Entre deux saisons (juillet, août) : la saison qui commence.
  IF today >= season_end THEN
    season_start := make_date(start_year + 1, start_month, start_day);
    season_end := make_date(
      CASE WHEN end_month < start_month THEN start_year + 2 ELSE start_year + 1 END,
      end_month, end_day) + 1;
  END IF;

  INSERT INTO "rider_subscriptions" (
    "id", "riderId", "planId", "seasonStart", "seasonEnd", "startsAt",
    "paymentSchedule", "priceCents", "discountPercent", "status", "updatedAt"
  )
  SELECT
    gen_random_uuid()::TEXT,
    r."id",
    f."subscriptionPlanId",
    (season_start::TIMESTAMP AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC',
    (season_end::TIMESTAMP AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC',
    (season_start::TIMESTAMP AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC',
    'ten_installments',
    p."priceCents",
    0,
    'active',
    CURRENT_TIMESTAMP
  FROM "families" f
  JOIN "riders" r ON r."familyId" = f."id"
  JOIN "subscription_plans" p ON p."id" = f."subscriptionPlanId"
  WHERE f."subscriptionPlanId" IS NOT NULL;
END $$;

-- Une échéance unique par facture existante (historique).
INSERT INTO "invoice_installments" (
  "id", "invoiceId", "sequence", "dueAt", "amountCents", "paidAt",
  "stripeCheckoutSessionId", "updatedAt"
)
SELECT
  gen_random_uuid()::TEXT,
  i."id",
  1,
  COALESCE(i."dueAt", i."issuedAt", i."createdAt"),
  i."totalCents",
  CASE WHEN i."status" = 'paid' THEN COALESCE(i."paidAt", i."updatedAt") END,
  i."stripeCheckoutSessionId",
  CURRENT_TIMESTAMP
FROM "invoices" i;

-- Un règlement pour chaque facture déjà payée.
INSERT INTO "payments" (
  "id", "invoiceId", "installmentId", "method", "amountCents", "paidAt", "stripePaymentIntentId"
)
SELECT
  gen_random_uuid()::TEXT,
  i."id",
  ii."id",
  (CASE WHEN i."stripePaymentIntentId" IS NOT NULL THEN 'card_online' ELSE 'other' END)::"PaymentMethod",
  i."totalCents",
  COALESCE(i."paidAt", i."updatedAt"),
  CASE
    WHEN ROW_NUMBER() OVER (PARTITION BY i."stripePaymentIntentId" ORDER BY i."createdAt") = 1
      THEN i."stripePaymentIntentId"
  END
FROM "invoices" i
JOIN "invoice_installments" ii ON ii."invoiceId" = i."id" AND ii."sequence" = 1
WHERE i."status" = 'paid';

-- Les absences déjà signalées sur des séances à venir deviennent des annulations
-- (place libérée, charge cheval non comptée).
UPDATE "course_enrollments" e
SET "status" = 'cancelled', "cancelledAt" = e."updatedAt"
FROM "courses" c
WHERE c."id" = e."courseId" AND e."attendance" = 'excused' AND c."startAt" > now();

-- ---------------------------------------------------------------------------
-- Suppression des anciennes structures
-- ---------------------------------------------------------------------------

-- DropForeignKey
ALTER TABLE "families" DROP CONSTRAINT "families_subscriptionPlanId_fkey";

-- DropIndex
DROP INDEX "families_subscriptionPlanId_idx";

-- DropIndex
DROP INDEX "invoices_stripeCheckoutSessionId_key";

-- AlterTable
ALTER TABLE "families" DROP COLUMN "sessionQuota",
DROP COLUMN "subscriptionPlanId";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "stripeCheckoutSessionId",
DROP COLUMN "stripePaymentIntentId";

-- CreateIndex
CREATE UNIQUE INDEX "rider_subscriptions_invoiceId_key" ON "rider_subscriptions"("invoiceId");

-- CreateIndex
CREATE INDEX "rider_subscriptions_riderId_status_idx" ON "rider_subscriptions"("riderId", "status");

-- CreateIndex
CREATE INDEX "rider_subscriptions_planId_idx" ON "rider_subscriptions"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "session_credits_sourceEnrollmentId_key" ON "session_credits"("sourceEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "session_credits_usedByEnrollmentId_key" ON "session_credits"("usedByEnrollmentId");

-- CreateIndex
CREATE INDEX "session_credits_riderId_usedAt_expiresAt_idx" ON "session_credits"("riderId", "usedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_installments_stripeCheckoutSessionId_key" ON "invoice_installments"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "invoice_installments_dueAt_paidAt_idx" ON "invoice_installments"("dueAt", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_installments_invoiceId_sequence_key" ON "invoice_installments"("invoiceId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_paidAt_idx" ON "payments"("paidAt");

-- AddForeignKey
ALTER TABLE "rider_subscriptions" ADD CONSTRAINT "rider_subscriptions_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_subscriptions" ADD CONSTRAINT "rider_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_subscriptions" ADD CONSTRAINT "rider_subscriptions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_credits" ADD CONSTRAINT "session_credits_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_credits" ADD CONSTRAINT "session_credits_sourceEnrollmentId_fkey" FOREIGN KEY ("sourceEnrollmentId") REFERENCES "course_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_credits" ADD CONSTRAINT "session_credits_usedByEnrollmentId_fkey" FOREIGN KEY ("usedByEnrollmentId") REFERENCES "course_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_installments" ADD CONSTRAINT "invoice_installments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "invoice_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
