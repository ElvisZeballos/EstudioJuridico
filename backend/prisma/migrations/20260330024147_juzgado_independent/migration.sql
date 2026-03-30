/*
  Warnings:

  - You are about to drop the column `abogadoId` on the `Juzgado` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Juzgado" DROP CONSTRAINT "Juzgado_abogadoId_fkey";

-- AlterTable
ALTER TABLE "Juzgado" DROP COLUMN "abogadoId";
