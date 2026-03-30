-- CreateTable
CREATE TABLE "Juzgado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "telefono" TEXT,
    "notas" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "abogadoId" TEXT NOT NULL,

    CONSTRAINT "Juzgado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Juzgado" ADD CONSTRAINT "Juzgado_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
