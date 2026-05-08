/*
  Warnings:

  - You are about to drop the column `apellido` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `direccion` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `dni` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `fechaNacimiento` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `nombre` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `telefono` on the `Client` table. All the data in the column will be lost.
  - Made the column `userId` on table `Client` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_userId_fkey";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "apellido",
DROP COLUMN "direccion",
DROP COLUMN "dni",
DROP COLUMN "email",
DROP COLUMN "fechaNacimiento",
DROP COLUMN "nombre",
DROP COLUMN "telefono",
ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
