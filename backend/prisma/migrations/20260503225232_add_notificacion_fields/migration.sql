-- AlterTable
ALTER TABLE "CasoNovedad" ADD COLUMN     "archivos" TEXT,
ADD COLUMN     "esNotificacion" BOOLEAN NOT NULL DEFAULT false;
