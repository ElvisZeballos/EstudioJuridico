/**
 * Proper seed that uses encryption for sensitive fields.
 * Run with: npx ts-node prisma/seed-proper.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

// Inline encryption to avoid import issues in standalone script
import crypto from 'crypto';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'estudio-juridico-32char-key-2024';
  return Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf8');
}

function encrypt(text: string): string {
  if (!text) return text;
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with encrypted fields...');

  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@estudiojuridico.com' },
    update: {},
    create: {
      email: 'admin@estudiojuridico.com',
      password: adminPassword,
      nombre: 'Carlos',
      apellido: 'Administrador',
      role: 'ADMIN',
      dni: encrypt('20123456'),
      telefono: encrypt('+54 11 4000-0001'),
      active: true,
    },
  });
  console.log('Admin created:', admin.email);

  const abogadoPassword = await bcrypt.hash('Abogado123!', 12);
  const abogado = await prisma.user.upsert({
    where: { email: 'abogado@estudiojuridico.com' },
    update: {},
    create: {
      email: 'abogado@estudiojuridico.com',
      password: abogadoPassword,
      nombre: 'María',
      apellido: 'González',
      role: 'ABOGADO',
      dni: encrypt('25987654'),
      telefono: encrypt('+54 11 4000-0002'),
      active: true,
    },
  });
  console.log('Abogado created:', abogado.email);

  const auxiliarPassword = await bcrypt.hash('Auxiliar123!', 12);
  const auxiliar = await prisma.user.upsert({
    where: { email: 'juanito@ejemplo.com' },
    update: {},
    create: {
      email: 'juanito@ejemplo.com',
      password: auxiliarPassword,
      nombre: 'Juanito',
      apellido: 'Pérez',
      role: 'AUXILIAR',
      dni: encrypt('8945123 LP'),
      telefono: encrypt('+591 70123456'),
      active: true,
    },
  });
  console.log('Auxiliar created:', auxiliar.email);

  await prisma.abogadoAuxiliar.upsert({
    where: {
      abogadoId_auxiliarId: {
        abogadoId: abogado.id,
        auxiliarId: auxiliar.id,
      },
    },
    update: {},
    create: {
      abogadoId: abogado.id,
      auxiliarId: auxiliar.id,
    },
  });
  console.log('Auxiliar asignado al abogado:', abogado.email);

  const clientePassword = await bcrypt.hash('Cliente123!', 12);
  const clienteUser = await prisma.user.upsert({
    where: { email: 'cliente@ejemplo.com' },
    update: {},
    create: {
      email: 'cliente@ejemplo.com',
      password: clientePassword,
      nombre: 'Roberto',
      apellido: 'Martínez',
      role: 'CLIENTE',
      dni: encrypt('30456789'),
      telefono: encrypt('+54 11 4000-0003'),
      active: true,
    },
  });
  console.log('Cliente created:', clienteUser.email);

  // Sample clients
  await prisma.client.upsert({
    where: { userId: clienteUser.id },
    update: {},
    create: {
      userId: clienteUser.id,
      notas: 'Cliente desde 2024. Caso de sucesión familiar.',
      abogadoId: abogado.id,
    },
  });

  const anaUser = await prisma.user.upsert({
    where: { email: 'ana.lopez@ejemplo.com' },
    update: {},
    create: {
      email: 'ana.lopez@ejemplo.com',
      password: await bcrypt.hash('Cliente123!', 12),
      nombre: 'Ana',
      apellido: 'López',
      role: 'CLIENTE',
      dni: encrypt('27654321'),
      telefono: encrypt('+54 11 4000-0004'),
      active: true,
    },
  });

  await prisma.client.upsert({
    where: { userId: anaUser.id },
    update: {},
    create: {
      userId: anaUser.id,
      notas: 'Consulta laboral. En proceso.',
      abogadoId: abogado.id,
    },
  });

  const diegoUser = await prisma.user.upsert({
    where: { email: 'diego.fernandez@ejemplo.com' },
    update: {},
    create: {
      email: 'diego.fernandez@ejemplo.com',
      password: await bcrypt.hash('Cliente123!', 12),
      nombre: 'Diego',
      apellido: 'Fernández',
      role: 'CLIENTE',
      dni: encrypt('33112233'),
      telefono: encrypt('+54 11 4000-0005'),
      active: true,
    },
  });

  await prisma.client.upsert({
    where: { userId: diegoUser.id },
    update: {},
    create: {
      userId: diegoUser.id,
      abogadoId: abogado.id,
    },
  });

  console.log('\nSeed completed successfully!');
  console.log('\nLogin credentials:');
  console.log('  Admin:   admin@estudiojuridico.com / Admin123!');
  console.log('  Abogado: abogado@estudiojuridico.com / Abogado123!');
  console.log('  Cliente: cliente@ejemplo.com / Cliente123!');
  console.log('  Auxiliar: juanito@ejemplo.com / Auxiliar123!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
