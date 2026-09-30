import { PrismaClient } from '@prisma/client';
import juzgados from './data/juzgados.json';

const prisma = new PrismaClient();

async function main() {
  for (const j of juzgados as any[]) {
    await prisma.juzgado.upsert({ where: { id: j.id }, update: {}, create: j });
  }
  console.log(`Juzgados: ${juzgados.length} cargados.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());