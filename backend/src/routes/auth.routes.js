import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate, loginSchema, qrLoginSchema } from '../validators/auth.validator.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/shift-status', authController.getShiftStatus);
router.post('/login', validate(loginSchema), authController.login);
router.post('/qr-login', validate(qrLoginSchema), authController.qrLogin);
router.get('/me', requireAuth, authController.me);
router.post('/logout', authController.logout);

// Manajemen Karyawan / Users (Admin & Team Leader)
router.get('/users', authController.listUsers);
router.post('/users', authController.addUser);
router.delete('/users/:npk', authController.deleteUser);

export default router;
