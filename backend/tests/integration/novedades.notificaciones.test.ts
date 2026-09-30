import request from 'supertest';
import { loadApp, bearer, tokenFor } from '../helpers/app';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';

jest.mock('../../src/shared/prisma', () => ({
  __esModule: true,
  default: require('../helpers/prismaMock').prismaMock,
}));

const app = loadApp();

const NOTIFICACION = {
  id: 'n-1', titulo: 'Notificación - Juzgado Civil N°1 (auto)', contenido: 'Resumen', esNotificacion: true,
  fecha: new Date('2026-10-05T12:00:00Z'), caso: { id: 'c-1', titulo: 'Juicio de Prueba' },
};

beforeEach(() => {
  resetPrismaMock();
  prismaMock.casoNovedad.findMany.mockResolvedValue([NOTIFICACION]);
});

const whereEnviado = () => prismaMock.casoNovedad.findMany.mock.calls[0][0];

describe('GET /api/novedades/notificaciones — autenticación', () => {
  test('sin token → 401 y no consulta la base de datos', async () => {
    const res = await request(app).get('/api/novedades/notificaciones');
    expect(res.status).toBe(401);
    expect(prismaMock.casoNovedad.findMany).not.toHaveBeenCalled();
  });

  test('token con firma inválida → 403', async () => {
    const res = await request(app).get('/api/novedades/notificaciones').set('Authorization', 'Bearer aaa.bbb.ccc');
    expect(res.status).toBe(403);
    expect(prismaMock.casoNovedad.findMany).not.toHaveBeenCalled();
  });

  test('token expirado → 403', async () => {
    const expirado = tokenFor('ABOGADO', 'ab-1', -60);
    const res = await request(app).get('/api/novedades/notificaciones').set('Authorization', `Bearer ${expirado}`);
    expect(res.status).toBe(403);
  });

  test('header sin el prefijo Bearer → 403 (el token queda vacío o mal formado)', async () => {
    const res = await request(app).get('/api/novedades/notificaciones').set('Authorization', tokenFor('ABOGADO'));
    expect([401, 403]).toContain(res.status);
    expect(prismaMock.casoNovedad.findMany).not.toHaveBeenCalled();
  });

  test('GET /api/novedades/agendadas también exige token', async () => {
    expect((await request(app).get('/api/novedades/agendadas')).status).toBe(401);
  });
});

describe('GET /api/novedades/notificaciones — alcance por rol', () => {
  test('ABOGADO recibe solo notificaciones de SUS casos (máx. 20, más recientes primero)', async () => {
    const res = await request(app).get('/api/novedades/notificaciones').set('Authorization', bearer('ABOGADO', 'ab-1'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 'n-1', esNotificacion: true });
    expect(whereEnviado()).toMatchObject({
      where: { active: true, esNotificacion: true, caso: { active: true, abogados: { some: { abogadoId: 'ab-1' } } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  });

  test('ADMIN ve las notificaciones de todos los casos (sin filtro por abogado)', async () => {
    await request(app).get('/api/novedades/notificaciones').set('Authorization', bearer('ADMIN', 'adm-1'));
    expect(whereEnviado().where).toEqual({ active: true, esNotificacion: true, caso: { active: true } });
  });

  test('CLIENTE recibe solo notificaciones de los casos donde él figura', async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: 'cl-1' });
    const res = await request(app).get('/api/novedades/notificaciones').set('Authorization', bearer('CLIENTE', 'user-cli'));

    expect(res.status).toBe(200);
    expect(prismaMock.client.findFirst).toHaveBeenCalledWith({ where: { userId: 'user-cli' } });
    expect(whereEnviado().where.caso).toEqual({ active: true, clientes: { some: { clienteId: 'cl-1' } } });
  });

  test('CLIENTE sin perfil de cliente → lista vacía y no consulta novedades', async () => {
    prismaMock.client.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/novedades/notificaciones').set('Authorization', bearer('CLIENTE', 'user-x'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(prismaMock.casoNovedad.findMany).not.toHaveBeenCalled();
  });

  test('error de base de datos → 500 genérico', async () => {
    prismaMock.casoNovedad.findMany.mockRejectedValue(new Error('timeout'));
    const res = await request(app).get('/api/novedades/notificaciones').set('Authorization', bearer('ABOGADO'));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  test('HALLAZGO: AUXILIAR debería ver las notificaciones de los casos de sus abogados (como ocurre en /api/casos), pero recibe siempre lista vacía', async () => {
    // casos.service.getAll resuelve al AUXILIAR con getAbogadosByAuxiliar(); novedades.service.buildCasoFilter
    // no contempla el rol AUXILIAR y lo trata como CLIENTE (busca un perfil de cliente que no tiene).
    // El dashboard del frontend sí le muestra a AUXILIAR los paneles de Notificaciones y Agenda.
    prismaMock.abogadoAuxiliar.findMany.mockResolvedValue([{ abogadoId: 'ab-1' }]);

    const res = await request(app).get('/api/novedades/notificaciones').set('Authorization', bearer('AUXILIAR', 'aux-1'));

    expect(res.status).toBe(200);
    expect(prismaMock.casoNovedad.findMany).toHaveBeenCalled();
    expect(res.body).toHaveLength(1);
  });
});
