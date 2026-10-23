import { Router } from 'express';
import { historyController } from '../controllers/history.controller.js';

const router = Router();

// Endpoint riwayat inspeksi & CSV
router.get('/', historyController.getLogs);
router.get('/dates', historyController.getAvailableDates);
router.get('/download', historyController.downloadCsv);
router.post('/transfer', historyController.transferData);
router.get('/transfer-status', historyController.getTransferStatus);

export default router;
