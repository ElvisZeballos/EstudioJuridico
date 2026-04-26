-- CreateTable
CREATE TABLE "CasoAbogadoContraparte" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasoAbogadoContraparte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasoDemandado" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "domicilio" TEXT,
    "carnet" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasoDemandado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CasoAbogadoContraparte" ADD CONSTRAINT "CasoAbogadoContraparte_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoDemandado" ADD CONSTRAINT "CasoDemandado_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
