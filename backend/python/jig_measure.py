"""
jig_measure.py — Jig Calibration Script for AIxRay
=====================================================
Deteksi tepi ATAS dan BAWAH jig (dark object) secara vertikal dari gambar X-Ray.
Hasil: jig_height_px, scale_mm_per_pixel, overlay image.

Cara kerja:
1. Load gambar grayscale
2. Ambil vertical intensity profile (rata-rata kolom pada range X tertentu)
3. Threshold: cari dark region (intensitas rendah = jig hitam)
4. find_runs() -> pilih dark run terpanjang = jig
5. jig_top = tepi atas run, jig_bottom = tepi bawah run
6. scale = jig_real_mm / jig_height_px
7. Simpan overlay image + return JSON
"""

import argparse, json, os, sys, csv, time
from pathlib import Path
import cv2
import numpy as np


def read_config(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(obj):
    print(json.dumps(obj, ensure_ascii=False))

def ensure_dir(p):
    Path(p).mkdir(parents=True, exist_ok=True)

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def make_odd(k, minimum=1):
    k = int(max(minimum, k))
    return k if k % 2 == 1 else k + 1

def smooth_profile(profile, k):
    k = make_odd(k, 1)
    if k <= 1:
        return profile.astype(np.float32)
    return np.convolve(profile.astype(np.float32), np.ones(k, dtype=np.float32)/k, mode='same')

def find_runs(mask, min_len=1, merge_gap=0):
    """Find contiguous True runs in a boolean mask."""
    runs = []; i = 0; n = len(mask)
    while i < n:
        if mask[i]:
            j = i + 1
            while j < n and mask[j]: j += 1
            runs.append([i, j-1])
            i = j
        else:
            i += 1
    if merge_gap > 0 and runs:
        merged = [runs[0]]
        for r in runs[1:]:
            if r[0] - merged[-1][1] - 1 <= merge_gap:
                merged[-1][1] = r[1]
            else:
                merged.append(r)
        runs = merged
    return [(a, b, b-a+1) for a, b in runs if b-a+1 >= min_len]


def detect_jig_vertical(gray, cfg):
    """
    Deteksi jig secara vertikal (top edge -> bottom edge).

    Strategi:
    - Rata-rata intensitas per baris pada range X tengah gambar
    - Cari baris dengan intensitas MINIMUM = inti jig
    - Hitung background dari area yang JAUH dari jig minimum
    - Midpoint antara background dan jig = threshold
    - Expand dari titik minimum ke atas/bawah sampai >= threshold

    Returns:
        jig_top, jig_bottom, jig_height_px, profile, info_dict
    """
    h, w = gray.shape
    jig_cfg = cfg.get('jig_calibration', {})

    # Range kolom yang di-scan (default: 30%-70% lebar gambar)
    x_start_ratio = float(jig_cfg.get('scan_x_start_ratio', 0.30))
    x_end_ratio   = float(jig_cfg.get('scan_x_end_ratio',   0.70))
    x_start = clamp(int(w * x_start_ratio), 0, w-2)
    x_end   = clamp(int(w * x_end_ratio),   x_start+1, w)

    # Rata-rata intensitas per baris
    roi_cols = gray[:, x_start:x_end].astype(np.float32)
    vert_profile = roi_cols.mean(axis=1)  # shape: (h,)

    # Smooth
    smooth_k = int(jig_cfg.get('profile_smooth_kernel', 11))
    prof = smooth_profile(vert_profile, smooth_k)

    # === ADAPTIVE THRESHOLD ===
    # Skip 30 baris tepi atas/bawah (efek konvolusi di tepi gambar)
    edge_skip = 30
    search_region = prof[edge_skip:h-edge_skip]
    search_offset = edge_skip

    # 1. Cari baris dengan intensitas MINIMUM = inti/pusat jig
    min_idx = int(np.argmin(search_region)) + search_offset
    jig_core_intensity = float(prof[min_idx])

    # 2. Estimasi background = rata-rata 60 baris di ujung atas gambar
    #    (asumsi ujung atas/bawah pasti background)
    bg_top    = float(prof[edge_skip:edge_skip+60].mean())
    bg_bottom = float(prof[h-edge_skip-60:h-edge_skip].mean())
    bg_intensity = (bg_top + bg_bottom) / 2.0

    # 3. Midpoint sebagai threshold
    mid_th = (bg_intensity + jig_core_intensity) / 2.0

    if abs(bg_intensity - jig_core_intensity) < 5:
        raise RuntimeError(
            f'Kontras jig terlalu rendah (background={bg_intensity:.1f}, jig={jig_core_intensity:.1f}). '
            f'Pastikan gambar mengandung jig yang jelas (hitam pekat).'
        )

    # 4. Expand dari min_idx ke ATAS sampai >= mid_th
    top_edge = min_idx
    for i in range(min_idx, edge_skip, -1):
        if prof[i] >= mid_th:
            top_edge = i + 1
            break

    # 5. Expand dari min_idx ke BAWAH sampai >= mid_th
    bottom_edge = min_idx
    for i in range(min_idx, h - edge_skip):
        if prof[i] >= mid_th:
            bottom_edge = i - 1
            break

    top_edge    = clamp(top_edge, 0, h-1)
    bottom_edge = clamp(bottom_edge, 0, h-1)
    if bottom_edge <= top_edge:
        raise RuntimeError(
            f'Jig top/bottom edge tidak valid (top={top_edge}, bottom={bottom_edge}). '
            f'Coba sesuaikan scan_x_start_ratio / scan_x_end_ratio di config.'
        )

    jig_height = bottom_edge - top_edge + 1

    info = {
        'scan_x_range': [x_start, x_end],
        'jig_core_row': int(min_idx),
        'jig_core_intensity': float(jig_core_intensity),
        'background_intensity': float(bg_intensity),
        'threshold_used': float(mid_th),
        'selected_run': [int(top_edge), int(bottom_edge), int(jig_height)],
    }

    return top_edge, bottom_edge, jig_height, prof.tolist(), info


def draw_jig_overlay(img_bgr, jig_top, jig_bottom, jig_height_px, scale_mm_per_pixel, jig_real_mm, scan_x_range, out_path):
    """Gambar overlay: garis top/bottom jig, label, bracket."""
    vis = img_bgr.copy()
    h, w = vis.shape[:2]
    x_start, x_end = scan_x_range

    # Warna kalibrasi: amber / orange-kuning
    color_top    = (0, 200, 255)   # kuning
    color_bottom = (0, 140, 255)   # orange
    color_bracket= (0, 200, 255)
    color_label  = (255, 255, 255)
    color_bg     = (30, 30, 30)

    # Garis top & bottom jig (full width)
    cv2.line(vis, (0, jig_top),    (w-1, jig_top),    color_top,    2, cv2.LINE_AA)
    cv2.line(vis, (0, jig_bottom), (w-1, jig_bottom), color_bottom, 2, cv2.LINE_AA)

    # Bracket vertikal di kiri
    bx = max(10, x_start - 40)
    cv2.line(vis, (bx, jig_top), (bx, jig_bottom), color_bracket, 3, cv2.LINE_AA)
    cv2.line(vis, (bx-8, jig_top),    (bx+8, jig_top),    color_bracket, 2, cv2.LINE_AA)
    cv2.line(vis, (bx-8, jig_bottom), (bx+8, jig_bottom), color_bracket, 2, cv2.LINE_AA)

    # Scan area box
    cv2.rectangle(vis, (x_start, 0), (x_end, h-1), (180, 180, 0), 1)

    # Label utama
    mid_y = (jig_top + jig_bottom) // 2
    label_lines = [
        f'JIG: {jig_height_px} px',
        f'= {jig_real_mm:.3f} mm',
        f'scale: {scale_mm_per_pixel:.5f} mm/px',
    ]
    font = cv2.FONT_HERSHEY_SIMPLEX
    fscale = 0.65
    thick = 2
    lx = bx + 18
    for i, line in enumerate(label_lines):
        ly = mid_y - 30 + i * 26
        ly = clamp(ly, 20, h - 10)
        (tw, th), _ = cv2.getTextSize(line, font, fscale, thick)
        cv2.rectangle(vis, (lx-4, ly-th-4), (lx+tw+4, ly+4), color_bg, -1)
        cv2.putText(vis, line, (lx, ly), font, fscale, color_label, thick, cv2.LINE_AA)

    # Label TOP / BOTTOM
    cv2.putText(vis, 'JIG TOP',    (x_end + 8, jig_top    + 6), font, 0.5, color_top,    1, cv2.LINE_AA)
    cv2.putText(vis, 'JIG BOTTOM', (x_end + 8, jig_bottom - 4), font, 0.5, color_bottom, 1, cv2.LINE_AA)

    cv2.imwrite(out_path, vis)


def main():
    ap = argparse.ArgumentParser(description='Jig calibration: detect jig vertical extent and compute scale.')
    ap.add_argument('--input',      required=True,  help='Path to jig X-Ray image')
    ap.add_argument('--output-dir', required=True,  help='Directory for overlay output image')
    ap.add_argument('--config',     required=True,  help='Path to config JSON')
    args = ap.parse_args()

    cfg = read_config(args.config)
    ensure_dir(args.output_dir)

    img = cv2.imread(args.input)
    if img is None:
        save_json({'status': 'error', 'error': f'Tidak bisa membaca gambar: {args.input}'})
        sys.exit(2)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Ambil ukuran jig real dari config
    jig_cfg     = cfg.get('jig_calibration', {})
    jig_real_mm = float(jig_cfg.get('jig_real_mm', 0.0))
    if jig_real_mm <= 0:
        save_json({
            'status': 'error',
            'error': 'jig_real_mm belum diset di config. Isi dulu ukuran fisik jig (mm) di bagian Settings → Jig Calibration.'
        })
        sys.exit(2)

    try:
        jig_top, jig_bottom, jig_height_px, profile, info = detect_jig_vertical(gray, cfg)
    except RuntimeError as e:
        save_json({'status': 'error', 'error': str(e)})
        sys.exit(2)

    # Hitung scale
    scale_mm_per_pixel = jig_real_mm / jig_height_px

    # Gambar overlay
    base         = Path(args.input).stem
    overlay_name = f'jig_{base}_overlay.png'
    overlay_path = str(Path(args.output_dir) / overlay_name)
    draw_jig_overlay(
        img, jig_top, jig_bottom, jig_height_px,
        scale_mm_per_pixel, jig_real_mm,
        info['scan_x_range'], overlay_path
    )

    result = {
        'status':              'success',
        'input_file':          Path(args.input).name,
        'overlay_image':       overlay_name,
        'jig_top_px':          int(jig_top),
        'jig_bottom_px':       int(jig_bottom),
        'jig_height_px':       int(jig_height_px),
        'jig_real_mm':         float(jig_real_mm),
        'scale_mm_per_pixel':  float(scale_mm_per_pixel),
        'scan_x_range':        info['scan_x_range'],
        'jig_core_intensity':  info.get('jig_core_intensity'),
        'background_intensity':info.get('background_intensity'),
        'threshold_used':      info.get('threshold_used'),
        'note': 'Jig calibration berhasil. scale_mm_per_pixel otomatis tersimpan ke config.'
    }
    save_json(result)


if __name__ == '__main__':
    main()
