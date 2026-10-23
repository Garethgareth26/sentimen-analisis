import { verifyAuthToken } from '../services/auth.service.js';

/**
 * Middleware untuk memverifikasi autentikasi via HttpOnly Cookie (DNIA Standard)
 * atau fallback Authorization Header Bearer token.
 */
export function requireAuth(req, res, next) {
  let token = req.cookies?.denso_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Sesi login tidak ditemukan. Silakan login terlebih dahulu.'
    });
  }

  try {
    const user = verifyAuthToken(token);
    req.user = user;
    next();
  } catch (err) {
    if (err.code === 'SHIFT_EXPIRED' || err.name === 'TokenExpiredError') {
      // Hapus cookie kadaluarsa
      res.clearCookie('denso_token');
      return res.status(401).json({
        ok: false,
        code: 'SHIFT_EXPIRED',
        error: 'Waktu pergantian shift telah tiba (07:00 / 20:30). Sesi otomatis ditutup.'
      });
    }

    return res.status(403).json({
      ok: false,
      code: 'FORBIDDEN',
      error: 'Token autentikasi tidak valid.'
    });
  }
}

/**
 * Middleware pembatasan hak akses berbasis Role Denso (Operator, TL, Admin)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Akses ditolak: User belum terautentikasi' });
    }

    const userRole = req.user.role?.toLowerCase();
    const hasRole = allowedRoles.map((r) => r.toLowerCase()).includes(userRole);

    if (!hasRole) {
      return res.status(403).json({
        ok: false,
        code: 'ROLE_FORBIDDEN',
        error: `Akses ditolak: Role '${userRole}' tidak memiliki wewenang untuk fitur ini.`
      });
    }

    next();
  };
}
