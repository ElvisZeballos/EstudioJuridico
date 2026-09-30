import { PrismaClient } from '@prisma/client';

// LOCAL_URL sale de tu .env normal (la de localhost, ya activa)
const LOCAL_URL = process.env.DATABASE_URL;
// PROD_URL se pasa al momento de correr el comando (ver abajo), no toques el .env
const PROD_URL = process.env.PROD_DATABASE_URL;

if (!PROD_URL) {
  console.error('Falta PROD_DATABASE_URL. Corré el script así:\n  PROD_DATABASE_URL="postgresql://...(la de yamanote)..." npx tsx prisma/migrar-datos.ts');
  process.exit(1);
}

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });
const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });

async function main() {
  const juzgados = await local.juzgado.findMany();
  console.log(`Encontrados ${juzgados.length} juzgados en local.`);
  for (const j of juzgados) {
    await prod.juzgado.upsert({ where: { id: j.id }, update: {}, create: j });
  }
  console.log('Juzgados copiados a producción.');

  const feriados = await local.feriado.findMany();
  console.log(`Encontrados ${feriados.length} feriados en local.`);
  for (const f of feriados) {
    await prod.feriado.upsert({ where: { id: f.id }, update: {}, create: f });
  }
  console.log('Feriados copiados a producción.');

  const configs = await local.configuracionFeriados.findMany();
  for (const c of configs) {
    await prod.configuracionFeriados.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  console.log(`ConfiguracionFeriados copiada (${configs.length} registro/s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await local.$disconnect();
    await prod.$disconnect();
  });