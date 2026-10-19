-- CreateTable
CREATE TABLE "NovedadVista" (
    "novedadId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "vistaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadVista_pkey" PRIMARY KEY ("novedadId","abogadoId")
);

-- AddForeignKey
ALTER TABLE "NovedadVista" ADD CONSTRAINT "NovedadVista_novedadId_fkey" FOREIGN KEY ("novedadId") REFERENCES "CasoNovedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadVista" ADD CONSTRAINT "NovedadVista_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Las notificaciones que ya existían se dan por vistas, para que al desplegar
-- no aparezcan todos los casos como Pendientes de golpe.
INSERT INTO "NovedadVista" ("novedadId", "abogadoId", "vistaAt")
SELECT n."id", ca."abogadoId", NOW()
FROM "CasoNovedad" n
JOIN "CasoAbogado" ca ON ca."casoId" = n."casoId"
WHERE n."esNotificacion" = true;

-- "Pendiente" deja de ser un estado manual.
UPDATE "Caso" SET "estado" = 'ACTIVO' WHERE "estado" = 'PENDIENTE';