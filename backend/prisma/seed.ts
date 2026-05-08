import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPassword   = await bcrypt.hash('Admin123!', 12);
  const abogadoPassword = await bcrypt.hash('Abogado123!', 12);
  const clientePassword = await bcrypt.hash('Cliente123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@estudiojuridico.com' },
    update: {},
    create: {
      email: 'admin@estudiojuridico.com',
      password: adminPassword,
      nombre: 'Carlos',
      apellido: 'Administrador',
      role: 'ADMIN',
      active: true,
    },
  });

  const abogado = await prisma.user.upsert({
    where: { email: 'abogado@estudiojuridico.com' },
    update: {},
    create: {
      email: 'abogado@estudiojuridico.com',
      password: abogadoPassword,
      nombre: 'María',
      apellido: 'González',
      role: 'ABOGADO',
      active: true,
    },
  });

  // All personal data lives in User — Client only stores relation data
  const clienteUser1 = await prisma.user.upsert({
    where: { email: 'roberto@ejemplo.com' },
    update: {},
    create: {
      email: 'roberto@ejemplo.com',
      password: clientePassword,
      nombre: 'Roberto',
      apellido: 'Martínez',
      role: 'CLIENTE',
      active: true,
    },
  });

  await prisma.client.upsert({
    where: { userId: clienteUser1.id },
    update: {},
    create: {
      userId: clienteUser1.id,
      abogadoId: abogado.id,
    },
  });

  const clienteUser2 = await prisma.user.upsert({
    where: { email: 'ana@ejemplo.com' },
    update: {},
    create: {
      email: 'ana@ejemplo.com',
      password: clientePassword,
      nombre: 'Ana',
      apellido: 'López',
      role: 'CLIENTE',
      active: true,
    },
  });

  await prisma.client.upsert({
    where: { userId: clienteUser2.id },
    update: {},
    create: {
      userId: clienteUser2.id,
      abogadoId: abogado.id,
    },
  });

  console.log('\nSeed completed!');
  console.log('Admin:   admin@estudiojuridico.com / Admin123!');
  console.log('Abogado: abogado@estudiojuridico.com / Abogado123!');
  console.log('Cliente: roberto@ejemplo.com / Cliente123!');
  console.log('         ana@ejemplo.com / Cliente123!');

  void admin;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
