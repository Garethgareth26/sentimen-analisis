import { Router } from 'express';
import { processController } from '../controllers/process.controller.js';

const router = Router();

router.post('/process', processController.processImage);
router.post('/jig-measure', processController.jigMeasure);

export default router;
