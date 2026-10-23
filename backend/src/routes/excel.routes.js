import { Router } from 'express';
import { excelController } from '../controllers/excel.controller.js';

const router = Router();

router.post('/sync', excelController.syncToExcel);
router.post('/clear', excelController.clearExcelData);
router.get('/download', excelController.downloadExcel);

export default router;
