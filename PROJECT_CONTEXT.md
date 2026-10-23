# Project Context & AI Guidelines: AI X-Ray Inspection System (PT. Denso Indonesia)

## 📌 Ringkasan Proyek
Proyek ini adalah sistem inspeksi visual berbasis AI untuk pembacaan citra X-Ray pada lini produksi PT. Denso Indonesia. Sistem melakukan pengukuran dimensi kritis (Point A ke Point B) dengan toleransi spesifikasi 0.89 mm - 1.61 mm (OK/NG judgment).

---

## 🏗️ Arsitektur Sistem Saat Ini (aixray-clean)
1. **Backend (Node.js Express)**:
   - Berjalan di port `5000` (`backend/server.js`).
   - Mengontrol workflow, API frontend, dan otomatis menjalankan Python sidecar.
2. **FastAPI Sidecar (Python Inference Server)**:
   - Berjalan persisten di port `5001` (`backend/python/inference_server.py`).
   - Model YOLOv8x-Pose (`backend/models/best.pt`) dimuat SEKALI ke RAM saat startup untuk performa inferensi cepat (< 1 detik).
   - Pengukuran aktual dilakukan oleh modul `backend/python/auto_anchor_measure.py`.
3. **Frontend (React + Vite)**:
   - Berjalan di port `5173` (`frontend/`).
   - Menampilkan hasil inspeksi, overlay citra, status inferensi cepat (Fast Mode Ready), dan status OK/NG.
4. **Kalibrasi & Pengukuran**:
   - Skala kalibrasi pin gauge: `0.02185 mm/px` (`jig_measure.py`).
   - Mode input model AI: `full_raw` (jangan diubah ke crop untuk menjaga akurasi deteksi keypoint).

---

## 🎯 Dokumen Referensi Kebutuhan Klien
- **Spesifikasi Lengkap**: `general-req-aixray.docx` (DX Requirement Sheet PT. Denso Indonesia).
- **Laporan Retraining AI**: `LAPORAN_LENGKAP_RETRAINING_AI_XRAY_DENSO_PHASE4.md`.

---

## 🗺️ Roadmap Pengembangan & Status
- **Fase AI Core & Optimasi Inferensi**: Selesai ✅ (Model Retrained Phase 4 + FastAPI Persistent Sidecar).
- **Pembersihan Workspace**: Selesai ✅ (Folder `aixray-clean` siap mandiri).

### 🚀 TAHAP AKTIF SELANJUTNYA: 🟥 FASE 1 — Foundation (Wajib)
Target implementasi:
1. **Sistem Role & Auth**:
   - Role: `Operator`, `Leader` (TL), `Admin`.
   - Autentikasi JWT / session di Express.
2. **Halaman Login UI**:
   - Form input Nama + NPK.
   - Scan QR code login (kompatibel barcode/QR scanner barcode reader).
3. **Auto-Logout Shift**:
   - Otomatis logout pada pergantian shift (pukul `07:00` dan `20:30`).
4. **Dashboard Layout & Role-Based Sidebar**:
   - Navigasi modular (Inspection, Calibration, History, Settings).
   - Visibilitas menu sesuai hak akses Role.

---

## 💡 Instruksi untuk Asisten AI Baru
Ketika user memberikan instruksi di workspace ini, langsung lanjutkan dari status di atas. Fokus utama saat ini adalah mengeksekusi **FASE 1 (Foundation)** dengan standar UI/UX modern, rapi, dan sesuai kebutuhan PT. Denso Indonesia.