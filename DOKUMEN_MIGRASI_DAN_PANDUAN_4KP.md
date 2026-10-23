# PANDUAN LENGKAP MIGRASI SISTEM AI X-RAY 4-KEYPOINT (DENSO 4KP)
**Sistem:** AI X-Ray Inspection System — Production Ready  
**Direktori Produksi:** `C:\Users\LENOVO\Downloads\aixray-clean`  
**Tanggal Penerapan:** 16 Oktober 2026  
**Status Penerapan:** ✅ SELESAI & TERVERIFIKASI  

---

## 1. Ringkasan Eksekutif & Tujuan

Sistem pada folder `C:\Users\LENOVO\Downloads\aixray-clean` telah berhasil di-upgrade dari sistem **2-Keypoint (2KP)** menjadi sistem **4-Keypoint (4KP)** dengan kapabilitas pengukuran 3 parameter simultan:
1. **Gap IC Tip ke Datum (`gap_mm`)**: Standar $0.70$ – $1.70$ mm.
2. **Ketebalan Resin Atas (`upper_resin_mm`)**: Standar $\ge 0.20$ mm.
3. **Ketebalan Resin Bawah (`lower_resin_mm`)**: Standar $\ge 0.20$ mm.

Semua bug geometris (garis miring, pembacaan terdistorsi, dan deteksi tepi luar resin) yang telah diselesaikan di folder riset development telah diterapkan secara bersih ke folder produksi ini.

---

## 2. File-File yang Diterapkan & Cadangan (Backup)

Sebelum perubahan diterapkan, seluruh file asli telah dicadangkan secara aman dengan ekstensi `.bak`:

| Komponen / File | File Target Produksi | File Cadangan (Backup) | Status |
| :--- | :--- | :--- | :--- |
| **Model YOLOv8x-pose (4KP)** | `backend/models/best.pt` | `backend/models/best.pt.bak` | ✅ Diganti dengan model 4KP (`kpt_shape: [4, 3]`) |
| **Python Core Measurement** | `backend/python/auto_anchor_measure.py` | `backend/python/auto_anchor_measure.py.bak` | ✅ Versi 4KP + Force Vertical + First Gradient Edge |
| **FastAPI Inference Sidecar** | `backend/python/inference_server.py` | `backend/python/inference_server.py.bak` | ✅ Versi 4KP + FastAPI endpoint terintegrasi |
| **Konfigurasi Sistem** | `backend/config.json` & `config_runtime.json` | `backend/config.json.bak` | ✅ Ditambahkan parameter resin & flag AI |
| **Service Tray Inspection** | `backend/src/services/tray.service.js` | `backend/src/services/tray.service.js.bak` | ✅ Evaluasi OK/NG 3-parameter dinamis |
| **Frontend UI Panel** | `frontend/src/components/ControlPanel.jsx` | `frontend/src/components/ControlPanel.jsx.bak` | ✅ Menampilkan 3 kartu metrik inspeksi real-time |
| **Script Start Backend** | `start_backend.bat` | — | ✅ Menetapkan path Python `ai_vision` otomatis |

---

## 3. Detail Perubahan Kode & Konfigurasi

### A. Konfigurasi `backend/config.json`
Parameter baru yang telah ditambahkan:
```json
{
  "standard": {
    "min_distance_mm": 0.7,
    "max_distance_mm": 1.7,
    "jig_offset_mm": 0.063,
    "min_resin_upper_mm": 0.2,
    "min_resin_lower_mm": 0.2
  },
  "ai_model": {
    "enabled": true,
    "model_path": "models/best.pt",
    "device": "cpu",
    "force_horizontal_line": true,
    "force_vertical_line": true,
    "horizontal_distance_only": true,
    "outer_resin_edge_detection": true,
    "outer_resin_search_px": 8
  }
}
```

### B. Algoritma Geometri & Edge Detection
1. **Force Vertical Line**:
   Memaksa sumbu horizontal $X$ titik resin atas ($K_3$) dan bawah ($K_4$) sama persis dengan $X$ titik Datum ($K_2$).
   ```python
   pc[0] = pb[0]
   pd[0] = pb[0]
   ```
2. **First Significant Gradient (`find_outer_resin_edge`)**:
   Mendeteksi batas luar bodi resin (*outer contour*) tanpa risiko bablas keluar karena noise citra. Jendela pencarian dibatasi `outer_resin_search_px: 8`.
3. **Format Logging CSV**:
   Mencatat 17 kolom metrik lengkap ke `backend/logs/measurement_log.csv`.

---

## 4. Cara Menjalankan Sistem di Line Produksi

### Langkah 1: Menjalankan Backend & AI Sidecar
Buka folder `C:\Users\LENOVO\Downloads\aixray-clean`, lalu jalankan:
```cmd
start_backend.bat
```
Script ini akan otomatis menginisialisasi:
* Lingkungan Python Conda: `C:\Users\LENOVO\AppData\Local\anaconda3\envs\ai_vision\python.exe`
* FastAPI Inference Server pada port `5001`
* Node.js Backend Server pada port `5000`

### Langkah 2: Menjalankan Frontend
Jalankan file:
```cmd
start_frontend.bat
```
Aplikasi web antarmuka produksi akan berjalan pada port `5173`.

---

## 5. Hasil Pengujian Verifikasi (Smoke Test)

Uji mandiri telah dilakukan pada citra `0.506.jpg` di folder produksi `C:\Users\LENOVO\Downloads\aixray-clean\backend`:
```json
{
  "method": "yolo_keypoint",
  "has_4_keypoints": true,
  "distance_mm": 0.643,
  "gap_ok": false,
  "upper_resin_mm": 1.114,
  "upper_ok": true,
  "lower_resin_mm": 1.577,
  "lower_ok": true,
  "judgement": "NG"
}
```
* **Status Gap:** 0.643 mm (Di luar batas 0.70 – 1.70 mm $\rightarrow$ NG)
* **Status Resin Atas:** 1.114 mm ($\ge 0.20$ mm $\rightarrow$ OK)
* **Status Resin Bawah:** 1.577 mm ($\ge 0.20$ mm $\rightarrow$ OK)
* **Overall Judgement:** NG (Sesuai kaidah QC Denso: salah satu parameter cacat $\rightarrow$ NG)
