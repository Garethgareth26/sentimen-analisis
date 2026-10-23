import {
  getShiftInfo,
  resolveUser,
  parseQrData,
  generateAuthToken,
  getAllUsers,
  createUser,
  deleteUser
} from '../services/auth.service.js';

// Konfigurasi Cookie HttpOnly sesuai standar DNIA DX Vol 1 & Vol 3
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
};

export const authController = {
  /**
   * POST /api/auth/login
   * Login menggunakan Nama & NPK
   */
  async login(req, res) {
    const { name, npk, role } = req.validated;
    const resolved = resolveUser(name, npk, role);
    if (!resolved || resolved.error) {
      return res.status(401).json({
        ok: false,
        error: resolved?.error || 'Autentikasi gagal. NPK tidak ditemukan.'
      });
    }

    const { token, shiftInfo, payload } = generateAuthToken(resolved);

    // Sematkan JWT ke HttpOnly Cookie (DNIA Standard)
    res.cookie('denso_token', token, {
      ...COOKIE_OPTIONS,
      maxAge: shiftInfo.secondsRemaining * 1000
    });

    return res.json({
      ok: true,
      token, // tetap sediakan token untuk kompatibilitas client
      user: {
        name: resolved.name,
        npk: resolved.npk,
        role: resolved.role,
        department: resolved.department,
        shift: shiftInfo.currentShift,
        loginAt: payload.loginAt
      },
      shiftInfo
    });
  },

  /**
   * POST /api/auth/qr-login
   * Login menggunakan pemindai Barcode / QR ID Card
   */
  async qrLogin(req, res) {
    const { qrCode } = req.validated;
    const parsed = parseQrData(qrCode);

    if (!parsed || !parsed.npk) {
      return res.status(400).json({
        ok: false,
        error: 'Format QR Code tidak dikenali atau NPK tidak ditemukan.'
      });
    }

    const resolved = resolveUser(parsed.name, parsed.npk, parsed.role);
    if (!resolved || resolved.error) {
      return res.status(401).json({
        ok: false,
        error: resolved?.error || 'QR ID Card tidak terdaftar dalam database karyawan Denso.'
      });
    }
    const { token, shiftInfo, payload } = generateAuthToken(resolved);

    // Sematkan ke HttpOnly Cookie
    res.cookie('denso_token', token, {
      ...COOKIE_OPTIONS,
      maxAge: shiftInfo.secondsRemaining * 1000
    });

    return res.json({
      ok: true,
      token,
      user: {
        name: resolved.name,
        npk: resolved.npk,
        role: resolved.role,
        department: resolved.department,
        shift: shiftInfo.currentShift,
        loginAt: payload.loginAt
      },
      shiftInfo
    });
  },

  /**
   * GET /api/auth/shift-status
   * Mendapatkan status shift real-time (polling auto-logout)
   */
  async getShiftStatus(_req, res) {
    const shiftInfo = getShiftInfo();
    return res.json({ ok: true, ...shiftInfo });
  },

  /**
   * GET /api/auth/me
   * Mendapatkan profil sesi aktif
   */
  async me(req, res) {
    const shiftInfo = getShiftInfo();
    return res.json({
      ok: true,
      user: req.user,
      shiftInfo
    });
  },

  /**
   * POST /api/auth/logout
   * Logout dan hapus cookie
   */
  async logout(_req, res) {
    res.clearCookie('denso_token', COOKIE_OPTIONS);
    return res.json({ ok: true, message: 'Berhasil keluar dari sistem Denso.' });
  },

  /**
   * GET /api/auth/users
   * Daftar seluruh karyawan terdaftar
   */
  async listUsers(_req, res) {
    const users = getAllUsers();
    return res.json({ ok: true, users });
  },

  /**
   * POST /api/auth/users
   * Daftarkan karyawan baru ke master list Denso
   */
  async addUser(req, res) {
    try {
      const { npk, name, role, department } = req.body;
      const newUser = createUser({ npk, name, role, department });
      return res.status(201).json({
        ok: true,
        user: newUser,
        message: `Karyawan ${newUser.name} (${newUser.npk}) berhasil didaftarkan sebagai ${newUser.role.toUpperCase()}.`
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },

  /**
   * DELETE /api/auth/users/:npk
   * Hapus karyawan dari sistem
   */
  async deleteUser(req, res) {
    try {
      const { npk } = req.params;
      deleteUser(npk);
      return res.json({
        ok: true,
        message: `Karyawan dengan NPK ${npk} berhasil dihapus dari sistem.`
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  }
};
