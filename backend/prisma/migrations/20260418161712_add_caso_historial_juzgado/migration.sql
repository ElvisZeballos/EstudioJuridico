-- AlterTable
ALTER TABLE "Caso" ADD COLUMN     "juzgadoId" TEXT;

-- CreateTable
CREATE TABLE "CasoHistorial" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAntes" TEXT,
    "valorDespues" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasoHistorial_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_juzgadoId_fkey" FOREIGN KEY ("juzgadoId") REFERENCES "Juzgado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoHistorial" ADD CONSTRAINT "CasoHistorial_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoHistorial" ADD CONSTRAINT "CasoHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
