-- DropForeignKey
ALTER TABLE "Movimiento" DROP CONSTRAINT "Movimiento_casoId_fkey";

-- AlterTable
ALTER TABLE "Movimiento" ALTER COLUMN "casoId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
