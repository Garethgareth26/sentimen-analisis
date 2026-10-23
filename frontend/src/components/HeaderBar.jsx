import React, { useState, useEffect } from 'react';
import { Settings, LogOut, Sun, Moon, Clock } from 'lucide-react';

export default function HeaderBar({ user, shiftInfo, partNumber, onOpenSettings, onLogout, onOpenDandori }) {
  const [liveTime, setLiveTime] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('id-ID', { hour12: false }));
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const isDay = shiftInfo?.isDayShift ?? true;
  const role = user?.role || 'operator';

  return (
    <header className="header-bar">
      <div className="header-left">
        <img
          src="/denso_logo.png"
          alt="DENSO Crafting the Core"
          className="denso-logo-img"
        />
        <div className="header-brand-divider" />
        <div>
          <span className="app-title-text">AI X-RAY AUTO MEASUREMENT</span>
        </div>
      </div>

      <div className="header-right">
        {/* Operator Info */}
        <div className="header-stat-chip">
          <span className="header-stat-label">Operator</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="header-stat-value">{user?.name || 'Operator'} ({user?.npk || '-'})</span>
            <span className={`role-tag ${role}`}>{role.toUpperCase()}</span>
          </div>
        </div>

        {/* Shift Badge */}
        <div className={`shift-badge ${isDay ? 'day' : 'night'}`}>
          {isDay ? <Sun size={14} /> : <Moon size={14} />}
          <span>{shiftInfo?.currentShift || (isDay ? 'Day Shift' : 'Night Shift')}</span>
        </div>

        {/* Real-time Clock */}
        <div className="header-stat-chip">
          <span className="header-stat-label">Date & Time</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} color="#64748b" />
            <span className="header-stat-value">{liveTime || shiftInfo?.currentTime || '--:--:--'}</span>
          </div>
        </div>

        {/* Active Part Number with Dandori Changeover Action */}
        <div
          className="header-stat-chip"
          style={{ cursor: 'pointer', transition: 'all 0.2s' }}
          onClick={onOpenDandori}
          title="Klik untuk Dandori / Changeover P/N via QR Kanban"
        >
          <span className="header-stat-label">Part Number (Dandori)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="header-stat-value" style={{ color: '#0284c7' }}>
              {partNumber || 'DN-XRAY-42890-A'}
            </span>
            <span style={{
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 800
            }}>
              SCAN QR
            </span>
          </div>
        </div>

        {/* Setting Button (Admin / TL) */}
        {(role === 'admin' || role === 'tl') && (
          <button
            type="button"
            className="header-action-btn"
            title="Pengaturan Sistem"
            onClick={onOpenSettings}
          >
            <Settings size={18} />
          </button>
        )}

        {/* Logout Button */}
        <button
          type="button"
          className="header-action-btn logout"
          title="Keluar / Logout"
          onClick={onLogout}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
