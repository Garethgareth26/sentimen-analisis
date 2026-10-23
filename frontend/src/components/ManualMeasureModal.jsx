import React, { useState, useRef } from 'react';
import { Ruler, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export default function ManualMeasureModal({
  isOpen,
  onClose,
  imageUrl,
  currentStationId,
  scaleMmPerPixel = 0.02185,
  minDistanceMm = 0.89,
  maxDistanceMm = 1.61,
  onPrevStation,
  onNextStation,
  onSaveManualValue
}) {
  const [pointA, setPointA] = useState(null);
  const [pointB, setPointB] = useState(null);
  const imgRef = useRef(null);

  if (!isOpen) return null;

  function handleImageClick(e) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!pointA || (pointA && pointB)) {
      setPointA({ x, y });
      setPointB(null);
    } else {
      setPointB({ x, y });
    }
  }

  function handleResetPoints() {
    setPointA(null);
    setPointB(null);
  }

  // Hitung jarak pixel dan mm
  let distancePx = 0;
  let distanceMm = 0;
  let isWithinTol = false;
  if (pointA && pointB) {
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    distancePx = Math.sqrt(dx * dx + dy * dy);
    distanceMm = distancePx * scaleMmPerPixel;
    isWithinTol = distanceMm >= minDistanceMm && distanceMm <= maxDistanceMm;
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-dialog" style={{ maxWidth: '840px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Ruler size={18} color="#0284c7" />
            <span>Manual Measurement Tool — Station st{currentStationId} (Wireframe Image 12)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Tarik garis 2 titik (Point A ke Point B) di atas celah part untuk mengukur jarak live mm.
            </span>
            <button
              type="button"
              className="action-btn"
              style={{ padding: '4px 10px', fontSize: '11px' }}
              onClick={handleResetPoints}
            >
              <RotateCcw size={12} />
              <span>Reset Titik</span>
            </button>
          </div>

          {/* Interactive Canvas Area */}
          <div
            style={{
              position: 'relative',
              background: '#090e17',
              borderRadius: '12px',
              overflow: 'hidden',
              minHeight: '380px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'crosshair',
              userSelect: 'none'
            }}
            onClick={handleImageClick}
          >
            <img
              ref={imgRef}
              src={imageUrl || '/hero-login.jpeg'}
              alt="Part Inspection"
              style={{ maxHeight: '420px', maxWidth: '100%', objectFit: 'contain', pointerEvents: 'none' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/hero-login.jpeg';
              }}
            />

            {/* SVG overlay for drawing line */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            >
              {pointA && (
                <circle cx={pointA.x} cy={pointA.y} r={6} fill="#3b82f6" stroke="#ffffff" strokeWidth={2} />
              )}
              {pointB && (
                <circle cx={pointB.x} cy={pointB.y} r={6} fill="#ec4899" stroke="#ffffff" strokeWidth={2} />
              )}
              {pointA && pointB && (
                <line
                  x1={pointA.x}
                  y1={pointA.y}
                  x2={pointB.x}
                  y2={pointB.y}
                  stroke={isWithinTol ? '#22c55e' : '#ef4444'}
                  strokeWidth={3}
                  strokeDasharray="4"
                />
              )}
            </svg>
          </div>

          {/* Live Measurement Result Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '14px',
            padding: '12px 18px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block' }}>
                  VALUE LIVE (MM)
                </span>
                <span style={{ fontSize: '28px', fontWeight: 900, fontFamily: 'var(--font-hud)', color: pointA && pointB ? (isWithinTol ? '#16a34a' : '#dc2626') : '#94a3b8' }}>
                  {pointA && pointB ? `${distanceMm.toFixed(3)} mm` : '--.--- mm'}
                </span>
              </div>

              {pointA && pointB && (
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 900,
                  fontSize: '14px',
                  background: isWithinTol ? '#dcfce7' : '#fee2e2',
                  color: isWithinTol ? '#15803d' : '#b91c1c',
                  border: `1px solid ${isWithinTol ? '#86efac' : '#fca5a5'}`
                }}>
                  {isWithinTol ? 'OK (IN TOLERANCE)' : 'NG (OUT OF TOLERANCE)'}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
              <div>Pixel Jarak: <strong>{distancePx.toFixed(1)} px</strong></div>
              <div>Skala Aktif: <strong>{scaleMmPerPixel} mm/px</strong></div>
              <div>Standar Part: <strong>{minDistanceMm} - {maxDistanceMm} mm</strong></div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="action-btn"
              onClick={() => {
                handleResetPoints();
                onPrevStation();
              }}
            >
              <ChevronLeft size={14} />
              <span>Back (Prev st)</span>
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => {
                handleResetPoints();
                onNextStation();
              }}
            >
              <span>Fwd (Next st)</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="action-btn primary"
              disabled={!pointA || !pointB}
              style={{
                background: pointA && pointB ? '#0284c7' : '#94a3b8',
                cursor: pointA && pointB ? 'pointer' : 'not-allowed',
                fontWeight: 800
              }}
              onClick={() => {
                if (onSaveManualValue && pointA && pointB) {
                  onSaveManualValue({
                    stationId: currentStationId,
                    manualValueMm: Number(distanceMm.toFixed(3)),
                    isOk: isWithinTol
                  });
                }
              }}
            >
              <span>Save Manual Value (Register)</span>
            </button>

            <button type="button" className="action-btn" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
