-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO');

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
