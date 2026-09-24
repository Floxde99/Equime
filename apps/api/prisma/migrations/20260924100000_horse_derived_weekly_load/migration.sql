-- ADR 010 : la charge hebdomadaire des chevaux est dérivée des affectations
-- (cours et stages de la semaine ISO), plus stockée. L'ancien compteur n'était
-- jamais remis à zéro et dérivait à chaque annulation.
ALTER TABLE "horses" DROP COLUMN "weeklyLoadHours";
