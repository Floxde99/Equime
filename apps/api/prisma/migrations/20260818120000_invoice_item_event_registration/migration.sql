-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN "eventRegistrationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_eventRegistrationId_key" ON "invoice_items"("eventRegistrationId");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_eventRegistrationId_fkey" FOREIGN KEY ("eventRegistrationId") REFERENCES "event_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
