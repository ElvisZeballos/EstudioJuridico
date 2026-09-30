import { PrismaClient } from '@prisma/client';
import { esFeriado } from '../src/shared/feriados';

const prisma = new PrismaClient();

async function main() {
  console.log('24 sept (jueves, el que cargaste):', await esFeriado(new Date('2026-09-24T12:00:00Z')));
  console.log('25 sept (viernes, debería ser true por la regla):', await esFeriado(new Date('2026-09-25T12:00:00Z')));
}

main().finally(() => prisma.$disconnect());