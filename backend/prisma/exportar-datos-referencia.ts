import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient(); // usa tu DATABASE_URL local normal del .env

async function main() {
  const juzgados = await prisma.juzgado.findMany();
  const feriados = await prisma.feriado.findMany();
  const configuracionFeriados = await prisma.configuracionFeriados.findMany();

  const dir = path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'juzgados.json'), JSON.stringify(juzgados, null, 2));
  fs.writeFileSync(path.join(dir, 'feriados.json'), JSON.stringify(feriados, null, 2));
  fs.writeFileSync(path.join(dir, 'configuracion-feriados.json'), JSON.stringify(configuracionFeriados, null, 2));

  console.log(`Exportados: ${juzgados.length} juzgados, ${feriados.length} feriados, ${configuracionFeriados.length} configuracion(es).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());