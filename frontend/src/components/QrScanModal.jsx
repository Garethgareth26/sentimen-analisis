import React, { useState } from 'react';
import { Barcode, X, Check, ShieldAlert, Cpu, Tag } from 'lucide-react';

export default function QrScanModal({ isOpen, onClose, onScanSuccess, mode, title }) {
  const [qrInput, setQrInput] = useState('');

  if (!isOpen) return null;

  function handleSubmit(e) {
    e?.preventDefault();
    if (!qrInput.trim()) return;
    onScanSuccess(qrInput.trim());
    setQrInput('');
    onClose();
  }

  function handleQuickSimulate(code) {
    onScanSuccess(code);
    setQrInput('');
    onClose();
  }

  const isLeaderMode = mode === 'leader_reset';
  const isKanbanMode = mode === 'kanban' || mode === 'dandori';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {isKanbanMode ? (
              <Tag size={18} color="#0284c7" />
            ) : isLeaderMode ? (
              <ShieldAlert size={18} color="#ef4444" />
            ) : (
              <Barcode size={18} color="#0284c7" />
            )}
            <span>
              {title || (isKanbanMode ? 'Dandori (Scan Barcode/QR Kanban)' : isLeaderMode ? 'Scan Barcode Leader' : 'Scan Barcode ID Card')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px' }}>
              {isKanbanMode
                ? 'Scan barcode / QR Code pada Kartu Kanban Produksi untuk mengganti Part Number aktif secara otomatis.'
                : isLeaderMode
                ? 'Dekatkan barcode scanner fisik ke ID Card Leader / Supervisor untuk verifikasi unlock interlock.'
                : 'Arahkan barcode scanner fisik ke Barcode pada ID Card karyawan, atau masukkan nomor NPK di bawah ini.'}
            </p>

            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                className="exact-input"
                placeholder={
                  isKanbanMode
                    ? 'Contoh: KANBAN:DN-XRAY-42890-A:MIN=0.70:MAX=1.70'
                    : isLeaderMode
                    ? 'Contoh NPK Leader: 8021 atau DENSO:TL:8021:SUGIMOTO'
                    : 'Contoh NPK: 1092 atau scan barcode ID Card'
                }
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Simulasi Cepat (Demo Barcode Scanner Denso):
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isKanbanMode ? (
                  <>
                    <button
                      type="button"
                      className="exact-preset-btn"
                      style={{ background: '#f0f9ff', borderColor: '#0284c7', color: '#0369a1', fontWeight: 700 }}
                      onClick={() => handleQuickSimulate('KANBAN:DN-XRAY-42890-A:MIN=0.70:MAX=1.70')}
                    >
                      Kanban P/N: 42890-A (Std Denso 0.70 - 1.70 mm)
                    </button>
                    <button
                      type="button"
                      className="exact-preset-btn"
                      onClick={() => handleQuickSimulate('KANBAN:DN-XRAY-42890-B:MIN=0.95:MAX=1.55')}
                    >
                      Kanban P/N: 42890-B (Tight 0.95 - 1.55 mm)
                    </button>
                    <button
                      type="button"
                      className="exact-preset-btn"
                      onClick={() => handleQuickSimulate('KANBAN:28438-51001:MIN=0.80:MAX=1.50')}
                    >
                      Kanban P/N: 28438-51001 (Direct Sensor 0.80 - 1.50 mm)
                    </button>
                  </>
                ) : isLeaderMode ? (
                  <>
                    <button
                      type="button"
                      className="exact-preset-btn"
                      onClick={() => handleQuickSimulate('8021')}
                    >
                      Barcode Team Leader (8021 - Sugimoto)
                    </button>
                    <button
                      type="button"
                      className="exact-preset-btn"
                      onClick={() => handleQuickSimulate('ADM001')}
                    >
                      Barcode Admin PE (ADM001)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="exact-preset-btn"
                      onClick={() => handleQuickSimulate('1092')}
                    >
                      Barcode Operator (1092 - Budi Santoso)
                    </button>
                    <button
                      type="button"
                      className="exact-preset-btn"
                      onClick={() => handleQuickSimulate('8021')}
                    >
                      Barcode Leader (8021 - Sugimoto)
                    </button>
                    <button
                      type="button"
                      className="exact-preset-btn"
                      onClick={() => handleQuickSimulate('ADM001')}
                    >
                      Barcode Admin (ADM001 - PE)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="action-btn" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="action-btn primary" disabled={!qrInput.trim()}>
              <Check size={14} />
              <span>Verifikasi Scan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
