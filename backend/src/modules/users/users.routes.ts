import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { uploadPhoto, processPhoto } from '../../middleware/upload';
import * as usersController from './users.controller';

const router = Router();

router.use(authenticateToken);

router.get('/abogados', requireRole('ADMIN', 'ABOGADO', 'AUXILIAR'), usersController.getAbogados);
router.get('/auxiliares', requireRole('ADMIN', 'ABOGADO'), usersController.getAuxiliares);
router.get('/mis-auxiliares', requireRole('ABOGADO'), usersController.getMyAuxiliares);
router.post('/mis-auxiliares/:auxiliarId', requireRole('ABOGADO'), usersController.addAuxiliar);
router.delete('/mis-auxiliares/:auxiliarId', requireRole('ABOGADO'), usersController.removeAuxiliar);
router.post('/invite', requireRole('ADMIN', 'ABOGADO'), usersController.inviteUser);

router.get('/', requireRole('ADMIN'), usersController.getAllUsers);
router.post('/', requireRole('ADMIN'), usersController.createUser);
router.delete('/:id', requireRole('ADMIN'), usersController.deleteUser);
router.post('/:id/reset-password', requireRole('ADMIN'), usersController.sendPasswordReset);

router.get('/:id', usersController.getUserById);
router.put('/:id', usersController.updateUser);
router.post('/:id/change-password', usersController.changePassword);
router.post('/:id/photo', uploadPhoto.single('photo'), processPhoto, usersController.uploadUserPhoto);
router.delete('/:id/photo', usersController.deleteUserPhoto);

export default router;
