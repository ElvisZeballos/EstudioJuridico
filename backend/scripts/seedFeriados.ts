// Script de un solo uso: carga los feriados 2026 (DS 5521 + DS 5510) y la
// configuración por defecto de reglas de traslado.
//
// Correr desde backend/:  npx tsx scripts/seedFeriados.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FERIADOS_2026: { fecha: string; nombre: string; ambito: string; origen: string }[] = [
  { fecha: '2026-01-01', nombre: 'Año Nuevo', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-01-02', nombre: 'Feriado adicional (DS 5510)', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-01-23', nombre: 'Día de la Creación del Estado Plurinacional (trasladado del 22/01)', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-02-16', nombre: 'Lunes de Carnaval', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-02-17', nombre: 'Martes de Carnaval', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-05-01', nombre: 'Día del Trabajo', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-06-04', nombre: 'Corpus Christi', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-06-05', nombre: 'Feriado adicional (DS 5521)', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-06-22', nombre: 'Año Nuevo Andino Amazónico Chaqueño (trasladado del 21/06)', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-08-06', nombre: 'Día de la Independencia', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-08-07', nombre: 'Feriado adicional (DS 5521)', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-09-14', nombre: 'Gesta Libertaria de Cochabamba', ambito: 'departamental', origen: 'decreto' },
  { fecha: '2026-11-02', nombre: 'Todos los Santos', ambito: 'nacional', origen: 'decreto' },
  { fecha: '2026-12-25', nombre: 'Navidad', ambito: 'nacional', origen: 'decreto' },
];

async function main() {
  let creados = 0;
  let salteados = 0;

  for (const f of FERIADOS_2026) {
    const existente = await (prisma as any).feriado.findFirst({ where: { fecha: new Date(f.fecha + 'T04:00:00.000Z') } });
    if (existente) {
      salteados++;
      continue;
    }
    await (prisma as any).feriado.create({
      data: { ...f, fecha: new Date(f.fecha + 'T04:00:00.000Z') },
    });
    creados++;
  }

  const config = await (prisma as any).configuracionFeriados.findFirst();
  if (!config) {
    await (prisma as any).configuracionFeriados.create({ data: {} });
    console.log('Configuración de reglas creada con valores por defecto (ambas reglas activadas).');
  } else {
    console.log('La configuración de reglas ya existía, no se tocó.');
  }

  console.log(`Feriados creados: ${creados} — salteados (ya existían): ${salteados}`);
}

main()
  .catch((e) => { console.error('Error fatal:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });