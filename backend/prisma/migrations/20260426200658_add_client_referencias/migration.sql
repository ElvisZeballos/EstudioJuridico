-- CreateTable
CREATE TABLE "ClientReferencia" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "relacion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientReferencia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClientReferencia" ADD CONSTRAINT "ClientReferencia_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
