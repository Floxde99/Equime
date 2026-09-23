-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "stripeCheckoutSessionId" TEXT,
ADD COLUMN "stripePaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeCheckoutSessionId_key" ON "invoices"("stripeCheckoutSessionId");
