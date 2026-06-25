import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import * as novedadesController from './novedades.controller';

// Nested under /api/casos/:casoId/novedades
export const casoNovedadesRouter = Router({ mergeParams: true });

casoNovedadesRouter.use(authenticateToken);
casoNovedadesRouter.use(requireRole('ADMIN', 'ABOGADO', 'CLIENTE', 'AUXILIAR'));

casoNovedadesRouter.get('/', novedadesController.getNovedadesByCaso);
casoNovedadesRouter.post('/', requireRole('ADMIN', 'ABOGADO'), novedadesController.createNovedad);
casoNovedadesRouter.put('/:id', requireRole('ADMIN', 'ABOGADO'), novedadesController.updateNovedad);
casoNovedadesRouter.delete('/:id', requireRole('ADMIN', 'ABOGADO'), novedadesController.deleteNovedad);

// Global novedad queries under /api/novedades
export const novedadesRouter = Router();

novedadesRouter.use(authenticateToken);
novedadesRouter.get('/agendadas', novedadesController.getNovedadesAgendadas);
novedadesRouter.get('/notificaciones', novedadesController.getNovedadesNotificaciones);
