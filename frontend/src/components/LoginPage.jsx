import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  User,
  CreditCard,
  LogIn,
  Barcode,
  ShieldCheck,
  AlertCircle,
  Target,
  Check,
  ScanLine
} from 'lucide-react';

import { API } from '../apiConfig.js';

export default function LoginPage({ onLoginSuccess, onOpenQrScanner }) {
  const [name, setName] = useState('');
  const [npk, setNpk] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanDetected, setScanDetected] = useState(false);
  const npkInputRef = useRef(null);
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(Date.now());

  // ─── A. AUTO-FOCUS KURSOR PADA FIELD NPK ─────────────────────────────────
  useEffect(() => {
    npkInputRef.current?.focus();
    function handleWindowFocus() {
      npkInputRef.current?.focus();
    }
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

  // ─── B. GLOBAL HARDWARE BARCODE SCANNER INTERCEPTOR ───────────────────────
  // Barcode scanner fisik (USB/Wireless) bekerja sebagai keyboard cepat yang diakhiri Enter.
  // Listener ini menangkap input scanner bahkan jika user tidak sengaja mengklik di luar input box!
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      // Jika operator sedang fokus mengetik di field nama (opsional), biarkan normal
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement !== npkInputRef.current) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Enter menandai submit atau akhir pembacaan barcode dari hardware scanner
      if (e.key === 'Enter') {
        // Prioritaskan nilai input box yang sesungguhnya (baik dari ketikan manual maupun scanner)
        const candidateNpk = (
          npkInputRef.current?.value?.trim() ||
          npk.trim() ||
          barcodeBufferRef.current.trim() ||
          ''
        );
        barcodeBufferRef.current = '';

        if (candidateNpk) {
          e.preventDefault();
          setScanDetected(true);
          setTimeout(() => setScanDetected(false), 1200);
          handleExecuteLogin(candidateNpk, name);
        }
        return;
      }

      // Abaikan tombol navigasi / modifier
      if (e.key.length !== 1) return;

      // Jika user sedang fokus di input NPK:
      // Browser sudah otomatis memasukkan karakter ke input. Bersihkan error saja jika ada.
      if (document.activeElement === npkInputRef.current) {
        if (error) setError('');
        return;
      }

      // Jika fokus berada DI LUAR input NPK (misal klik background lalu scan barcode):
      if (timeDiff > 250) {
        barcodeBufferRef.current = e.key;
        if (error) setError('');
      } else {
        barcodeBufferRef.current += e.key;
      }

      // Kembalikan fokus ke field NPK
      npkInputRef.current?.focus();
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [npk, name, error]);

  async function handleExecuteLogin(targetNpk, targetName = '') {
    const cleanNpk = String(targetNpk || '').trim();
    if (!cleanNpk) {
      setError('Silakan scan Barcode ID Card atau masukkan nomor NPK.');
      setNpk('');
      if (npkInputRef.current) {
        npkInputRef.current.value = '';
        npkInputRef.current.focus();
      }
      return;
    }

    setLoading(true);

    try {
      const resp = await axios.post(`${API}/api/auth/login`, {
        npk: cleanNpk,
        name: String(targetName || '').trim()
      }, { withCredentials: true });

      if (resp.data.ok) {
        onLoginSuccess(resp.data.user, resp.data.token, resp.data.shiftInfo);
      } else {
        setError(resp.data.error || 'Login gagal.');
        setNpk(''); // Kosongkan input seketika agar tidak perlu dihapus manual
        barcodeBufferRef.current = '';
        if (npkInputRef.current) {
          npkInputRef.current.value = '';
          npkInputRef.current.focus();
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      const errMsg = err.response?.data?.error || 'Tidak dapat terhubung ke server backend.';
      setError(errMsg);
      setNpk(''); // Kosongkan input seketika agar tidak perlu dihapus manual
      barcodeBufferRef.current = '';
      if (npkInputRef.current) {
        npkInputRef.current.value = '';
        npkInputRef.current.focus();
      }
    } finally {
      setLoading(false);
      setTimeout(() => {
        npkInputRef.current?.focus();
      }, 50);
    }
  }

  async function handleFormSubmit(e) {
    e?.preventDefault();
    const candidateNpk = (
      npkInputRef.current?.value?.trim() ||
      npk.trim() ||
      barcodeBufferRef.current.trim() ||
      ''
    );
    handleExecuteLogin(candidateNpk, name);
  }

  function handlePreset(presetName, presetNpk) {
    setName(presetName);
    setNpk(presetNpk);
    setError('');
    handleExecuteLogin(presetNpk, presetName);
  }

  return (
    <div className="login-mockup-viewport" onClick={() => npkInputRef.current?.focus()}>
      {/* ── UNIFIED LEFT CONTENT STACK (VERTICALLY CENTERED & BALANCED) ── */}
      <div className="login-left-stack">
        {/* 1. Header Strip: Logo Denso */}
        <div className="login-denso-header-strip">
          <img
            src="/denso_logo.png"
            alt="DENSO Crafting the Core"
            className="login-denso-mini-logo"
          />
        </div>

        {/* 2. Branding Aperture Eye Image 10 Mockup */}
        <div className="aperture-brand-wrap">
          {/* Cyan Bracket Camera Eye Icon */}
          <div className="aperture-icon-box">
            <div className="bracket-corner tl" />
            <div className="bracket-corner tr" />
            <div className="bracket-corner bl" />
            <div className="bracket-corner br" />
            <div className="aperture-eye-outer">
              <div className="aperture-eye-iris">
                <div className="aperture-eye-pupil" />
              </div>
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="aperture-text-box">
            <div className="aperture-title">AI INSPECTION</div>
            <div className="aperture-system-text">S Y S T E M</div>
            <div className="aperture-subline">
              <span>Smart X-Ray Inspection for Quality Assurance</span>
            </div>
          </div>
        </div>

        {/* 3. Floating White Login Card */}
        <div className="mockup-form-card" onClick={(e) => e.stopPropagation()}>
          <form onSubmit={handleFormSubmit} className="mockup-form-body">
            {/* Field NPK (Primary Barcode Scanner Target) */}
            <div className="mockup-input-group">
              <label className="mockup-label" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Barcode size={18} color="#0d9488" strokeWidth={2.4} />
                  <span>BARCODE ID CARD / NPK</span>
                </div>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: scanDetected ? '#047857' : '#0284c7',
                    background: scanDetected ? '#d1fae5' : '#e0f2fe',
                    padding: '3px 9px',
                    borderRadius: '9999px',
                    letterSpacing: '0.3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <ScanLine size={12} />
                  <span>{scanDetected ? 'BARCODE TERBACA ✓' : '⚡ SCANNER READY'}</span>
                </span>
              </label>
              <div className="mockup-input-wrapper">
                <input
                  ref={npkInputRef}
                  type="text"
                  className="mockup-input"
                  placeholder="Dekatkan Barcode ID Card ke scanner atau ketik NPK"
                  value={npk}
                  onChange={(e) => {
                    setNpk(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Field NAMA (Opsional jika scan NPK) */}
            <div className="mockup-input-group">
              <label className="mockup-label">
                <User size={17} color="#0d9488" strokeWidth={2.4} />
                <span>NAMA <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>(Opsional)</span></span>
              </label>
              <div className="mockup-input-wrapper">
                <input
                  type="text"
                  className="mockup-input"
                  placeholder="Otomatis terisi dari database NPK"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                />
              </div>
            </div>

            {/* Error Message jika ada */}
            {error && (
              <div className="mockup-error-banner">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Tombol Gradient MASUK KE SISTEM */}
            <button type="submit" className="mockup-submit-btn" disabled={loading}>
              <LogIn size={20} strokeWidth={2.4} />
              <span>{loading ? 'MEMVERIFIKASI ID CARD...' : 'MASUK KE SISTEM'}</span>
            </button>

            {/* Opsi Tambahan: Scan Barcode & Quick Presets */}
            <div className="mockup-extra-row">
              <button
                type="button"
                className="mockup-qr-action-btn"
                onClick={onOpenQrScanner}
                title="Buka simulator scanner jika tidak memiliki hardware scanner USB"
              >
                <Barcode size={15} />
                <span>Simulator Barcode Scanner</span>
              </button>

              <div className="mockup-quick-presets">
                <span className="mockup-quick-label">Quick:</span>
                <button
                  type="button"
                  className="mockup-quick-chip"
                  onClick={() => handlePreset('Budi Santoso', '1092')}
                >
                  Operator
                </button>
                <button
                  type="button"
                  className="mockup-quick-chip"
                  onClick={() => handlePreset('Sugimoto-san', '8021')}
                >
                  Leader
                </button>
                <button
                  type="button"
                  className="mockup-quick-chip"
                  onClick={() => handlePreset('Admin PE', 'ADM001')}
                >
                  Admin
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 4. Bottom Footer: Quality First, Always */}
        <div className="mockup-footer-badge">
          <div className="mockup-shield-box">
            <ShieldCheck size={26} color="#059669" strokeWidth={2.2} />
          </div>
          <div className="mockup-footer-texts">
            <span className="mockup-footer-bold">Quality First, Always.</span>
            <span className="mockup-footer-sub">
              AI Technology • Accurate Inspection • Reliable Results
            </span>
          </div>
        </div>
      </div>

      {/* ── TOP RIGHT HUD OVERLAY (PERSIS SEPERTI DI IMAGE 10) ── */}
      <div className="mockup-hud-top-right">
        <div className="hud-title-row">
          <Target size={22} color="#0284c7" strokeWidth={2.5} />
          <span className="hud-title-text">X-RAY INSPECTION</span>
        </div>
        <div className="hud-stat-line">
          <span className="hud-stat-name">PASS RATE</span>
          <span className="hud-stat-pct">98.6%</span>
        </div>
        <div className="hud-stat-line">
          <span className="hud-stat-name">DETECTION</span>
          <span className="hud-stat-judge">OK</span>
        </div>
      </div>

      {/* ── BOTTOM RIGHT RADAR SCANNER OVERLAY ── */}
      <div className="mockup-hud-bottom-right">
        <div className="hud-radar-disc">
          <div className="radar-sweep-wave" />
          <div className="radar-focus-brackets">
            <div className="bracket tl" />
            <div className="bracket tr" />
            <div className="bracket bl" />
            <div className="bracket br" />
            <Check size={24} color="#10b981" strokeWidth={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
