# 📋 DOKUMEN MASTER KONTEKS, STANDAR DNIA DX & ROADMAP PENGEMBANGAN
# SISTEM AI X-RAY AUTO MEASUREMENT (PT. DENSO INDONESIA - 3RD FACTORY)
*Status Dokumen: Acuan Tetap & Living Roadmap*  
*Lokasi Proyek: Section QA / PED, Line X-Ray, PT. Denso Indonesia, 3rd Factory (MM2100 Cikarang Barat)*  
*Tanggal Pembaruan: 12 Oktober 2026*

---

## ⚡ 0. PROMPT LANJUTAN (COPY-PASTE READY UNTUK SESI BERIKUTNYA)

> **PETUNJUK PENGGUNA:**  
> Jika laptop dimatikan, session terputus, atau ingin melanjutkan proyek di kemudian hari, **cukup salin (copy) teks di dalam kotak di bawah ini** dan kirimkan langsung di chat. AI akan langsung memahami seluruh riwayat, standar DNIA DX, dan melanjutkan eksekusi tanpa perlu menjelaskan ulang dari awal!

### 🟢 0.A. PROMPT UMUM KELANJUTAN PROYEK (FULL CONTEXT & ROADMAP)
```markdown
Halo AI, tolong lanjutkan pengembangan proyek AI X-Ray Auto Measurement PT. Denso Indonesia.
Seluruh konteks lengkap, standar DNIA DX Starter Kit Vol 1-3, insight lapangan mesin X-Ray, skema SQL Server, dan daftar modul tersimpan di file:
`NOTULEN_DAN_ROADMAP_PENGEMBANGAN_AI_XRAY.md` dan `DEVELOPMENT_PROGRESS_AND_STANDARD.md`.

Kondisi Terkini:
1. Autentikasi Login (Nama/NPK & Barcode ID Card) selesai 100%. Auto-logout pergantian shift (07:00 & 20:30) aktif.
2. Inisialisasi shift bersih (Counter Total: 0, OK: 0, NG: 0, CT: 0.00s, CSV harian bersih tanpa seed mock palsu).
3. Live AI Inference YOLOv8x-pose berjalan 100% nyata saku demi saku menggunakan rotasi kumpulan 128+ dataset gambar X-Ray aktual di folder `backend/input/`. Evaluasi toleransi OK/NG dinamis real-time.
4. Logo Denso diperbesar dan badge teks MM2100 yang mengganggu telah dibersihkan dari Login dan HeaderBar.
5. Sinkronisasi 2 arah antara Dandori Kanban dan Pengaturan Sistem aktif di `config.json` dan runtime.

Target & Rencana Langkah Selanjutnya (Prioritas Utama):
1. **Fitur UI "Kelola Part Number (Dandori Kanban)" di Modal Pengaturan Sistem:**
   - Antarmuka manajemen Master Part Number untuk Admin/PE Denso tanpa perlu hardcoding di program.
   - Form input & edit: Part Number (P/N), Nama Part, Batas Min mm, Batas Max mm, Jig Offset mm, Target CT (detik).
   - Penyimpanan persisten ke database `backend/src/config/parts.json`.
   - Backend RESTful API CRUD (`GET`, `POST`, `PUT`, `DELETE` di `/api/dandori/parts`) dengan validasi Zod.
   - Fleksibilitas Parser Kanban: Begitu nomor part terdaftar di `parts.json`, scan QR Kanban fisik Denso langsung mengunci part dan toleransinya secara otomatis.
2. **Perbaikan Total Modal Manual Measurement:**
   - Transformasi koordinat presisi pixel asli (`naturalWidth / clientWidth`), scroll-wheel zoom, pan & drag, magnifying loupe kaca pembesar.
3. **Penyesuaian UI Grid Stasiun & Batch Tray (15 Station aktual + ignore frame 16 reset).**
4. **Fitur AI Learning PE & Integrasi Hybrid Database SQL Server DNIA DX.**

Tolong baca dokumen `NOTULEN_DAN_ROADMAP_PENGEMBANGAN_AI_XRAY.md` dan jalankan eksekusi fitur prioritas yang ditugaskan!
```

### 🎯 0.B. PROMPT KHUSUS EKSEKUSI SIAP PAKAI: FITUR KELOLA PART DANDORI (ANTI-HARDCODE)
```markdown
Halo AI, tolong kerjakan dan selesaikan fitur "Kelola Part Number (Dandori Kanban)" secara tuntas (Full Stack End-to-End) untuk aplikasi AI X-Ray Auto Measurement PT. Denso Indonesia.

Spesifikasi & Rencana Teknis:
1. Backend Database:
   - Buat file `backend/src/config/parts.json` sebagai database master part Denso (DN-XRAY-42890-A, DN-XRAY-42890-B, 28438-51001, 197400-0010, dll).
2. Backend REST API (Standar DNIA DX Layered MVC):
   - Buat skema Zod validator `backend/src/validators/dandori.validator.js`.
   - Refactor `backend/src/services/dandori.service.js`: hilangkan array in-memory `MASTER_PARTS` hardcode, baca/tulis langsung ke `parts.json`, sertakan helper aktivasi part dan sinkronisasi 2 arah ke `config.json` & `config_runtime.json`.
   - Update `backend/src/controllers/dandori.controller.js` dan `backend/src/routes/dandori.routes.js` untuk endpoint CRUD:
     * GET /api/dandori/parts (Ambil daftar part)
     * POST /api/dandori/parts (Tambah part baru)
     * PUT /api/dandori/parts/:partNumber (Update part)
     * DELETE /api/dandori/parts/:partNumber (Hapus part dengan proteksi part aktif)
     * POST /api/dandori/parts/:partNumber/activate (Jadikan part aktif)
     * POST /api/dandori/scan (Scan barcode/QR kanban fleksibel dinamis)
3. Frontend UI di `frontend/src/components/SettingsModal.jsx`:
   - Tambah tab "Kelola Part (Dandori)" di sidebar modal pengaturan.
   - Tampilkan tabel daftar part master: Kolom P/N, Nama Part, Toleransi (Min - Max mm), Offset, Target CT, Status Aktif, dan Aksi.
   - Sediakan tombol "+ Tambah Part Baru" dengan form modal (Part Number, Nama Part, Min mm, Max mm, Offset mm, Target CT).
   - Sediakan tombol Aksi: "Set Aktif", "Edit", dan "Hapus" (dengan konfirmasi).
   - Hubungkan aksi aktivasi dan scan kanban agar langsung mengupdate state aktif di `App.jsx` dan tampilan dashboard secara live.
4. Lakukan pengujian end-to-end: penambahan part baru, ubah toleransi, set aktif, dan verifikasi apakah toleransi langsung diterapkan pada evaluasi AI di dashboard!

Silakan baca detail arsitekturnya di Section 5.D dokumen `NOTULEN_DAN_ROADMAP_PENGEMBANGAN_AI_XRAY.md` dan langsung jalankan eksekusinya!
```

---

## 📌 1. Rangkuman Status Sistem Terkini (Sudah Selesai & Terverifikasi)

### A. Fitur Login & Autentikasi Barcode Karyawan
1. **Auto-Reset / Kosongkan Kolom saat Gagal:**
   - Ketika scan kartu atau ketikan NPK salah/tidak terdaftar, banner merah tampil dan kolom input NPK **langsung otomatis dikosongkan (`setNpk('')`)**.
   - Operator **tidak perlu menekan Backspace/Delete manual** untuk scan ulang.
2. **Kursor Siap Selalu (Auto-Focus & Non-Disabled):**
   - Kolom NPK tidak di-`disabled` saat verifikasi login agar kursor browser tidak lepas (*blur*). Scanner barcode dapat ditembakkan berkali-kali tanpa bantuan mouse.
3. **Penyelesaian Konflik Ketikan Manual vs Scanner Buffer:**
   - Sistem memprioritaskan teks utuh di input box (`npkInputRef.current.value` & `npk.trim()`), baik diketik manual dengan keyboard maupun ditembak dengan barcode scanner.
   - Kolom Nama **100% opsional**: Cukup scan NPK saja, sistem otomatis menarik nama resmi dari database.
4. **Toleransi Spasi Barcode ID Card:**
   - Backend `auth.service.js` mendukung pencocokan NPK fleksibel dengan/tanpa spasi (`replace(/\s+/g, '')`), sehingga nomor kartu fisik panjang ber-spasi (seperti `00 0000000002`) langsung cocok dengan data master.
5. **Manajemen Master Karyawan:**
   - Tersimpan di [`backend/src/config/users.json`](file:///c:/Users/LENOVO/Downloads/aixray-clean/backend/src/config/users.json) dan dapat dikelola langsung via antarmuka Admin di menu **Setting ➔ Kelola Karyawan**.

---

## 🏭 2. Insight Lapangan Terverifikasi (Line Produksi X-Ray Denso)

| Parameter Mesin | Spesifikasi Aktual Lapangan | Implikasi Teknis & Logika Sistem |
|---|---|---|
| **Kecepatan Capture** | **1 frame per 2 detik** | Mesin rotary indexing jig bergerak stasiun demi stasiun. |
| **Kapasitas 1 Tray** | **15 Station Aktual** (`st1` s/d `st15`) | Grid di UI Dashboard panel kiri diubah dari 18 pocket menjadi **15 pocket**. |
| **Frame ke-16 (Reset)** | **Frame Blur / Kosong (Tanpa Part & Jig)** | Sinyal visual akhir tray untuk mereset posisi kembali ke stasiun 1. **Wajib di-ignore dari analisis AI agar tidak memicu False NG**. |
| **Metode Analisis** | **Batch per 1 Tray Lengkap** | Sistem **tidak** menganalisis gambar satu per satu, melainkan menunggu ke-15 citra stasiun terkumpul, lalu menganalisis seluruh 15 gambar secara serentak (< 1-2 detik total). |
| **Format Nama File** | `xray_line_tanggal_waktusampaideti k_stationberapanya` | Contoh: `xray_line3_20261012_153022_st1.png`. Memudahkan regex backend mengekstrak nomor stasiun, line, dan timestamp. |

---

## 🏛️ 3. Kepatuhan Standar Baku DNIA DX Development Starter Kit

Seluruh pengembangan wajib mematuhi standar **DNIA DX Starter Kit (Vol 1 Backend, Vol 2 Frontend, Vol 3 Full Stack)**:

### A. Simetri Arsitektur Berlapis (Layered MVC)
$$\text{Route} \longrightarrow \text{Middleware} \longrightarrow \text{Zod Validation} \longrightarrow \text{req.validated} \longrightarrow \text{Controller} \longrightarrow \text{Service} \longrightarrow \text{Model / Database}$$
- **Controller:** Hanya menangani HTTP Request/Response. **Dilarang keras menyematkan query SQL atau logika AI di Controller.**
- **Service:** Pusat *business logic*, toleransi Denso, evaluasi OK/NG, dan pemanggilan AI sidecar.
- **Validasi Zod:** Seluruh input dari client divalidasi ketat di backend menggunakan skema Zod sebelum masuk ke Controller.
- **Frontend MVC:** Folder tersusun per-fitur (`src/features/<feature>/[view | controller | model]`). Komponen View dilarang menembak API mentah secara langsung.

### B. Standar Query & Database Lifecycle DNIA DX
1. **Konvensi Penamaan Tabel & Kolom:**
   - Tabel Master: Wajib berawalan `m_` (contoh: `m_users`, `m_parts`).
   - Tabel Transaksi: Wajib berawalan `t_` (contoh: `t_inspection_trays`, `t_inspection_details`, `t_calibration_logs`).
   - Semua nama kolom wajib menggunakan **`snake_case`** (contoh: `tray_id`, `station_no`, `dimension_mm`, `inspected_at`).
2. **Keamanan Query (Parameterized Queries):**
   - **Dilarang keras menggunakan string concatenation untuk SQL** (misal: `"SELECT * FROM t WHERE id = '" + id + "'"`).
   - Wajib menggunakan **Prepared Statements / Parameterized Queries** (`@param` di MSSQL) untuk menjamin 100% anti SQL Injection.
3. **Connection Management:**
   - Menggunakan Connection Pooling terkelola (`sql.connect()` dengan konfigurasi `pool: { max: 10, min: 2, idleTimeoutMillis: 30000 }`).

---

## 🗄️ 4. Arsitektur Database: Hybrid Storage (Local Buffer + SQL Server)

### A. Mengapa Menyimpan File di Lokal Terus Berisiko Memberatkan PC?
- 1 tray = 15 gambar x puluhan tray per shift = ribuan citra per hari (puluhan Gigabyte per bulan).
- Menumpuk file gambar di hard disk PC mesin akan menyebabkan **Disk Full**, memperlambat I/O sistem operasi, dan menyulitkan backup.
- Data inspeksi menjadi terisolasi di PC line sehingga tim QA/PED di kantor tidak bisa memantau tren mutu secara real-time.

### B. Solusi Arsitektur Hybrid (Standar Denso)
1. **Local Edge Buffer (PC Mesin X-Ray):**
   - Menyimpan data lokal dengan **retensi 7 s/d 14 hari**.
   - Dilengkapi **Local Storage Auto-Cleaner**: otomatis menghapus gambar part OK yang sudah berumur > 14 hari (gambar NG dan file CSV harian tetap disimpan permanen).
   - Mesin tetap dapat beroperasi normal tanpa henti meskipun koneksi LAN pabrik sedang terputus (*offline-tolerant*).
2. **Central SQL Server (Server QA/PED Denso):**
   - Hasil inspeksi tiap tray dan stasiun otomatis di-sync ke SQL Server pusat pabrik melalui background service.
   - Siap diintegrasikan ke dashboard PowerBI atau Web Monitoring QA pabrik.

### C. DDL Skema 6 Tabel SQL Server (Standar DNIA DX)

```sql
-- ==============================================================================
-- 1. TABEL MASTER KARYAWAN & BARCODE IDENTITAS
-- ==============================================================================
CREATE TABLE m_users (
    npk VARCHAR(30) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'operator', 'tl', 'admin'
    department NVARCHAR(100),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- ==============================================================================
-- 2. TABEL MASTER PART NUMBER & TOLERANSI DANDORI
-- ==============================================================================
CREATE TABLE m_parts (
    part_number VARCHAR(50) PRIMARY KEY,
    part_name NVARCHAR(100),
    min_distance_mm FLOAT NOT NULL, -- misal 0.80 mm
    max_distance_mm FLOAT NOT NULL, -- misal 1.50 mm
    jig_offset_mm FLOAT DEFAULT 0.05,
    target_ct_sec INT DEFAULT 30,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- ==============================================================================
-- 3. TABEL TRANSAKSI HEADER INSPEKSI PER 1 TRAY
-- ==============================================================================
CREATE TABLE t_inspection_trays (
    tray_id VARCHAR(50) PRIMARY KEY, -- format: TRAY-YYYYMMDD-HHmmss
    line_id VARCHAR(20) NOT NULL,    -- misal: 'Line 3'
    part_number VARCHAR(50) FOREIGN KEY REFERENCES m_parts(part_number),
    operator_npk VARCHAR(30) FOREIGN KEY REFERENCES m_users(npk),
    shift VARCHAR(20) NOT NULL,      -- 'Day Shift' / 'Night Shift'
    total_station INT DEFAULT 15,
    ok_qty INT NOT NULL,
    ng_qty INT NOT NULL,
    overall_judgment VARCHAR(5) NOT NULL, -- 'OK' atau 'NG'
    cycle_time_sec FLOAT,
    inspected_at DATETIME DEFAULT GETDATE()
);

-- ==============================================================================
-- 4. TABEL TRANSAKSI DETAIL PENGUKURAN PER STATION (st1 s/d st15)
-- ==============================================================================
CREATE TABLE t_inspection_details (
    detail_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    tray_id VARCHAR(50) FOREIGN KEY REFERENCES t_inspection_trays(tray_id),
    station_no VARCHAR(10) NOT NULL, -- 'st1', 'st2', ... 'st15'
    dimension_mm FLOAT NOT NULL,
    judgment VARCHAR(5) NOT NULL,    -- 'OK' atau 'NG'
    method VARCHAR(30) NOT NULL,     -- 'yolo_keypoint' atau 'manual_measure'
    image_path NVARCHAR(255),
    keypoints_json NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE()
);

-- ==============================================================================
-- 5. TABEL LOG KALIBRASI MASTER JIG HARIAN (Day Shift)
-- ==============================================================================
CREATE TABLE t_calibration_logs (
    calib_id INT IDENTITY(1,1) PRIMARY KEY,
    operator_npk VARCHAR(30) FOREIGN KEY REFERENCES m_users(npk),
    shift VARCHAR(20) NOT NULL,
    scale_mm_per_pixel FLOAT NOT NULL, -- standar: 0.02185
    jig_height_px INT NOT NULL,
    status VARCHAR(20) NOT NULL,       -- 'SUCCESS' / 'FAILED'
    calibrated_at DATETIME DEFAULT GETDATE()
);

-- ==============================================================================
-- 6. TABEL LOG ALARM POKAYOKE NG & RESET BARCODE LEADER
-- ==============================================================================
CREATE TABLE t_alarm_interlocks (
    alarm_id INT IDENTITY(1,1) PRIMARY KEY,
    tray_id VARCHAR(50),
    station_no VARCHAR(10),
    alarm_type VARCHAR(50),
    leader_npk VARCHAR(30) FOREIGN KEY REFERENCES m_users(npk),
    action_taken VARCHAR(50), -- 'Remeasure', 'Manual Measure', 'Release Interlock'
    reset_at DATETIME DEFAULT GETDATE()
);
```

### D. Contoh Implementasi Query Parameterized (Node.js mssql Adapter Standar DNIA DX):
```javascript
import sql from 'mssql';

export async function insertTrayInspection(pool, trayData, stationDetails) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Insert Header Tray (Parameterized Query)
    const trayReq = new sql.Request(transaction);
    await trayReq
      .input('tray_id', sql.VarChar(50), trayData.trayId)
      .input('line_id', sql.VarChar(20), trayData.lineId)
      .input('part_number', sql.VarChar(50), trayData.partNumber)
      .input('operator_npk', sql.VarChar(30), trayData.operatorNpk)
      .input('shift', sql.VarChar(20), trayData.shift)
      .input('total_station', sql.Int, trayData.totalStation)
      .input('ok_qty', sql.Int, trayData.okQty)
      .input('ng_qty', sql.Int, trayData.ngQty)
      .input('overall_judgment', sql.VarChar(5), trayData.overallJudgment)
      .input('cycle_time_sec', sql.Float, trayData.cycleTimeSec)
      .query(`
        INSERT INTO t_inspection_trays 
        (tray_id, line_id, part_number, operator_npk, shift, total_station, ok_qty, ng_qty, overall_judgment, cycle_time_sec)
        VALUES 
        (@tray_id, @line_id, @part_number, @operator_npk, @shift, @total_station, @ok_qty, @ng_qty, @overall_judgment, @cycle_time_sec)
      `);

    // 2. Insert 15 Station Details (Batch)
    for (const st of stationDetails) {
      const stReq = new sql.Request(transaction);
      await stReq
        .input('tray_id', sql.VarChar(50), trayData.trayId)
        .input('station_no', sql.VarChar(10), st.stationNo)
        .input('dimension_mm', sql.Float, st.dimensionMm)
        .input('judgment', sql.VarChar(5), st.judgment)
        .input('method', sql.VarChar(30), st.method)
        .input('image_path', sql.NVarChar(255), st.imagePath)
        .input('keypoints_json', sql.NVarChar(sql.MAX), JSON.stringify(st.keypoints))
        .query(`
          INSERT INTO t_inspection_details 
          (tray_id, station_no, dimension_mm, judgment, method, image_path, keypoints_json)
          VALUES 
          (@tray_id, @station_no, @dimension_mm, @judgment, @method, @image_path, @keypoints_json)
        `);
    }

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    throw new Error('Gagal menyimpan hasil inspeksi ke SQL Server: ' + err.message);
  }
}
```

---

## ⚠️ 5. Evaluasi Masalah & Kebutuhan Fitur (Pain Points)

### A. Fitur Manual Measurement (Titik Melenceng & Zoom Tidak Fleksibel)
* **Penyebab Titik Melenceng:**  
  Terjadi *coordinate mismatch* antara koordinat klik mouse di monitor (`clientX`, `clientY`) dengan resolusi asli gambar X-Ray (`naturalWidth`, `naturalHeight`). Ketika gambar di-scale/fit di CSS container, titik terhitung pada pixel layar, bukan pixel gambar asli.
* **Solusi Standar Computer Vision (Interactive Viewport):**
  1. **Zoom Fleksibel:** Zoom in/out halus menggunakan **scroll wheel mouse** atau tombol zoom (+ / -).
  2. **Pan & Drag:** Gambar dapat digeser (*drag-to-pan*) saat dalam kondisi zoom.
  3. **Magnifying Loupe (Kaca Pembesar):** Kotak preview pembesar di sekitar kursor saat operator meletakkan titik A dan B agar presisi tepat di tepi IC dan tepi housing.
  4. **Kalkulasi Live mm:** Nilai jarak garis A-B langsung terhitung real-time dalam satuan milimeter (`distance_px * 0.02185 mm/px`).

### B. Fitur AI Learning (Modul Khusus Process Engineer / PE)
* **Kebutuhan:** Sarana bagi tim PE untuk mereview citra hasil inspeksi (khususnya kasus false NG atau false OK), mengoreksi titik A dan B, lalu mengekspornya menjadi dataset retraining YOLOv8-pose.
* **Komponen yang Harus Disiapkan:**
  1. Otorisasi khusus via Scan Barcode PE.
  2. Filter pencarian gambar dari folder history.
  3. Canvas penyesuaian titik ground truth (re-labeling).
  4. Tombol export dataset YOLO format.

### D. Manajemen Master Part Number & Dandori Kanban (Anti-Hardcode & Dynamic Scanner)

* **Latar Belakang & Masalah Lapangan:**
  1. **Risiko Hardcode di Program:** Saat ini daftar master part disimpan secara in-memory dalam array JavaScript (`MASTER_PARTS` pada `dandori.service.js`). Pada lingkungan manufaktur nyata, varian part baru sering diperkenalkan, atau batas toleransi engineering diubah oleh Process Engineer (PE) / Quality Control (QC). Jika disimpan di source code, setiap penambahan varian membutuhkan campur tangan programmer, kompilasi ulang, dan risiko downtime produksi.
  2. **Ketidakpastian Format Barcode Kanban Fisik:** Barcode atau QR code pada kartu Kanban fisik Denso memiliki beragam kemungkinan format (apakah string nomor part langsung, format terenkapsulasi `KANBAN:DN-...`, delimited text antar field Kanban pabrik, atau JSON). Admin pabrik harus memiliki kendali penuh untuk mendaftarkan nomor part dan nilai toleransinya di database web UI, sehingga scanner fisik tinggal membaca teks Kanban, mengekstrak nomor part, dan sistem otomatis mengambil toleransi yang sesuai tanpa hardcoding.

* **Arsitektur Solusi Database & Backend (Standar DNIA DX):**
  1. **Penyimpanan Persisten Database JSON (`backend/src/config/parts.json`):**
     Format penyimpanan terstruktur terpisah dari code logika:
     ```json
     [
       {
         "part_number": "DN-XRAY-42890-A",
         "part_name": "Fuel Rail IC Housing (Standard)",
         "min_distance_mm": 0.70,
         "max_distance_mm": 1.70,
         "jig_offset_mm": 0.063,
         "ct_target_sec": 1.2,
         "description": "Standard Tolerance Fuel Rail IC",
         "created_at": "2026-10-12T00:00:00.000Z",
         "updated_at": "2026-10-13T08:00:00.000Z"
       },
       {
         "part_number": "DN-XRAY-42890-B",
         "part_name": "Fuel Rail IC Housing (Tight Spec)",
         "min_distance_mm": 0.95,
         "max_distance_mm": 1.55,
         "jig_offset_mm": 0.063,
         "ct_target_sec": 1.2,
         "description": "High Precision Fuel Rail IC",
         "created_at": "2026-10-12T00:00:00.000Z",
         "updated_at": "2026-10-13T08:00:00.000Z"
       },
       {
         "part_number": "28438-51001",
         "part_name": "Direct Sensor IC Housing",
         "min_distance_mm": 0.80,
         "max_distance_mm": 1.50,
         "jig_offset_mm": 0.050,
         "ct_target_sec": 1.0,
         "description": "Direct Engine Sensor IC",
         "created_at": "2026-10-12T00:00:00.000Z",
         "updated_at": "2026-10-13T08:00:00.000Z"
       },
       {
         "part_number": "197400-0010",
         "part_name": "Airflow Meter IC Housing",
         "min_distance_mm": 0.89,
         "max_distance_mm": 1.61,
         "jig_offset_mm": 0.063,
         "ct_target_sec": 1.2,
         "description": "Airflow Meter Sub-Assembly",
         "created_at": "2026-10-12T00:00:00.000Z",
         "updated_at": "2026-10-13T08:00:00.000Z"
       }
     ]
     ```
  2. **Validasi Skema Zod (`backend/src/validators/dandori.validator.js`):**
     - `partNumber`: string minimal 3 karakter, alphanumeric, strip, dan underscore.
     - `partName`: string minimal 2 karakter.
     - `minDistanceMm`: angka positif (> 0).
     - `maxDistanceMm`: angka positif yang harus lebih besar dari `minDistanceMm`.
     - `jigOffsetMm`: angka positif (default 0.063).
     - `ctTargetSec`: angka positif (default 1.2).
  3. **Backend RESTful API (`dandori.controller.js` & `dandori.routes.js`):**
     - `GET /api/dandori/parts` : Menampilkan seluruh master part.
     - `POST /api/dandori/parts` : Menambah master part baru (validasi duplikasi P/N).
     - `PUT /api/dandori/parts/:partNumber` : Mengupdate nama part dan batas toleransi. Jika part yang diubah sedang aktif, otomatis sinkronkan toleransi aktif ke `config.json` dan `config_runtime.json`.
     - `DELETE /api/dandori/parts/:partNumber` : Menghapus part dengan proteksi *in-use guard* (part yang sedang aktif dilarang dihapus).
     - `POST /api/dandori/parts/:partNumber/activate` : Memilih part sebagai part produksi aktif tanpa scan kanban fisik (sangat berguna untuk simulasi QC & admin override).
     - `POST /api/dandori/scan` : Menerima raw payload dari scanner barcode/QR Kanban fisik.
  4. **Multi-Format Dynamic Kanban Parser (`dandori.service.js`):**
     Scanner barcode hardware Denso akan membaca teks Kanban fisik. Algoritma parser akan secara otomatis mengekstrak nomor P/N berdasarkan berbagai kemungkinan pola:
     - Pola 1 (JSON): `{"part_number":"DN-XRAY-42890-A"}` atau `{"pn":"..."}`.
     - Pola 2 (Prefix Denso): `KANBAN:DN-XRAY-42890-A` atau `KB:DN-XRAY-42890-A`.
     - Pola 3 (Delimited Pabrik): `LINE3|DN-XRAY-42890-A|BOX12|20261013` (mencocokkan token yang ada di master `parts.json`).
     - Pola 4 (Raw String): Nomor part utuh seperti `DN-XRAY-42890-A` atau `28438-51001`.
     - *Anti-Hardcode Fallback:* Jika nomor part ditemukan di database `parts.json`, sistem langsung mengunci toleransi `min_distance_mm` dan `max_distance_mm` sesuai data master yang disetting Admin! Jika tidak ditemukan, sistem memberikan notifikasi informatif: `"Part Number [XYZ] belum terdaftar di Master Part. Silakan daftarkan terlebih dahulu di menu Setting."`

* **Desain Antarmuka UI Frontend di Modal Pengaturan (`SettingsModal.jsx`):**
  1. **Tab Baru "Kelola Part (Dandori)":**
     - Ikon `Barcode` / `Tag` di sidebar kiri modal.
     - Header Tab: Judul "Master Part Number & Toleransi Dandori", tombol "+ Tambah Part Baru", dan Banner Part Aktif saat ini.
  2. **Tabel Data Master Part:**
     - Kolom: `Part Number`, `Nama Part`, `Toleransi (Min - Max)`, `Offset`, `Target CT`, `Status`, `Aksi`.
     - Baris yang sedang aktif ditandai dengan badge hijau `"ACTIVE PART"`.
     - Tombol Aksi per baris:
       * **Set Aktif** (Gradien Cyan-Teal): Mengaktifkan part secara instan ke produksi.
       * **Edit** (Ikon Pensil): Membuka form modal edit nilai toleransi.
       * **Hapus** (Ikon Sampah Merah): Menghapus part (dengan konfirmasi dialog).
  3. **Form Modal Tambah / Edit Part:**
     - Input fields: Part Number, Nama Part, Batas Min (mm), Batas Max (mm), Jig Offset (mm), Target CT (detik), Keterangan.
     - Validasi interaktif langsung (misal jika Min $\ge$ Max, tombol simpan di-disable dan muncul peringatan).
  4. **Sinkronisasi Real-Time ke Dashboard:**
     - Setiap kali part aktif berganti (baik via klik "Set Aktif" di Pengaturan maupun via Scan QR Kanban fisik):
       * `config.json` dan `config_runtime.json` terupdate otomatis.
       * HeaderBar menampilkan Part Number aktif terbaru.
       * Panel kanan Dashboard langsung memperbarui teks standar toleransi (contoh: `Std: 0.80 - 1.50 mm`).
       * Evaluasi AI inspeksi YOLOv8x-pose pada run tray berikutnya langsung menggunakan rentang batas toleransi baru tersebut secara 100% dinamis!

---

## 🗺️ 6. Roadmap & Urutan Langkah Eksekusi

### 🎯 PRIORITAS 1 (Langkah Pertama untuk Dijalankan):

#### 1.A. Fitur UI "Kelola Part Number (Dandori Kanban)" di Modal Pengaturan Sistem (Anti-Hardcode):
1. **Langkah 1 (Database Master Part):**
   - Buat `backend/src/config/parts.json` dengan struktur JSON berisi part Denso aktif (`DN-XRAY-42890-A`, `DN-XRAY-42890-B`, `28438-51001`, `197400-0010`).
2. **Langkah 2 (Backend Validator Zod):**
   - Buat skema validasi `backend/src/validators/dandori.validator.js` untuk payload tambah, edit, aktivasi part, dan scan kanban.
3. **Langkah 3 (Backend Service Refactor):**
   - Refactor `backend/src/services/dandori.service.js` untuk membaca dan menulis secara persisten ke `parts.json`.
   - Implementasikan fungsi `getAllParts()`, `getPartByNumber()`, `createPart()`, `updatePart()`, `deletePart()`, `setActivePart()`, dan `parseAndApplyKanban()`.
   - Tambahkan atomic sync ke `config.json` dan `config_runtime.json`.
4. **Langkah 4 (Backend Controller & Router):**
   - Tambahkan handler CRUD di `backend/src/controllers/dandori.controller.js`.
   - Daftarkan endpoint RESTful di `backend/src/routes/dandori.routes.js`.
5. **Langkah 5 (Frontend UI di SettingsModal.jsx):**
   - Tambahkan tab `parts` ("Kelola Part (Dandori)") di sidebar `SettingsModal.jsx`.
   - Bangun tabel master part dengan badge status aktif dan tombol aksi ("Set Aktif", "Edit", "Hapus").
   - Bangun sub-modal / form tambah dan edit part number.
6. **Langkah 6 (Sinkronisasi State Dashboard di App.jsx):**
   - Hubungkan callback perubahan part ke `App.jsx` untuk memperbarui state `activePart`, `settings`, teks toleransi, dan evaluasi inspeksi secara instan.
7. **Langkah 7 (Verifikasi & Testing End-to-End):**
   - Uji penambahan part baru, ubah batas toleransi, aktifkan part, dan buktikan evaluasi OK/NG pada run tray mengikuti toleransi baru.

#### 1.B. Perbaikan Total Modal Manual Measurement:
1. Transformasi koordinat presisi pixel asli (`naturalWidth / clientWidth`).
2. Fitur interactive zoom wheel, pan drag, dan magnifying loupe kaca pembesar.
3. Live calculation jarak mm akurat.

#### 1.C. Penyesuaian Grid 15 Stasiun:
1. Mengubah UI Grid panel kiri dari 18 pocket menjadi **15 pocket (`st1` s/d `st15`)**.

#### 1.D. Refactor Image Watcher Batch Tray (15 Station + Ignore Frame 16 Reset):
1. Mendeteksi penamaan `xray_line_tanggal_waktu_station` (interval 2 detik).
2. Mengumpulkan 15 citra stasiun, mengabaikan frame ke-16 reset.
3. Menganalisis batch 1 tray sekaligus dan mengupdate dashboard serentak.

### 🎯 PRIORITAS 2 (Fase Tambahan AI Learning):
1. Membangun modal **AI Learning** khusus tim PE/Admin.
2. Viewer histori citra untuk re-annotation titik A & B.
3. Fitur export data untuk retraining YOLOv8-pose.

### 🎯 PRIORITAS 3 (Fase Tambahan SQL Server & Auto-Cleaner):
1. Integrasi modul `mssql` adapter standar DNIA DX.
2. Auto-sync data tray & detail stasiun ke server pusat Denso.
3. Background auto-cleaner untuk menghapus gambar part OK lokal yang berumur > 14 hari.

### 🎯 PRIORITAS 4 (Fase Tambahan POKAYOKE Interlock):
1. Pop-up alarm merah POKAYOKE saat stasiun NG terdeteksi.
2. Interlock reset via Scan Barcode Team Leader (TL).
3. Kompatibilitas sinyal PLC (Modbus RS-485 / Relay) untuk menghentikan konveyor mesin fisik.

---

*Dokumen ini dirancang sebagai Single Source of Truth (SSOT) agar pengembangan dapat dilanjutkan kapan saja dengan konsistensi penuh.*
