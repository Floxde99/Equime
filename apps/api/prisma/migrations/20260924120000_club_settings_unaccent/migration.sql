-- Recherche de familles insensible aux accents (« helene » trouve « Hélène »)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateTable
CREATE TABLE "club_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cancellationDeadlineHours" INTEGER NOT NULL DEFAULT 24,
    "makeupValidityDays" INTEGER NOT NULL DEFAULT 60,
    "seasonStart" TEXT NOT NULL DEFAULT '09-01',
    "seasonEnd" TEXT NOT NULL DEFAULT '06-30',
    "installmentDay" INTEGER NOT NULL DEFAULT 5,
    "quarterDueDates" TEXT[] DEFAULT ARRAY['09-05', '01-05', '04-05']::TEXT[],
    "proRataOnLateJoin" BOOLEAN NOT NULL DEFAULT true,
    "minorHealthQuestionnaire" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_settings_pkey" PRIMARY KEY ("id")
);
