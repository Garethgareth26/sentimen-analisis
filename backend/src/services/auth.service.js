import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, '..', 'config', 'users.json');

const JWT_SECRET = process.env.JWT_SECRET || 'DENSO_AIXRAY_SECRET_KEY_2026_MM2100';

/**
 * Menghitung status shift Denso:
 * - Day Shift   : 07:00:00 s/d 20:29:59
 * - Night Shift : 20:30:00 s/d 06:59:59
 * Pergantian shift & auto-logout tepat pada: 07:00:00 dan 20:30:00
 */
export function getShiftInfo(customDate = new Date()) {
  const now = new Date(customDate);
  const hours = now.getHours();
  const minutes = now.getMinutes();

  const totalMinutes = hours * 60 + minutes;
  const dayStartMinutes = 7 * 60;          // 07:00 -> 420 menit
  const nightStartMinutes = 20 * 60 + 30;  // 20:30 -> 1230 menit

  const isDayShift = totalMinutes >= dayStartMinutes && totalMinutes < nightStartMinutes;
  const currentShift = isDayShift ? 'Day Shift' : 'Night Shift';

  const nextChange = new Date(now);
  if (isDayShift) {
    nextChange.setHours(20, 30, 0, 0);
  } else {
    if (totalMinutes >= nightStartMinutes) {
      nextChange.setDate(nextChange.getDate() + 1);
      nextChange.setHours(7, 0, 0, 0);
    } else {
      nextChange.setHours(7, 0, 0, 0);
    }
  }

  const secondsRemaining = Math.max(0, Math.floor((nextChange.getTime() - now.getTime()) / 1000));

  return {
    currentShift,
    isDayShift,
    currentTime: now.toLocaleTimeString('id-ID', { hour12: false }),
    currentDate: now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    nextShiftChangeTime: nextChange.toLocaleTimeString('id-ID', { hour12: false }),
    nextShiftChangeDate: nextChange.toLocaleDateString('id-ID'),
    nextShiftChangeTimestamp: nextChange.getTime(),
    secondsRemaining
  };
}

/**
 * Membaca master list pengguna dari users.json
 */
export function getAllUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      return data.users || [];
    }
  } catch (err) {
    console.warn('Gagal membaca users.json:', err.message);
  }
  return [];
}

function loadMasterUsers() {
  return getAllUsers();
}

export function saveMasterUsers(usersList) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: usersList }, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Gagal menyimpan users.json:', err.message);
    throw new Error('Gagal menyimpan database karyawan: ' + err.message);
  }
}

export function createUser({ npk, name, role, department }) {
  const cleanNpk = String(npk || '').trim();
  const cleanName = String(name || '').trim();
  const cleanRole = String(role || 'operator').toLowerCase().trim();
  const cleanDept = String(department || 'Production - Section X-Ray').trim();

  if (!cleanNpk) throw new Error('Nomor NPK wajib diisi.');
  if (!cleanName) throw new Error('Nama karyawan wajib diisi.');
  if (!['operator', 'tl', 'admin'].includes(cleanRole)) {
    throw new Error('Role karyawan harus Operator, Team Leader (TL), atau Admin.');
  }

  const users = getAllUsers();
  if (users.some((u) => u.npk.toUpperCase() === cleanNpk.toUpperCase())) {
    throw new Error(`NPK '${cleanNpk}' sudah terdaftar dalam sistem Denso.`);
  }

  const newUser = {
    npk: cleanNpk,
    name: cleanName,
    role: cleanRole,
    department: cleanDept
  };

  users.push(newUser);
  saveMasterUsers(users);
  return newUser;
}

export function deleteUser(npkToDelete) {
  const cleanNpk = String(npkToDelete || '').trim().toUpperCase();
  const users = getAllUsers();
  const filtered = users.filter((u) => u.npk.toUpperCase() !== cleanNpk);

  if (filtered.length === users.length) {
    throw new Error(`NPK '${npkToDelete}' tidak ditemukan.`);
  }

  saveMasterUsers(filtered);
  return true;
}

/**
 * Menyelesaikan profil & role pengguna secara ketat (Strict Production Mode):
 * 1. Memeriksa keberadaan NPK di master list users.json
 * 2. Memeriksa kesesuaian Nama operator dengan database master
 * 3. Menolak user yang tidak terdaftar (mencegah akses ilegal/dummy)
 */
export function resolveUser(name, npk, requestedRole) {
  const cleanNpk = String(npk || '').trim();
  const cleanName = String(name || '').trim();
  const normNpk = cleanNpk.toUpperCase();
  const strippedNpk = normNpk.replace(/\s+/g, '');

  // 1. Cek master users
  const masterList = loadMasterUsers();
  const matched = masterList.find((u) => {
    const uNpk = String(u.npk || '').toUpperCase().trim();
    return uNpk === normNpk || (strippedNpk && uNpk.replace(/\s+/g, '') === strippedNpk);
  });

  // Jika NPK tidak terdaftar sama sekali di database master
  if (!matched) {
    return {
      error: `NPK '${cleanNpk}' tidak terdaftar dalam sistem Denso. Pastikan NPK Anda benar atau hubungi Team Leader.`
    };
  }

  // 2. Validasi kecocokan nama jika nama diisi
  if (cleanName) {
    const dbNameLower = matched.name.toLowerCase();
    const inputNameLower = cleanName.toLowerCase();
    const dbFirstWord = dbNameLower.split(/\s+/)[0];
    const inputFirstWord = inputNameLower.split(/\s+/)[0];

    // Cek apakah ada kecocokan nama (case-insensitive, nama depan, atau substring)
    const isNameMatch =
      dbNameLower.includes(inputNameLower) ||
      inputNameLower.includes(dbFirstWord) ||
      dbNameLower.includes(inputFirstWord);

    if (!isNameMatch) {
      return {
        error: `Nama '${cleanName}' tidak sesuai dengan data NPK ${cleanNpk} (terdaftar atas nama: ${matched.name}).`
      };
    }
  }

  return {
    name: matched.name, // Gunakan nama resmi terdaftar di database
    npk: matched.npk,
    role: matched.role,
    department: matched.department || 'Section X-Ray'
  };
}

/**
 * Parsing data mentah dari pembacaan Scanner Barcode / QR ID Card
 */
export function parseQrData(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') return null;
  const raw = rawCode.trim();
  let name = '';
  let npk = '';
  let role = '';

  // A. Format JSON
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      name = parsed.name || parsed.Nama || '';
      npk = parsed.npk || parsed.NPK || '';
      role = parsed.role || parsed.Role || '';
      return { name, npk, role };
    } catch (_) {}
  }

  // B. Format Standar Denso: DENSO:ROLE:NPK:NAME
  if (raw.toUpperCase().startsWith('DENSO:')) {
    const parts = raw.split(':');
    if (parts.length >= 4) {
      role = parts[1];
      npk = parts[2];
      name = parts.slice(3).join(':');
      return { name, npk, role };
    } else if (parts.length === 3) {
      npk = parts[1];
      name = parts[2];
      return { name, npk, role: '' };
    }
  }

  // C. Format Pipe: NPK|NAME
  if (raw.includes('|')) {
    const parts = raw.split('|');
    npk = parts[0]?.trim();
    name = parts[1]?.trim();
    return { name, npk, role: '' };
  }

  // D. Fallback: String adalah NPK murni saja
  return { name: '', npk: raw, role: '' };
}

/**
 * Menerbitkan token JWT dengan masa aktif terikat shift
 */
export function generateAuthToken(user) {
  const shiftInfo = getShiftInfo();
  const expiresInSeconds = Math.max(60, shiftInfo.secondsRemaining);

  const payload = {
    name: user.name,
    npk: user.npk,
    role: user.role,
    department: user.department || 'Section X-Ray',
    shift: shiftInfo.currentShift,
    shiftExpiry: shiftInfo.nextShiftChangeTimestamp,
    loginAt: Date.now()
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
  return { token, shiftInfo, payload };
}

/**
 * Verifikasi token JWT dan penegakan batas waktu shift
 */
export function verifyAuthToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  // Penegakan server-side: tolak jika shift sudah berganti
  if (payload.shiftExpiry && Date.now() >= payload.shiftExpiry) {
    const err = new Error('Sesi shift telah berakhir. Silakan login kembali.');
    err.code = 'SHIFT_EXPIRED';
    throw err;
  }
  return payload;
}
