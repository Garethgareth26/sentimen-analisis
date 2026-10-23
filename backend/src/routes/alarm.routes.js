import { Router } from 'express';
import { alarmController } from '../controllers/alarm.controller.js';

const router = Router();

router.get('/status', alarmController.getStatus);
router.get('/audit', alarmController.getAuditLogs);
router.post('/trigger', alarmController.triggerAlarm);
router.post('/verify-leader', alarmController.verifyLeader);
router.post('/manual-override', alarmController.manualOverride);
router.post('/release', alarmController.releaseAlarm);

export default router;
