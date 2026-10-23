/**
 * auth.js — Compatibility Bridge ke arsitektur Layered MVC (DNIA DX Standard)
 * Mengalihkan seluruh pemanggilan ke src/services/auth.service.js & src/middlewares/auth.middleware.js
 */
export {
  getShiftInfo,
  resolveUser as resolveUserRole,
  generateAuthToken as generateToken,
  verifyAuthToken,
  parseQrData
} from './src/services/auth.service.js';

export {
  requireAuth,
  requireRole
} from './src/middlewares/auth.middleware.js';
