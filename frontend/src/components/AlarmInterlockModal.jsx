import React, { useState } from 'react';
import axios from 'axios';
import { AlertTriangle, ShieldAlert, QrCode, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

import { API } from '../apiConfig.js';

export default function AlarmInterlockModal({
  isOpen,
  ngStation,
  allNgStations = [],
  onResetByLeader,
  onRecheckStation
}) {
  const [leaderVerified, setLeaderVerified] = useState(false);
  const [verifiedLeader, setVerifiedLeader] = useState(null);
  const [leaderQrInput, setLeaderQrInput] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const ngList = (allNgStations && allNgStations.length > 0)
    ? allNgStations
    : (ngStation ? [ngStation] : []);

  const currentFocusStationId = selectedTargetId || ngStation?.id || (ngList[0]?.id || 1);

  async function handleVerifyLeader(code) {
    const val = (code || leaderQrInput).trim();
    if (!val) {
      setErrorMsg('Masukkan string atau scan barcode/QR kartu ID');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const resp = await axios.post(`${API}/api/alarm/verify-leader`, { qrCode: val }, { withCredentials: true });
      if (resp.data.ok) {
        setLeaderVerified(true);
        setVerifiedLeader(resp.data.data.leader);
        setErrorMsg('');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Otorisasi gagal');
    } finally {
      setLoading(false);
    }
  }

  async function handleReleaseInterlock() {
    setLoading(true);
    try {
      await axios.post(`${API}/api/alarm/release`, {
        leaderNpk: verifiedLeader?.npk || '8021',
        action: 'release',
        reason: 'Verifikasi abnormalitas selesai oleh Team Leader'
      }, { withCredentials: true });

      onResetByLeader();
      setLeaderVerified(false);
      setVerifiedLeader(null);
      setLeaderQrInput('');
    } catch (err) {
      alert(`Gagal melepaskan interlock: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.88)', zIndex: 9999 }}>
      <div className="modal-dialog pokayoke-alarm-card" style={{ maxWidth: '640px' }}>
        {/* Header Merah Tegas POKAYOKE */}
        <div className="pokayoke-alarm-header" style={{
          background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#ffffff',
          fontWeight: 800,
          letterSpacing: '0.5px'
        }}>
          <AlertTriangle size={24} color="#fef08a" />
          <span>POKAYOKE ALARM — INTERLOCK TERKUNCI (NG DETECTED)</span>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          <p style={{ fontSize: '13px', color: '#b91c1c', fontWeight: 600, marginBottom: '16px', lineHeight: '1.5' }}>
            PERINGATAN: Sistem mendeteksi hasil ukur NG di luar batas toleransi standar Denso. Mesin terkunci secara otomatis (POKAYOKE Interlock) untuk mencegah part cacat lolos ke proses selanjutnya (flow out).
          </p>

          {/* Tabel Detail Kesalahan */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '18px',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{ background: '#fee2e2', color: '#991b1b', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', border: '1px solid #fecaca' }}>Alarm / Item</th>
                <th style={{ padding: '8px 12px', border: '1px solid #fecaca' }}>Station</th>
                <th style={{ padding: '8px 12px', border: '1px solid #fecaca' }}>Dimension</th>
                <th style={{ padding: '8px 12px', border: '1px solid #fecaca' }}>Judgement</th>
              </tr>
            </thead>
            <tbody>
              {ngList.map((st) => {
                const isSelected = st.id === currentFocusStationId;
                return (
                  <tr
                    key={st.id}
                    onClick={() => setSelectedTargetId(st.id)}
                    style={{
                      background: isSelected ? '#fef2f2' : '#ffffff',
                      color: '#1e293b',
                      cursor: ngList.length > 1 ? 'pointer' : 'default',
                      borderLeft: isSelected ? '4px solid #dc2626' : 'none'
                    }}
                    title={ngList.length > 1 ? `Klik untuk fokus ke st${st.id}` : ''}
                  >
                    <td style={{ padding: '8px 12px', border: '1px solid #fecaca', fontWeight: 700 }}>
                      IC Chip Position Tolerance Out {isSelected && ngList.length > 1 ? '(Aktif)' : ''}
                    </td>
                    <td style={{ padding: '8px 12px', border: '1px solid #fecaca', fontWeight: 800 }}>
                      st{st.id}
                    </td>
                    <td style={{ padding: '8px 12px', border: '1px solid #fecaca', fontWeight: 800, color: '#dc2626' }}>
                      {st.value != null ? `${Number(st.value).toFixed(3)} mm` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', border: '1px solid #fecaca' }}>
                      <span className="pocket-judge-badge ng" style={{ fontSize: '11px', padding: '2px 8px' }}>
                        NG
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Otorisasi Leader QR */}
          {!leaderVerified ? (
            <div style={{
              background: '#f8fafc',
              border: '1.5px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '18px',
              textAlign: 'center'
            }}>
              <ShieldAlert size={34} color="#dc2626" style={{ margin: '0 auto 8px' }} />
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                Wajib Otorisasi Team Leader (TL)
              </h4>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                Scan QR Card Team Leader / Supervisor untuk membuka interlock sistem POKAYOKE Denso.
              </p>

              <div style={{ display: 'flex', gap: '8px', maxWidth: '420px', margin: '0 auto 10px' }}>
                <input
                  type="text"
                  className="exact-input"
                  placeholder="Scan QR Leader / masukkan NPK..."
                  value={leaderQrInput}
                  onChange={(e) => setLeaderQrInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyLeader()}
                  autoFocus
                />
                <button
                  type="button"
                  className="action-btn primary"
                  disabled={loading}
                  onClick={() => handleVerifyLeader()}
                >
                  <QrCode size={14} />
                  <span>{loading ? 'Verifikasi...' : 'Scan'}</span>
                </button>
              </div>

              {errorMsg && (
                <div style={{
                  fontSize: '12px',
                  color: '#dc2626',
                  fontWeight: 600,
                  background: '#fef2f2',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginBottom: '10px'
                }}>
                  {errorMsg}
                </div>
              )}

              {/* Preset Simulasi Valid & Invalid */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  className="exact-preset-btn"
                  onClick={() => handleVerifyLeader('DENSO:TL:8021:SUGIMOTO')}
                >
                  ✓ [Simulasi Scan QR Leader Sugimoto (8021)]
                </button>
                <button
                  type="button"
                  className="exact-preset-btn"
                  onClick={() => handleVerifyLeader('DENSO:TL:8022:HENDRA')}
                >
                  ✓ [Simulasi Scan QR Leader Hendra (8022)]
                </button>
                <button
                  type="button"
                  className="exact-preset-btn"
                  style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                  onClick={() => handleVerifyLeader('1092')}
                >
                  ✗ [Uji Tolak: Scan ID Card Operator Budi (1092)]
                </button>
              </div>
            </div>
          ) : (
            /* Menu Aksi Leader Setelah Verifikasi Berhasil */
            <div style={{
              background: '#ecfdf5',
              border: '1.5px solid #a7f3d0',
              borderRadius: '12px',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', marginBottom: '14px', fontWeight: 800 }}>
                <CheckCircle2 size={20} />
                <span>Otorisasi Leader Terverifikasi: {verifiedLeader?.name} ({verifiedLeader?.role?.toUpperCase()} - {verifiedLeader?.npk})</span>
              </div>

              <span style={{ fontSize: '12px', color: '#334155', fontWeight: 700, display: 'block', marginBottom: '10px' }}>
                PILIH TINDAKAN PENYELESAIAN ABNORMALITAS:
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="action-btn"
                  style={{ background: '#f8fafc', padding: '12px', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}
                  onClick={() => {
                    onRecheckStation(currentFocusStationId);
                  }}
                >
                  <RefreshCw size={16} color="#0284c7" />
                  <span>1. Re-measure / Inferensi Ulang AI (st{currentFocusStationId})</span>
                </button>

                <button
                  type="button"
                  className="action-btn primary"
                  style={{
                    background: '#16a34a',
                    padding: '12px',
                    fontWeight: 800,
                    fontSize: '13px',
                    justifyContent: 'center'
                  }}
                  disabled={loading}
                  onClick={handleReleaseInterlock}
                >
                  <CheckCircle2 size={16} />
                  <span>2. Eject Part NG (Cek Manual Fisik di Luar) & Rilis Interlock</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
