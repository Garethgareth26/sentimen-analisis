import React from 'react';
import {
  RefreshCw,
  Cpu,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function ControlPanel({
  activeStation,
  activePart,
  standardText,
  onRecheck,
  onLearningAi,
  onPrevStation,
  onNextStation,
  onResetNg,
  isLeader
}) {
  const isNg = activeStation?.judge === 'NG';
  const isOk = activeStation?.judge === 'OK';
  const bannerClass = isNg ? 'ng' : (isOk ? 'ok' : 'idle');
  const bannerText = isNg ? 'NG' : (isOk ? 'OK' : 'STANDBY');
  const has4Kp = Boolean(activeStation?.has_4_keypoints || activeStation?.upper_resin_mm != null);

  const minStd = Number(activePart?.min_distance_mm ?? 0.7);
  const maxStd = Number(activePart?.max_distance_mm ?? 1.7);
  const offset = Number(activePart?.jig_offset_mm ?? 0.063);
  const effMin = Number((minStd + offset).toFixed(3));
  const effMax = Number((maxStd - offset).toFixed(3));

  return (
    <aside className="panel-controls">
      {/* Standard Specification (Opsi B: Transparan Toleransi Gambar vs Batas Efektif Jig) */}
      <div className="std-spec-card" style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className="std-spec-label" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.4px', color: '#0369a1' }}>
            STANDARD TOLERANCE
          </span>
          <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
            {activePart?.part_number || 'DN-XRAY-42890-A'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Drawing Std:</span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
              {minStd.toFixed(1)} - {maxStd.toFixed(1)} mm
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f0f9ff', padding: '2px 5px', borderRadius: '4px', border: '1px solid #bae6fd' }}>
            <span style={{ color: '#0369a1', fontWeight: 600 }}>
              Efektif (Offset ±{offset}):
            </span>
            <span style={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
              {effMin.toFixed(3)} - {effMax.toFixed(3)} mm
            </span>
          </div>

          {has4Kp && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px' }}>
              <span style={{ color: '#64748b' }}>Resin Min:</span>
              <span style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>≥ 0.20 mm</span>
            </div>
          )}
        </div>
      </div>

      {/* Judgement Banner Besar */}
      <div className={`judgement-banner ${bannerClass}`}>
        {bannerText}
      </div>

      {/* Measurement Detail */}
      <div className="measure-detail-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="measure-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
            Station Active:
          </span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
            st{activeStation?.id || 1}
          </span>
        </div>

        {has4Kp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
            {/* 1. Gap Horizontal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>1. Gap IC (A-B):</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'monospace', color: activeStation?.gap_ok ? '#059669' : '#dc2626' }}>
                    {activeStation?.gap_mm != null ? `${Number(activeStation.gap_mm).toFixed(3)} mm` : (activeStation?.value != null ? `${Number(activeStation.value).toFixed(3)} mm` : '-')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 5px', borderRadius: '4px', background: activeStation?.gap_ok ? '#dcfce7' : '#fee2e2', color: activeStation?.gap_ok ? '#15803d' : '#b91c1c' }}>
                    {activeStation?.gap_ok ? 'OK' : 'NG'}
                  </span>
                </div>
              </div>
              {/* Keterangan Eksplisit Jika Nilai Gap NG */}
              {!activeStation?.gap_ok && (activeStation?.gap_mm != null || activeStation?.value != null) && (
                <div style={{ fontSize: '10px', color: '#b91c1c', background: '#fee2e2', padding: '2px 6px', borderRadius: '3px', textAlign: 'right', fontWeight: 600, marginTop: '2px' }}>
                  {Number(activeStation.gap_mm ?? activeStation.value) > effMax
                    ? `> Batas Atas Efektif ${effMax.toFixed(3)} mm (Offset ±${offset})`
                    : `< Batas Bawah Efektif ${effMin.toFixed(3)} mm (Offset ±${offset})`}
                </div>
              )}
            </div>

            {/* 2. Resin Atas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>2. Resin Atas:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'monospace', color: activeStation?.upper_ok ? '#059669' : '#dc2626' }}>
                  {activeStation?.upper_resin_mm != null ? `${Number(activeStation.upper_resin_mm).toFixed(3)} mm` : '-'}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 5px', borderRadius: '4px', background: activeStation?.upper_ok ? '#dcfce7' : '#fee2e2', color: activeStation?.upper_ok ? '#15803d' : '#b91c1c' }}>
                  {activeStation?.upper_ok ? 'OK' : 'NG'}
                </span>
              </div>
            </div>

            {/* 3. Resin Bawah */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>3. Resin Bawah:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'monospace', color: activeStation?.lower_ok ? '#059669' : '#dc2626' }}>
                  {activeStation?.lower_resin_mm != null ? `${Number(activeStation.lower_resin_mm).toFixed(3)} mm` : '-'}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 5px', borderRadius: '4px', background: activeStation?.lower_ok ? '#dcfce7' : '#fee2e2', color: activeStation?.lower_ok ? '#15803d' : '#b91c1c' }}>
                  {activeStation?.lower_ok ? 'OK' : 'NG'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="measure-row">
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
              Dimension (A - B):
            </span>
            <span className="measure-dim-val">
              {activeStation?.value != null ? `${Number(activeStation.value).toFixed(3)} mm` : '-'}
            </span>
          </div>
        )}

        <div className="measure-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
            File Image:
          </span>
          <span style={{ fontSize: '11px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
            {activeStation?.image || '-'}
          </span>
        </div>
      </div>

      {/* Operational Buttons Grid */}
      <div className="action-grid-buttons">
        {/* Recheck */}
        <button
          type="button"
          className="action-btn primary"
          onClick={onRecheck}
          disabled={!activeStation?.image}
          style={{ opacity: !activeStation?.image ? 0.5 : 1, cursor: !activeStation?.image ? 'not-allowed' : 'pointer' }}
          title={!activeStation?.image ? 'Jalankan tray terlebih dahulu' : 'Lakukan inferensi ulang AI untuk stasiun ini'}
        >
          <RefreshCw size={14} />
          <span>Re-check</span>
        </button>

        {/* Learning AI */}
        <button
          type="button"
          className="action-btn"
          onClick={onLearningAi}
        >
          <Cpu size={14} />
          <span>Learning AI</span>
        </button>

        {/* Navigasi Prev & Next dengan Indikator Shortcut Keyboard */}
        <button
          type="button"
          className="action-btn"
          onClick={onPrevStation}
          title="Stasiun Sebelumnya (Shortcut: tombol < atau panah kiri)"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          <ChevronLeft size={14} />
          <span>Prev (st)</span>
          <kbd style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            background: '#e2e8f0',
            color: '#475569',
            padding: '1px 5px',
            borderRadius: '3px',
            border: '1px solid #cbd5e1',
            fontWeight: 800
          }}>&lt;</kbd>
        </button>

        <button
          type="button"
          className="action-btn"
          onClick={onNextStation}
          title="Stasiun Berikutnya (Shortcut: tombol > atau panah kanan)"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          <span>Next (st)</span>
          <kbd style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            background: '#e2e8f0',
            color: '#475569',
            padding: '1px 5px',
            borderRadius: '3px',
            border: '1px solid #cbd5e1',
            fontWeight: 800
          }}>&gt;</kbd>
          <ChevronRight size={14} />
        </button>


        {/* POKAYOKE Alarm Clear Button (Hanya jika NG atau dibuka Leader) */}
        {isNg && (
          <button
            type="button"
            className="action-btn wide alarm-reset"
            onClick={onResetNg}
          >
            <AlertTriangle size={15} />
            <span>POKAYOKE ALARM (SCAN QR LEADER)</span>
          </button>
        )}
      </div>
    </aside>
  );
}
