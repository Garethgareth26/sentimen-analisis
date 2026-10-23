# 📋 DOKUMEN STATUS SISTEM, RANGKUMAN PERUBAHAN & ROADMAP PENGEMBANGAN
# SISTEM AI X-RAY AUTO MEASUREMENT (PT. DENSO INDONESIA — 3RD FACTORY)

> **Lokasi Sistem:** Section QA / PED, Line X-Ray, PT. Denso Indonesia, 3rd Factory (MM2100 Cikarang Barat)  
> **Direktori Workspace:** `C:\Users\LENOVO\Downloads\aixray-clean`  
> **Tanggal Pembaruan:** 16 Oktober 2026  
> **Status Operasional:** ✅ **PRODUCTION READY & VERIFIED** (4-Keypoint + 15 Pockets + Master Role Login)

---

## 📌 1. Apa Saja yang Berubah (Rangkuman Perubahan Terkini)

Pada sesi pengembangan terbaru, sistem telah mengalami penyesuaian besar untuk menyelaraskan algoritma AI dan antarmuka operasional dengan kondisi fisik mesin X-Ray di line produksi Denso:

### A. Migrasi Engine AI: 2-Keypoint ➔ 4-Keypoint (4KP)
Sistem inspeksi AI ditingkatkan secara penuh dari pendeteksian 2 titik (hanya gap IC) menjadi **4 titik simultan (4KP)** dengan evaluasi 3 parameter kualitas mutu:
1. **Gap IC Tip ke Datum (`gap_mm`)**: Standar toleransi `0.70 mm – 1.70 mm`.
2. **Ketebalan Bodi Resin Atas (`upper_resin_mm`)**: Standar toleransi `≥ 0.20 mm`.
3. **Ketebalan Bodi Resin Bawah (`lower_resin_mm`)**: Standar toleransi `≥ 0.20 mm`.
- **Kaidah Judgement Denso**: Jika salah satu dari ketiga parameter di atas berada di luar standar, stasiun dinyatakan **NG** (`OK` hanya jika ketiganya memenuhi syarat).
- **Perbaikan Geometri (Anti-Garis Miring)**: Menerapkan `force_vertical_line` di mana sumbu X titik resin atas ($K_3$) dan bawah ($K_4$) dikunci tegak lurus sama persis dengan sumbu X titik Datum ($K_2$).
- **Deteksi Tepi Luar Resin**: Algoritma `find_outer_resin_edge` menggunakan metode *First Significant Gradient* untuk mengukur ketebalan resin sampai ke kontur luar bodi tanpa terdistorsi noise.
- **Kecepatan Inferensi**: Model YOLOv8x-pose berjalan di FastAPI sidecar dengan kecepatan **~0.67 detik per citra** (jauh lebih cepat dari batas target Cycle Time `1.2 detik`).

---

### B. Penyesuaian Kapasitas Grid Tray: 18 Stasiun ➔ 15 Stasiun Aktual
- **Kondisi Mesin Lapangan**: Rotary indexing jig mesin X-Ray Denso memiliki kapasitas **15 pocket part aktual (`st1` s/d `st15`)**, bukan 18 pocket.
- **Tampilan Antarmuka**: Grid di panel kiri dashboard diubah menjadi **15 pocket kartu** yang tersusun rapi dalam format **3 baris x 5 kolom**:
  - Baris 1: `st1`, `st2`, `st3`, `st4`, `st5`
  - Baris 2: `st6`, `st7`, `st8`, `st9`, `st10`
  - Baris 3: `st11`, `st12`, `st13`, `st14`, `st15`
- **Sinkronisasi Backend**: Service `tray.service.js` dan controller `tray.controller.js` telah disesuaikan untuk mengelola sekuens 15 gambar per batch tray.

---

### C. Logika Pengecualian Frame ke-16 (Frame Reset / Blur — Anti False NG)
- **Karakteristik Kamera Mesin**: Kamera capture mesin mengambil 16 frame per rotasi tray. Frame ke-16 adalah **frame kosong/blur** (tanpa part dan tanpa jig) yang berfungsi sebagai penanda mekanis akhir tray.
- **Logika AI Ignored**: Frame ke-16 dideteksi otomatis (`isResetFrame: true`, `judge: 'RESET'`) dan **dikecualikan dari inferensi YOLO**, sehingga tidak akan pernah memicu alarm False NG.
- **Filter Metrik & Log**: Frame ke-16 tidak dihitung ke dalam counter produk harian (Total/OK/NG) dan tidak dicatat ke dalam file CSV part harian.
- **Reset Siklus**: Sinyal frame ke-16 otomatis mereset siklus pembacaan stasiun kembali ke `st1` untuk tray berikutnya.

---

### D. Penghapusan Fitur Pengukuran Manual (Manual Measurement) di Layar
- **Kesesuaian SOP Pabrik**: Di line produksi, jika suatu part terindikasi NG dan membutuhkan pengukuran ulang manual, operator/leader **mengeluarkan (*eject*) part fisik tersebut dari mesin** dan mengukurnya menggunakan alat ukur fisik di luar mesin (pin gauge/mikrometer bersertifikat), bukan menarik garis di monitor aplikasi.
- **Pembersihan UI**:
  - Tombol *Manual Measurement* dihapus dari panel kontrol samping (`ControlPanel.jsx`).
  - Modal canvas ukur garis manual (`ManualMeasureModal.jsx`) dinonaktifkan dari alur kerja utama (`App.jsx`).
  - Menu aksi Team Leader pada pop-up Alarm Interlock (`AlarmInterlockModal.jsx`) disederhanakan menjadi 2 opsi jelas:
    1. **`1. Re-measure / Inferensi Ulang AI (stX)`**: Untuk memastikan kembali hasil inferensi kamera.
    2. **`2. Eject Part NG (Cek Manual Fisik di Luar) & Rilis Interlock`**: Part cacat dikeluarkan fisik dari mesin, lalu interlock dilepaskan agar line produksi kembali jalan.

---

### E. Penegasan Konsep Login "Master Role Terkunci" (Tanpa Menu Registrasi di Admin)
- **Konsep Keamanan Industri**: Sistem inspeksi kualitas pabrik tidak mengizinkan pendaftaran akun bebas di layar. Data karyawan yang berwenang sudah paten dan resmi.
- **Pembersihan Pengaturan**: Tab *"Kelola Karyawan / Registrasi User"* di modal Pengaturan (`SettingsModal.jsx`) telah dihapus. Menu Pengaturan kini bersih, hanya memuat konfigurasi teknis mesin (Penyimpanan Citra, I/O PLC, Program Files YOLO, dan Toleransi).
- **Master Role Tetap**: Sistem login mengacu pada file master resmi `backend/src/config/users.json`:
  - **Operator** (`1092` - Budi Santoso, `1093` - Ahmad Fauzi, `00 0000000002` - Azril Prau): Operasi normal & kalibrasi shift pagi.
  - **Team Leader / TL** (`8021` - Sugimoto-san, `8022` - Hendra Wijaya): Otoritas reset alarm interlock NG via Scan QR/Barcode kartu.
  - **Admin PE** (`9999` / `ADM001` - Admin PE): Akses penuh membuka menu Setting.
- **Fitur Hardware Barcode**: Input NPK siap menerima tembakan barcode scanner fisik kapan saja (auto-focus, auto-reset kolom input jika salah scan, dan toleransi format barcode dengan spasi).

---

## 📁 2. Matriks File yang Berubah & Status Terkini

| File Komponen | Lokasi File | Perubahan yang Diterapkan | Status |
|---|---|---|---|
| **Model YOLO 4KP** | `backend/models/best.pt` | Model YOLOv8x-pose 4-Keypoint (`best.pt.bak` tersimpan aman) | ✅ Aktif di RAM |
| **Python Core 4KP** | `backend/python/auto_anchor_measure.py` | Algoritma geometri 4KP, force vertical, snap outer resin edge | ✅ Terverifikasi |
| **FastAPI Sidecar** | `backend/python/inference_server.py` | Endpoint `/process` 4KP responsif dengan output 3 parameter | ✅ Port 5001 Online |
| **Konfigurasi Sistem** | `backend/config.json` & `config_runtime.json` | Parameter standar resin (`min_resin_upper_mm`, `min_resin_lower_mm`, flag AI) | ✅ Sinkron |
| **Service Tray** | `backend/src/services/tray.service.js` | Kapasitas 15 stasiun, evaluasi 3 parameter dinamis, logika ignore frame 16 | ✅ Terverifikasi |
| **Controller Tray** | `backend/src/controllers/tray.controller.js` | Endpoint `next-sequence` menghasilkan 15 citra unik | ✅ Terverifikasi |
| **Styling CSS Grid** | `frontend/src/style.css` | `.grid-pockets` diubah menjadi `repeat(5, 1fr)` (3 baris x 5 kolom) | ✅ Rapi & Simetris |
| **Grid Component** | `frontend/src/components/PocketGrid.jsx` | Header judul diperbarui menjadi 15 Pockets | ✅ Terverifikasi |
| **Control Panel** | `frontend/src/components/ControlPanel.jsx` | 3 kartu metrik inspeksi live (Gap, Resin Atas, Resin Bawah), tombol manual measure dihapus | ✅ Terverifikasi |
| **Alarm Interlock** | `frontend/src/components/AlarmInterlockModal.jsx` | Aksi disederhanakan: Re-measure vs Eject Part NG & Rilis Interlock | ✅ Sesuai SOP Denso |
| **Modal Pengaturan** | `frontend/src/components/SettingsModal.jsx` | Tab registrasi karyawan dibersihkan, fokus setting teknis | ✅ Bersih |
| **App Utama** | `frontend/src/App.jsx` | State 15 pocket, deteksi frame 16 reset, pembersihan modal manual measure | ✅ Build Sukses |

---

## 🗺️ 3. Roadmap Pengembangan Kedepannya (Apa yang Dilakukan Lagi)

Berikut adalah daftar rencana pengembangan berikutnya yang diurutkan berdasarkan skala prioritas implementasi:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   ROADMAP PENGEMBANGAN AI X-RAY DENSO                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1. FITUR DANDORI KANBAN DINAMIS (Master Part Lokal JSON) ── [Prioritas 1]        │
│ 2. FOLDER IMAGE WATCHER OTOMATIS (Auto-Trigger Tray) ───── [Prioritas 2]        │
│ 3. MODUL AI LEARNING UNTUK PE (Review & Retraining) ─────── [Prioritas 3]        │
│ 4. INTEGRASI PLC HARDWARE INTERLOCK (RS-485 Modbus) ─────── [Prioritas 4]        │
│ 5. CENTRAL HYBRID DATABASE (Sync SQL Server & Auto-Cleaner) [Prioritas 5]        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 🎯 PRIORITAS 1: Fitur Dandori Kanban Dinamis (Master Part Lokal JSON)
*Status: Ditunda sementara, siap dieksekusi berikutnya.*
- **Tujuan**: Memungkinkan Admin/PE mendaftarkan varian Part Number (P/N) baru dan batas toleransinya langsung dari antarmuka Web UI tanpa menyentuh source code program (Anti-Hardcoding).
- **Rencana Teknis**:
  1. Buat file master database lokal `backend/src/config/parts.json`:
     ```json
     [
       {
         "part_number": "DN-XRAY-42890-A",
         "part_name": "Fuel Rail IC Housing (Standard)",
         "min_distance_mm": 0.70,
         "max_distance_mm": 1.70,
         "min_resin_upper_mm": 0.20,
         "min_resin_lower_mm": 0.20,
         "jig_offset_mm": 0.063,
         "ct_target_sec": 1.2
       }
     ]
     ```
  2. Buat REST API CRUD (`GET`, `POST`, `PUT`, `DELETE`, `/activate`) di `dandori.service.js` dengan validasi Zod.
  3. Tambahkan tab *"Kelola Part (Dandori)"* di menu Setting untuk melihat tabel daftar part, tombol tambah part baru, dan tombol set aktif.
  4. Pasang parser Kanban fleksibel sehingga ketika kartu Kanban fisik Denso ditembak barcode scanner, sistem langsung mengenali P/N dan mengunci toleransi yang sesuai.

---

### 🎯 PRIORITAS 2: Folder Image Watcher Otomatis (Auto-Trigger Tray Inspection)
- **Tujuan**: Mengotomasi proses inspeksi tanpa perlu operator menekan tombol *"Jalankan Tray"* di layar.
- **Rencana Teknis**:
  1. Pasang background file watcher pada direktori input gambar hasil capture mesin X-Ray.
  2. Saat kamera mesin selesai menjatuhkan 15 citra stasiun (`st1` s/d `st15`) dan disusul citra ke-16 (frame reset/blur), background service otomatis memicu inspeksi batch 1 tray penuh secara paralel.
  3. Hasil inspeksi ke-15 stasiun langsung tampil serentak di layar dalam hitungan ~1-2 detik.

---

### 🎯 PRIORITAS 3: Modul AI Learning untuk Tim Process Engineer (PE)
- **Tujuan**: Sarana evaluasi model AI jika ditemukan kasus anomali (False NG atau False OK) di line produksi.
- **Rencana Teknis**:
  1. Akses modul AI Learning dilindungi otorisasi scan ID card khusus tim PE/Admin.
  2. Viewer history citra dengan kemampuan menampilkan overlay keypoint prediksi AI vs ground truth.
  3. Tool koreksi titik manual (re-annotation 4 keypoint) di canvas browser.
  4. Tombol export dataset terstandarisasi format Ultralytics YOLO pose (`images/` & `labels/`) untuk siklus retraining model AI berikutnya.

---

### 🎯 PRIORITAS 4: Integrasi PLC Hardware Interlock (RS-485 Modbus / Relay Out)
- **Tujuan**: Menghentikan konveyor mesin fisik secara elektrik saat terdeteksi part NG (*Full POKAYOKE Assurance*).
- **Rencana Teknis**:
  1. Konfigurasi port serial RS-485 Modbus RTU (contoh: `COM3`, Address `Y001 / Relay Out #1`) yang sudah disiapkan di `config.json`.
  2. Saat terjadi part NG, backend mengirim sinyal relay HIGH untuk memutus sirkuit interlock mesin (konveyor berhenti).
  3. Mesin fisik hanya bisa berjalan kembali setelah Team Leader melakukan scan QR otorisasi di layar sistem untuk melepas interlock (*Release Interlock*).

---

### 🎯 PRIORITAS 5: Integrasi Hybrid Database (SQL Server Denso & Local Auto-Cleaner)
- **Tujuan**: Menghubungkan data PC mesin ke server pusat QA/PED pabrik dan mencegah hard disk PC line penuh.
- **Rencana Teknis**:
  1. Implementasi koneksi database `mssql` standar DNIA DX Starter Kit ke SQL Server QA pabrik.
  2. Auto-sync data header tray (`t_inspection_trays`) dan detail pengukuran 15 stasiun (`t_inspection_details`).
  3. Local Storage Auto-Cleaner: Background cron service yang otomatis membersihkan citra part OK yang berumur lebih dari 14 hari, sementara citra NG dan file CSV harian tetap disimpan permanen sebagai bukti mutu traceability.

---

## 🚀 4. Cara Menjalankan & Mengoperasikan Sistem

### Langkah 1: Menjalankan Backend & AI Sidecar
Buka folder `C:\Users\LENOVO\Downloads\aixray-clean`, lalu jalankan:
```cmd
start_backend.bat
```
Script ini akan menginisialisasi:
- Lingkungan Conda `ai_vision` (`C:\Users\LENOVO\AppData\Local\anaconda3\envs\ai_vision\python.exe`)
- **FastAPI Inference Server (Port 5001)** — Memuat model `models/best.pt` ke RAM.
- **Node.js Express Server (Port 5000)** — Menangani API bisnis, shift scheduler, dan logging.

### Langkah 2: Menjalankan Antarmuka Web (Frontend)
Jalankan file:
```cmd
start_frontend.bat
```
Aplikasi antarmuka akan berjalan di browser pada alamat:
`http://localhost:5173`

### Langkah 3: Login ke Sistem
Gunakan salah satu NPK resmi yang terdaftar di Master Role:
- **Operator**: Tembak barcode kartu atau ketik `1092` (Budi Santoso) / `1093` (Ahmad Fauzi) / `00 0000000002` (Azril Prau).
- **Team Leader (TL)**: Ketik/Scan `8021` (Sugimoto-san) atau `8022` (Hendra Wijaya).
- **Admin**: Ketik `9999` atau `ADM001` (Admin PE).

---

*Dokumen ini merupakan Single Source of Truth (SSOT) mutakhir sebagai panduan pengembangan dan handover operasional sistem AI X-Ray PT. Denso Indonesia.*

Penyebab hasil pengukuran 1.687 mm dinyatakan NG adalah karena adanya parameter jig_offset_mm (Safety Margin Kompensasi Jig) sebesar 0.063 mm di konfigurasi sistem (

config.json
).

🔍 Perhitungan di Balik Sistem:
Sesuai rumus standar di 

inference_server.py
:

$$\text{Batas Bawah Efektif} = \text{Min} + \text{Jig Offset} = 0.700 + 0.063 = \mathbf{0.763\text{ mm}}$$ $$\text{Batas Atas Efektif} = \text{Max} - \text{Jig Offset} = 1.700 - 0.063 = \mathbf{1.637\text{ mm}}$$

Nilai Pengukuran Aktual: 1.687 mm
Batas Atas Efektif: 1.637 mm
Karena $1.687\text{ mm} > 1.637\text{ mm}$, AI mengevaluasinya melewati batas atas aman toleransi sehingga menghasilkan status NG.

Di layar atas kartu hanya menampilkan teks standar gambar tekniknya (Std: 0.7 - 1.7 mm), sehingga terlihat membingungkan seolah-olah 1.687 masih di bawah 1.7.

⚙️ Pilihan Solusi yang Bisa Diambil:
Opsi A (Jika Murni Mengikuti 0.70 – 1.70 mm Tanpa Offset):

Kita ubah jig_offset_mm menjadi 0 di config.json dan config_runtime.json.
Hasilnya: Batas atas menjadi 1.700 mm, dan part 1.687 mm ini akan langsung bernilai OK.
Opsi B (Jika Offset 0.063 mm Tetap Diperlukan Sesuai Standar Denso):

Nilai 0.063 mm tetap dipertahankan.
Kita perjelas teks di kartu antarmuka UI Dashboard menjadi:
Std: 0.70 - 1.70 mm (Efektif: 0.763 - 1.637 mm) agar operator langsung paham kenapa 1.687 mm dinyatakan NG.
Mau diterapkan Opsi A (ubah offset jadi 0 agar batasnya murni 1.7 mm) atau Opsi B?

3:44 PM
