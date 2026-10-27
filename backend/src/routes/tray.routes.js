import { Router } from 'express';
import { trayController } from '../controllers/tray.controller.js';

const router = Router();

router.get('/current', trayController.getCurrentTray);
router.get('/metrics', trayController.getMetrics);
router.get('/mode', trayController.getMode);
router.post('/mode', trayController.setMode);
router.get('/check-new-batch', trayController.checkNewBatch);
router.post('/mark-inspected', trayController.markInspected);
router.get('/next-sequence', trayController.getNextSequence);
router.post('/reset', trayController.resetTray);
router.post('/finish-batch', trayController.finishBatch);
router.post('/inspect', trayController.inspectTray);
router.post('/station', trayController.inspectSingleStation);

export default router;
