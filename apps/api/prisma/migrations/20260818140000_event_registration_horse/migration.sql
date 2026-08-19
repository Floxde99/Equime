-- AlterTable
ALTER TABLE "event_registrations" ADD COLUMN "horseId" TEXT;

-- CreateIndex
CREATE INDEX "event_registrations_horseId_idx" ON "event_registrations"("horseId");

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
