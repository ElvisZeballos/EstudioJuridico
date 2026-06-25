CREATE TABLE "AbogadoAuxiliar" (
    "abogadoId" TEXT NOT NULL,
    "auxiliarId" TEXT NOT NULL,
    CONSTRAINT "AbogadoAuxiliar_pkey" PRIMARY KEY ("abogadoId","auxiliarId")
);

ALTER TABLE "AbogadoAuxiliar" ADD CONSTRAINT "AbogadoAuxiliar_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AbogadoAuxiliar" ADD CONSTRAINT "AbogadoAuxiliar_auxiliarId_fkey" FOREIGN KEY ("auxiliarId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
