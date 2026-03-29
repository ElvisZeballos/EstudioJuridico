import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
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
      active: true,
    },
  });
  console.log('Created admin:', admin.email);

  // Create abogado
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
      active: true,
    },
  });
  console.log('Created abogado:', abogado.email);

  // Create cliente user
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
      active: true,
    },
  });
  console.log('Created client user:', clienteUser.email);

  // Create sample clients
  const client1 = await prisma.client.upsert({
    where: { id: 'sample-client-001' },
    update: {},
    create: {
      id: 'sample-client-001',
      nombre: 'Roberto',
      apellido: 'Martínez',
      dni: 'ENCRYPTED_DNI_1', // In real use, this would be encrypted
      email: 'roberto@ejemplo.com',
      telefono: 'ENCRYPTED_TEL_1',
      abogadoId: abogado.id,
      userId: clienteUser.id,
    },
  });
  console.log('Created client:', client1.nombre);

  const client2 = await prisma.client.upsert({
    where: { id: 'sample-client-002' },
    update: {},
    create: {
      id: 'sample-client-002',
      nombre: 'Ana',
      apellido: 'López',
      dni: 'ENCRYPTED_DNI_2',
      email: 'ana@ejemplo.com',
      abogadoId: abogado.id,
    },
  });
  console.log('Created client:', client2.nombre);

  console.log('\nSeed completed!');
  console.log('\nLogin credentials:');
  console.log('Admin:   admin@estudiojuridico.com / Admin123!');
  console.log('Abogado: abogado@estudiojuridico.com / Abogado123!');
  console.log('Cliente: cliente@ejemplo.com / Cliente123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
