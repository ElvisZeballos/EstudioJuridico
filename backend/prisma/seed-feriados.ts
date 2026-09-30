import { PrismaClient } from '@prisma/client';
import feriados from './data/feriados.json';
import configuracionFeriados from './data/configuracion-feriados.json';

const prisma = new PrismaClient();

async function main() {
  for (const f of feriados as any[]) {
    await prisma.feriado.upsert({ where: { id: f.id }, update: {}, create: f });
  }
  console.log(`Feriados: ${feriados.length} cargados.`);

  for (const c of configuracionFeriados as any[]) {
    await prisma.configuracionFeriados.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  console.log(`ConfiguracionFeriados: ${configuracionFeriados.length} cargada(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());