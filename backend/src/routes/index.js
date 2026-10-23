import { Router } from 'express';
import authRoutes from './auth.routes.js';
import systemRoutes from './system.routes.js';
import processRoutes from './process.routes.js';
import dandoriRoutes from './dandori.routes.js';
import calibrationRoutes from './calibration.routes.js';
import trayRoutes from './tray.routes.js';
import alarmRoutes from './alarm.routes.js';
import historyRoutes from './history.routes.js';
import excelRoutes from './excel.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/dandori', dandoriRoutes);
apiRouter.use('/calibration', calibrationRoutes);
apiRouter.use('/tray', trayRoutes);
apiRouter.use('/alarm', alarmRoutes);
apiRouter.use('/history', historyRoutes);
apiRouter.use('/excel', excelRoutes);
apiRouter.use('/', systemRoutes);
apiRouter.use('/', processRoutes);

export default apiRouter;
