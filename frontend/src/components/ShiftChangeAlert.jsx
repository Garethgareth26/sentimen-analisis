import React from 'react';
import { Clock, LogOut, AlertTriangle } from 'lucide-react';

export default function ShiftChangeAlert({ isOpen, onConfirmLogout, currentShift, targetShift }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.85)', zIndex: 2000 }}>
      <div className="modal-dialog" style={{ maxWidth: '480px' }}>
        <div className="modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fee2e2' }}>
          <div className="modal-title" style={{ color: '#b91c1c' }}>
            <AlertTriangle size={20} color="#dc2626" />
            <span>PERGANTIAN SHIFT PRODUKSI (AUTO-LOGOUT)</span>
          </div>
        </div>

        <div className="modal-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
          <Clock size={48} color="#0284c7" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            Waktu Pergantian Shift Telah Tiba
          </h3>
          <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, marginBottom: '20px' }}>
            Shift saat ini (<strong>{currentShift}</strong>) telah berakhir dan berganti ke <strong>{targetShift || 'Shift Baru'}</strong> (Pukul 07:00 / 20:30).
            <br />
            Sesuai SOP Denso, sesi operator aktif otomatis ditutup untuk hand-over shift. Silakan login kembali dengan ID Card shift yang bertugas.
          </p>

          <button
            type="button"
            className="exact-btn-submit"
            style={{ width: '100%', margin: 0 }}
            onClick={onConfirmLogout}
          >
            <LogOut size={16} />
            <span>KEMBALI KE HALAMAN LOGIN</span>
          </button>
        </div>
      </div>
    </div>
  );
}
