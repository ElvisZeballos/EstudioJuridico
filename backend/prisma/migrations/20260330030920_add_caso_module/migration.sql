-- CreateEnum
CREATE TYPE "CasoEstado" AS ENUM ('ACTIVO', 'EN_PROCESO', 'CERRADO', 'SUSPENDIDO');

-- CreateTable
CREATE TABLE "Caso" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "CasoEstado" NOT NULL DEFAULT 'ACTIVO',
    "numero" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "notas" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasoAbogado" (
    "casoId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,

    CONSTRAINT "CasoAbogado_pkey" PRIMARY KEY ("casoId","abogadoId")
);

-- CreateTable
CREATE TABLE "CasoCliente" (
    "casoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,

    CONSTRAINT "CasoCliente_pkey" PRIMARY KEY ("casoId","clienteId")
);

-- AddForeignKey
ALTER TABLE "CasoAbogado" ADD CONSTRAINT "CasoAbogado_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoAbogado" ADD CONSTRAINT "CasoAbogado_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoCliente" ADD CONSTRAINT "CasoCliente_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoCliente" ADD CONSTRAINT "CasoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
