-- AlterEnum
BEGIN;
CREATE TYPE "CasoEstado_new" AS ENUM ('ACTIVO', 'PENDIENTE', 'CONCLUIDO', 'ARCHIVADO');
ALTER TABLE "Caso" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Caso" ALTER COLUMN "estado" TYPE "CasoEstado_new" USING (
  CASE "estado"::text
    WHEN 'EN_PROCESO' THEN 'PENDIENTE'
    WHEN 'CERRADO' THEN 'CONCLUIDO'
    WHEN 'SUSPENDIDO' THEN 'ARCHIVADO'
    ELSE "estado"::text
  END
)::"CasoEstado_new";
ALTER TYPE "CasoEstado" RENAME TO "CasoEstado_old";
ALTER TYPE "CasoEstado_new" RENAME TO "CasoEstado";
DROP TYPE "CasoEstado_old";
ALTER TABLE "Caso" ALTER COLUMN "estado" SET DEFAULT 'ACTIVO';
COMMIT;
