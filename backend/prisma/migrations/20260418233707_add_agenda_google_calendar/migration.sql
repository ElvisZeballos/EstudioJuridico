-- AlterTable
ALTER TABLE "CasoNovedad" ADD COLUMN     "fechaAgendada" TIMESTAMP(3),
ADD COLUMN     "googleCalendarEventId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleRefreshToken" TEXT;
