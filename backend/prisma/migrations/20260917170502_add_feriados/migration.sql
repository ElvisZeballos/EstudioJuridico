-- CreateTable
CREATE TABLE "Feriado" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "ambito" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionFeriados" (
    "id" TEXT NOT NULL,
    "trasladoJuevesAViernes" BOOLEAN NOT NULL DEFAULT true,
    "trasladoDomingoALunes" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionFeriados_pkey" PRIMARY KEY ("id")
);
