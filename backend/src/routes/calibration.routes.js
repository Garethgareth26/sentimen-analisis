import { Router } from 'express';
import { calibrationController } from '../controllers/calibration.controller.js';

const router = Router();

router.get('/status', calibrationController.getStatus);
router.post('/measure', calibrationController.measureJig);
router.post('/register', calibrationController.registerScale);

export default router;
