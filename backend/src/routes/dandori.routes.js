import { Router } from 'express';
import { dandoriController } from '../controllers/dandori.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/master-parts', dandoriController.getMasterParts);
router.get('/current', dandoriController.getCurrentPart);
router.post('/changeover', dandoriController.changeover);

export default router;
