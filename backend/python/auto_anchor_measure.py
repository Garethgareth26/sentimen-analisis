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
    runs=[]; i=0; n=len(mask)
    while i<n:
        if mask[i]:
            j=i+1
            while j<n and mask[j]: j+=1
            runs.append([i,j-1])
            i=j
        else:
            i+=1
    if merge_gap>0 and runs:
        merged=[runs[0]]
        for r in runs[1:]:
            if r[0]-merged[-1][1]-1 <= merge_gap:
                merged[-1][1]=r[1]
            else:
                merged.append(r)
        runs=merged
    return [(a,b,b-a+1) for a,b in runs if b-a+1>=min_len]

def detect_xray_crop(gray, cfg):
    h,w=gray.shape
    crop=cfg.get('xray_crop', {})
    mode=crop.get('mode','ratio')
    if mode=='manual':
        x=int(crop.get('x',40)); y=int(crop.get('y',30)); cw=int(crop.get('w', int(w*0.76))); ch=int(crop.get('h', h-40))
        x=clamp(x,0,w-1); y=clamp(y,0,h-1); cw=clamp(cw,1,w-x); ch=clamp(ch,1,h-y)
        return x,y,cw,ch
    left=int(crop.get('left_px',40)); top=int(crop.get('top_px',30))
    right_ratio=float(crop.get('right_ratio',0.78)); bottom_px=int(crop.get('bottom_px',10))
    right=int(w*right_ratio); bottom=h-bottom_px
    left=clamp(left,0,w-2); top=clamp(top,0,h-2); right=clamp(right,left+1,w); bottom=clamp(bottom,top+1,h)
    return left, top, right-left, bottom-top

def apply_preprocessing(gray, cfg):
    """Return processed grayscale image for detection. Keep all values uint8."""
    p = cfg.get('preprocessing', {})
    if not p.get('enabled', True):
        return gray.copy()

    out = gray.copy()

    if p.get('normalize', True):
        out = cv2.normalize(out, None, 0, 255, cv2.NORM_MINMAX)

    # Optional brightness/contrast/exposure-like linear adjustment.
    # alpha > 1 increases contrast, beta positive increases brightness.
    alpha = float(p.get('contrast_alpha', 1.0))
    beta = float(p.get('brightness_beta', 0.0))
    if abs(alpha - 1.0) > 1e-6 or abs(beta) > 1e-6:
        out = cv2.convertScaleAbs(out, alpha=alpha, beta=beta)

    # Optional gamma correction. gamma < 1 makes image brighter, gamma > 1 darker.
    gamma = float(p.get('gamma', 1.0))
    if gamma > 0 and abs(gamma - 1.0) > 1e-6:
        lut = np.array([((i / 255.0) ** gamma) * 255 for i in range(256)]).astype('uint8')
        out = cv2.LUT(out, lut)

    if p.get('clahe_enabled', True):
        clip = float(p.get('clahe_clip_limit', 2.0))
        tile = int(p.get('clahe_tile_grid_size', 8))
        tile = max(2, tile)
        clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile))
        out = clahe.apply(out)

    blur_type = str(p.get('blur_type', 'gaussian')).lower()
    k = make_odd(int(p.get('blur_kernel', 5)), 1)
    if k > 1:
        if blur_type == 'median':
            out = cv2.medianBlur(out, k)
        elif blur_type == 'bilateral':
            out = cv2.bilateralFilter(out, k, 75, 75)
        elif blur_type == 'none':
            pass
        else:
            out = cv2.GaussianBlur(out, (k, k), 0)

    if p.get('invert', False):
        out = 255 - out

    return out

def detect_crosshair_y(crop_gray, cfg):
    ch,cw=crop_gray.shape
    c=cfg.get('crosshair',{})
    manual=c.get('manual_scan_y', None)
    if manual not in [None, "", -1]:
        return clamp(int(manual), 0, ch-1), 'manual'
    y0=int(ch*float(c.get('search_y_start_ratio',0.35)))
    y1=int(ch*float(c.get('search_y_end_ratio',0.72)))
    y0=clamp(y0,3,ch-5); y1=clamp(y1,y0+1,ch-4)
    scores=[]
    # Crosshair is a thin dashed line; it has contrast against nearby rows.
    for y in range(y0,y1):
        above=crop_gray[max(0,y-3):y].mean(axis=0)
        below=crop_gray[y+1:min(ch,y+4)].mean(axis=0)
        local=(above+below)/2.0
        diff=np.abs(crop_gray[y].astype(np.float32)-local)
        score=float((diff>float(c.get('contrast_threshold',10))).sum()) + 0.1*float(diff.mean())
        scores.append((score,y))
    scores.sort(reverse=True)
    y=scores[0][1]
    return clamp(y+int(c.get('measurement_y_offset_px',-18)),0,ch-1), 'auto_crosshair_plus_offset'

def compute_measurement_profile(crop_gray, cfg):
    ch,cw=crop_gray.shape
    c=cfg.get('crosshair',{})
    e=cfg.get('edge_detection',{})
    y, y_method=detect_crosshair_y(crop_gray, cfg)
    band_h=int(c.get('band_height_px',15)); half=max(1,band_h//2)
    ya=clamp(y-half,0,ch-1); yb=clamp(y+half+1,ya+1,ch)
    band=crop_gray[ya:yb,:].mean(axis=0)
    prof=smooth_profile(band, int(e.get('profile_smooth_kernel',15)))
    return y, y_method, ya, yb, band, prof

def measure(crop_gray, x0_crop, y0_crop, cfg):
    ch,cw=crop_gray.shape
    e=cfg.get('edge_detection',{})
    y, y_method, ya, yb, band, prof = compute_measurement_profile(crop_gray, cfg)

    sx=int(cw*float(e.get('search_x_start_ratio',0.10)))
    ex=int(cw*float(e.get('search_x_end_ratio',0.45)))
    sx=clamp(sx,0,cw-2); ex=clamp(ex,sx+10,cw)
    seg=prof[sx:ex]

    dark_th=np.percentile(seg, float(e.get('dark_threshold_percentile',42)))
    bright_th=np.percentile(seg, float(e.get('bright_threshold_percentile',68)))

    dark_mask=seg <= dark_th
    dark_runs=find_runs(dark_mask, int(e.get('min_dark_run_px',12)), int(e.get('merge_gap_px',3)))
    if not dark_runs:
        raise RuntimeError('Dark object tidak ditemukan. Coba naik/turunkan dark_threshold_percentile, aktifkan CLAHE, atau perluas search_x range.')

    min_x_from_search=int(e.get('min_dark_x_from_search_start_px',20))
    chosen=None
    for r in dark_runs:
        if r[0]>=min_x_from_search:
            chosen=r; break
    if chosen is None:
        chosen=dark_runs[0]

    dark_start=sx+chosen[0]
    dark_end=sx+chosen[1]

    # Bright area is object putih di kiri dark object.
    left_seg=prof[sx:dark_start]
    bright_mask=left_seg >= bright_th
    bright_runs=find_runs(bright_mask, int(e.get('min_bright_run_px',8)), int(e.get('bright_merge_gap_px',3)))
    if bright_runs:
        br=bright_runs[-1]
        bright_end=sx+br[1]
    else:
        # fallback: strongest transition before dark start
        search_a=max(sx,dark_start-120)
        diff=np.diff(prof[search_a:dark_start])
        if len(diff)>0:
            bright_end=search_a+int(np.argmax(np.abs(diff)))
        else:
            bright_end=max(sx,dark_start-int(e.get('fallback_gap_px',40)))

    start=int(bright_end + int(e.get('start_offset_px',0)))
    end=int(dark_start + int(e.get('end_offset_px',0)))
    start=clamp(start,0,cw-1); end=clamp(end,0,cw-1)
    if end < start:
        start,end=end,start
    dist_px=max(0,end-start)
    scale=float(cfg.get('scale_mm_per_pixel',0.05))
    dist_mm=dist_px*scale
    std=cfg.get('standard',{})
    min_mm=float(std.get('min_distance_mm',1.0)); max_mm=float(std.get('max_distance_mm',3.0))
    jig_offset=float(std.get('jig_offset_mm',0.0))
    effective_min=min_mm+jig_offset; effective_max=max_mm-jig_offset
    judgement='OK' if effective_min <= dist_mm <= effective_max else 'NG'
    return {
        'crop': {'x':x0_crop,'y':y0_crop,'w':cw,'h':ch},
        'scan_y_crop': int(y), 'scan_y_full': int(y0_crop+y), 'scan_y_method': y_method,
        'band': {'y1':int(ya),'y2':int(yb),'height':int(yb-ya)},
        'search_x': {'start_crop':int(sx),'end_crop':int(ex),'start_full':int(x0_crop+sx),'end_full':int(x0_crop+ex)},
        'dark_threshold': float(dark_th), 'bright_threshold': float(bright_th),
        'dark_run_crop': {'start':int(dark_start),'end':int(dark_end)},
        'bright_edge_crop': int(bright_end),
        'point_a_crop': [int(start), int(y)], 'point_b_crop': [int(end), int(y)],
        'point_a_full': [int(x0_crop+start), int(y0_crop+y)], 'point_b_full': [int(x0_crop+end), int(y0_crop+y)],
        'distance_px': float(dist_px), 'distance_mm': float(dist_mm),
        'scale_mm_per_pixel': scale,
        'drawing_min_mm': min_mm, 'drawing_max_mm': max_mm,
        'jig_offset_mm': jig_offset,
        'effective_min_mm': effective_min, 'effective_max_mm': effective_max,
        'judgement': judgement,
        'all_dark_runs_full': [[int(x0_crop+sx+a), int(x0_crop+sx+b), int(l)] for a,b,l in dark_runs[:10]],
        '_profile': prof.tolist(), '_band': band.tolist(), '_search_segment': [int(sx), int(ex)]
    }


def resolve_model_path(model_path, config_path):
    if not model_path:
        return ''
    p = Path(str(model_path))
    if p.is_absolute():
        return str(p)
    # Relative model paths are resolved from config.json folder.
    return str((Path(config_path).parent / p).resolve())


def find_outer_resin_edge(img_bgr, pb, pc_hint, pd_hint, cfg):
    """
    Snap K3/K4 ke tepi LUAR bodi resin (outer contour) sesuai gambar desain Denso.

    Dari drawing OHP 100% Check, minimum resin thickness 0.2mm diukur dari
    Datum (K2) ke batas LUAR resin di sisi atas (K3) dan bawah (K4).

    Strategi:
      - Gunakan prediksi YOLO K3/K4 sebagai pusat area pencarian.
      - Scan kolom vertikal di x = Datum (sudah force_vertical).
      - Cari gradien intensitas terbesar = transisi resin→udara/background.

    Args:
        img_bgr  : full BGR image
        pb       : Datum [x, y] setelah force_vertical
        pc_hint  : YOLO prediksi K3 upper [x, y] (pusat pencarian atas)
        pd_hint  : YOLO prediksi K4 lower [x, y] (pusat pencarian bawah)
        cfg      : dict config

    Returns:
        pc_outer : K3 outer edge [x, y] sebagai np.array
        pd_outer : K4 outer edge [x, y] sebagai np.array
    """
    ai = cfg.get('ai_model', {})
    if not ai.get('outer_resin_edge_detection', False):
        return pc_hint.copy(), pd_hint.copy()

    search_px = int(ai.get('outer_resin_search_px', 20))
    x_col     = int(round(pb[0]))
    h, w      = img_bgr.shape[:2]
    x_col     = max(2, min(w - 3, x_col))

    # Grayscale
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY) if img_bgr.ndim == 3 else img_bgr

    def snap_to_outer_edge(y_hint, direction):
        """
        Scan dari posisi YOLO hint ke arah LUAR (up/down) pixel per pixel.
        Ambil gradien PERTAMA yang melebihi threshold — bukan gradien maksimum.
        Ini mencegah loncatan ke step housing yang gradiennya lebih kuat.

        direction='up'  → cari tepi di ATAS y_hint (K3 upper side)
        direction='down'→ cari tepi di BAWAH y_hint (K4 lower side)
        """
        x0 = max(0, x_col - 2)
        x1 = min(w, x_col + 3)

        if direction == 'up':
            y0 = max(0, y_hint - search_px)
            y1 = min(h, y_hint + 3)
        else:
            y0 = max(0, y_hint - 3)
            y1 = min(h, y_hint + search_px)

        if y1 - y0 < 3:
            return float(y_hint)

        strip  = gray[y0:y1, x0:x1].mean(axis=1).astype(np.float32)
        smooth = smooth_profile(strip, 3)
        grad   = np.abs(np.diff(smooth))
        if len(grad) == 0:
            return float(y_hint)

        # Threshold = 30% dari nilai gradien maksimum dalam window
        threshold = float(grad.max()) * 0.30
        if threshold < 1.0:
            return float(y_hint)   # tidak ada gradien signifikan → pakai YOLO hint

        if direction == 'up':
            # Scan dari y_hint ke atas (index turun dari akhir ke 0)
            for i in range(len(grad) - 1, -1, -1):
                if grad[i] >= threshold:
                    return float(y0 + i)
        else:
            # Scan dari y_hint ke bawah (index naik dari 0)
            for i in range(len(grad)):
                if grad[i] >= threshold:
                    return float(y0 + i)

        return float(y_hint)

    y_upper  = snap_to_outer_edge(int(round(pc_hint[1])), 'up')
    y_lower  = snap_to_outer_edge(int(round(pd_hint[1])), 'down')

    pc_outer = np.array([pb[0], y_upper], dtype=float)
    pd_outer = np.array([pb[0], y_lower], dtype=float)
    return pc_outer, pd_outer

def detect_housing_tilt_and_measure(img_bgr, p_wall_hint, p_tip_hint, p_up_hint, p_dn_hint, cfg):
    """
    Mengukur dimensi part dengan acuan bodi kotak luar (housing tilt angle).
    - Menghasilkan 3 garis merah presisi sesuai Gambar 1 & Gambar 2:
      1. Gap horizontal: dari dinding datum (P_wall) ke sudut maju terdepan pin IC (P_tip).
      2. Upper resin: dari permukaan ATAS bodi pin kotak hitam (P_pin_top, NEMPEL) ke tepi luar atas resin (P_upper).
      3. Lower resin: dari permukaan BAWAH undakan pin (P_pin_bot, NEMPEL) ke tepi luar bawah resin (P_lower).
      Badan pin IC di antara P_pin_top dan P_pin_bot TIDAK dipotong/dilewati garis ukur.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY) if img_bgr.ndim == 3 else img_bgr
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    h, w = gray.shape[:2]

    # 1. Refined Frontmost Tip Corner (Sudut Maju Pin IC Paling Depan)
    # Mencari titik terdepan fisik metal pin di sekitar p_tip_hint dengan GUARDRAIL KETAT (max shift ±3 px)
    # agar tidak melompat ke bayangan housing atau undakan resin (penyebab Over-Reject nyeleneh)
    x_min_s = max(0, int(p_tip_hint[0] - 4))
    x_max_s = min(w, int(p_tip_hint[0] + 4))
    y_min_s = max(0, int(p_tip_hint[1] - 8))
    y_max_s = min(h, int(p_tip_hint[1] + 8))
    sub = gray[y_min_s:y_max_s, x_min_s:x_max_s]
    th = min(sub.min() + 25, 90)
    dys, dxs = np.where(sub < th)
    if len(dxs):
        mx = np.min(dxs)
        f_ys = dys[dxs <= mx + 2]
        cand_tip = np.array([x_min_s + mx, y_min_s + float(np.mean(f_ys))], dtype=float)
        # Guardrail: jika pergeseran melebihi 3 piksel (~0.07 mm), tolak dan gunakan prediksi AI murni!
        if np.linalg.norm(cand_tip - p_tip_hint) <= 3.0:
            p_tip = cand_tip
        else:
            p_tip = np.array(p_tip_hint, dtype=float)
    else:
        p_tip = np.array(p_tip_hint, dtype=float)

    x_tip = float(p_tip[0])
    y_tip = float(p_tip[1])

    # 2. Deteksi kemiringan kotak luar HANYA pada bagian leher lurus (neck)
    top_pts = []
    bot_pts = []
    scan_start = int(max(0, x_tip + 15))
    scan_end = int(min(w - 20, x_tip + 80))

    if scan_end - scan_start >= 20:
        for x in range(scan_start, scan_end, 8):
            y0_u = max(0, int(p_up_hint[1] - 25))
            y1_u = min(h, int(p_up_hint[1] + 25))
            col_u = blur[y0_u:y1_u, x].astype(float)
            gy_u = np.abs(np.gradient(col_u))
            if len(gy_u) > 0 and gy_u.max() > 2.5:
                top_pts.append((x, y0_u + int(np.argmax(gy_u))))

            y0_d = max(0, int(p_dn_hint[1] - 25))
            y1_d = min(h, int(p_dn_hint[1] + 25))
            col_d = blur[y0_d:y1_d, x].astype(float)
            gy_d = np.abs(np.gradient(col_d))
            if len(gy_d) > 0 and gy_d.max() > 2.5:
                bot_pts.append((x, y0_d + int(np.argmax(gy_d))))

    s_top = float(np.polyfit([p[0] for p in top_pts], [p[1] for p in top_pts], 1)[0]) if len(top_pts) >= 4 else 0.0
    s_bot = float(np.polyfit([p[0] for p in bot_pts], [p[1] for p in bot_pts], 1)[0]) if len(bot_pts) >= 4 else 0.0

    if abs(s_top - s_bot) < 0.035 and abs(s_top) > 0.025:
        mean_slope = (s_top + s_bot) / 2.0
    else:
        mean_slope = 0.0

    theta = float(np.arctan(mean_slope))
    theta_deg = float(np.degrees(theta))
    if abs(theta_deg) < 1.5 or abs(theta_deg) > 7.0:
        theta = 0.0
        theta_deg = 0.0

    v_axial = np.array([np.cos(theta), np.sin(theta)], dtype=float)
    n_transverse = np.array([-np.sin(theta), np.cos(theta)], dtype=float)

    # 3. Dinding datum depan (P_wall) dengan Guardrail
    s_axial = float((p_tip - p_wall_hint).dot(v_axial))
    ss_wall = np.linspace(max(5.0, s_axial - 3.0), s_axial + 3.0, 25)
    vals_wall = np.array([float(cv2.getRectSubPix(blur, (1, 1), (float(p_tip[0] - s * v_axial[0]), float(p_tip[1] - s * v_axial[1])))[0, 0]) for s in ss_wall])
    grad_wall = np.abs(np.gradient(vals_wall))
    s_wall_best = float(ss_wall[np.argmax(grad_wall)]) if len(grad_wall) > 0 and grad_wall.max() > 1.2 else s_axial
    cand_wall = p_tip - s_wall_best * v_axial
    # Guardrail: jika pergeseran dinding melebihi 3 piksel, tolak dan pertahankan prediksi AI
    if np.linalg.norm(cand_wall - p_wall_hint) <= 3.0:
        p_wall = cand_wall
    else:
        p_wall = np.array(p_wall_hint, dtype=float)

    # 4. Garis Up: DI ATAS KOTAK ITEM YANG DI DALEM (offset dx ~ 8 px dari ujung maju, persis Gambar 1 & 2)
    # dan NEMPEL di permukaan atas pin (tidak ngambang seperti di Gambar 3)
    dx_up = 8.0
    x_up_pt = p_tip + dx_up * v_axial
    ts_pin_up = np.linspace(-25, 10, 71)
    vals_pin_up = np.array([float(cv2.getRectSubPix(gray, (1, 1), (float(x_up_pt[0] + t * n_transverse[0]), float(x_up_pt[1] + t * n_transverse[1])))[0, 0]) for t in ts_pin_up])
    t_metal_top = float(ts_pin_up[np.argmin(np.gradient(vals_pin_up))])
    p_pin_top = x_up_pt + t_metal_top * n_transverse

    # Batas resin atas di atas p_pin_top
    t_up_init = float(np.linalg.norm(p_tip - p_up_hint))
    ts_up = np.linspace(max(20, t_up_init - 15), t_up_init + 15, 61)
    vals_up = np.array([float(cv2.getRectSubPix(blur, (1, 1), (float(p_pin_top[0] - t * n_transverse[0]), float(p_pin_top[1] - t * n_transverse[1])))[0, 0]) for t in ts_up])
    grad_up = np.abs(np.gradient(vals_up))
    t_up_best = float(ts_up[np.argmax(grad_up)]) if len(grad_up) > 0 and grad_up.max() > 1.2 else t_up_init
    p_upper = p_pin_top - t_up_best * n_transverse

    # 5. Garis Down: DI SISI TERLUAR UNDAKAN BAWAH (offset dx ~ 14 px dari ujung maju)
    # dan NEMPEL di permukaan bawah pin (tidak ngambang)
    dx_dn = 14.0
    x_dn_pt = p_tip + dx_dn * v_axial
    ts_pin_dn = np.linspace(0, 35, 71)
    vals_pin_dn = np.array([float(cv2.getRectSubPix(gray, (1, 1), (float(x_dn_pt[0] + t * n_transverse[0]), float(x_dn_pt[1] + t * n_transverse[1])))[0, 0]) for t in ts_pin_dn])
    t_metal_bot = float(ts_pin_dn[np.argmax(np.gradient(vals_pin_dn))])
    p_pin_bot = x_dn_pt + t_metal_bot * n_transverse

    # Batas resin bawah di bawah p_pin_bot
    t_dn_init = float(np.linalg.norm(p_dn_hint - p_tip))
    ts_dn = np.linspace(max(30, t_dn_init - 15), t_dn_init + 25, 81)
    vals_dn = np.array([float(cv2.getRectSubPix(blur, (1, 1), (float(p_pin_bot[0] + (t - t_metal_bot) * n_transverse[0]), float(p_pin_bot[1] + (t - t_metal_bot) * n_transverse[1])))[0, 0]) for t in ts_dn])
    grad_dn = np.abs(np.gradient(vals_dn))
    t_dn_best = float(ts_dn[np.argmax(grad_dn)]) if len(grad_dn) > 0 and grad_dn.max() > 1.2 else t_dn_init
    p_lower = p_pin_bot + (t_dn_best - t_metal_bot) * n_transverse

    # Jarak resin dihitung dari permukaan pin ke tepi resin
    upper_px = float(np.linalg.norm(p_upper - p_pin_top))
    lower_px = float(np.linalg.norm(p_lower - p_pin_bot))
    dist_px = float(np.linalg.norm(p_tip - p_wall))

    return {
        'theta_housing_rad': theta,
        'theta_housing_deg': theta_deg,
        'v_axial': v_axial,
        'n_transverse': n_transverse,
        'p_wall': p_wall,
        'p_tip': p_tip,
        'p_upper': p_upper,
        'p_lower': p_lower,
        'p_pin_top': p_pin_top,
        'p_pin_bot': p_pin_bot,
        'dist_px': dist_px,
        'upper_px': upper_px,
        'lower_px': lower_px
    }

def measure_yolo_keypoint(img_bgr, crop_raw_gray, crop_proc_gray, x0_crop, y0_crop, cfg, config_path):
    """Detect two measurement keypoints using Ultralytics YOLO pose.
    Expected model: one object with at least 2 keypoints.
    keypoint 0 = Point A / start gap
    keypoint 1 = Point B / end gap
    """
    ai = cfg.get('ai_model', {})
    model_path = resolve_model_path(ai.get('model_path', ''), config_path)
    if not model_path or not Path(model_path).exists():
        raise RuntimeError(f"YOLO model tidak ditemukan: {model_path}. Upload model .pt dari UI atau set ai_model.model_path.")

    try:
        from ultralytics import YOLO
    except Exception as e:
        raise RuntimeError("Package ultralytics belum terinstall. Jalankan: pip install ultralytics") from e

    model = YOLO(model_path)
    # Select inference image style. Default: full_raw (matching training dataset distribution).
    input_mode = str(ai.get('input_mode', 'full_raw')).lower()
    if input_mode == 'full_raw' or (not ai.get('use_preprocessed_crop', True) and input_mode != 'crop_raw'):
        infer_img = img_bgr
        is_full_input = True
    elif input_mode == 'crop_raw' or not ai.get('use_preprocessed_crop', True):
        infer_img = cv2.cvtColor(crop_raw_gray, cv2.COLOR_GRAY2BGR)
        is_full_input = False
    else:
        infer_img = cv2.cvtColor(crop_proc_gray, cv2.COLOR_GRAY2BGR)
        is_full_input = False

    conf_th = float(ai.get('confidence_threshold', 0.35))
    kpt_conf_th = float(ai.get('keypoint_confidence_threshold', 0.25))
    device_target = ai.get('device', 'cpu')
    results = model.predict(infer_img, conf=conf_th, verbose=False, device=device_target)
    if not results:
        raise RuntimeError('YOLO keypoint tidak menghasilkan result.')
    r = results[0]
    if r.keypoints is None or len(r.keypoints) == 0:
        raise RuntimeError('Keypoint tidak terdeteksi. Coba model lain, confidence lebih rendah, atau cek crop/preprocessing.')

    kp_xy = r.keypoints.xy.cpu().numpy()       # [N, K, 2]
    kp_conf = None
    if getattr(r.keypoints, 'conf', None) is not None:
        kp_conf = r.keypoints.conf.cpu().numpy()  # [N, K]

    # Choose detection with best combined confidence.
    boxes_conf = r.boxes.conf.cpu().numpy() if r.boxes is not None and len(r.boxes)>0 else np.ones((kp_xy.shape[0],), dtype=np.float32)
    idx_a = int(ai.get('point_a_index', 0))
    idx_b = int(ai.get('point_b_index', 1))
    best_i = None
    best_score = -1.0
    for i in range(kp_xy.shape[0]):
        if kp_xy.shape[1] <= max(idx_a, idx_b):
            continue
        cka = float(kp_conf[i, idx_a]) if kp_conf is not None else 1.0
        ckb = float(kp_conf[i, idx_b]) if kp_conf is not None else 1.0
        if cka < kpt_conf_th or ckb < kpt_conf_th:
            continue
        score = float(boxes_conf[i]) * (cka + ckb) / 2.0
        if score > best_score:
            best_i, best_score = i, score
    if best_i is None:
        raise RuntimeError('Keypoint A/B confidence terlalu rendah. Turunkan keypoint_confidence_threshold atau train ulang model.')

    has_4kp = kp_xy.shape[1] >= 4
    if has_4kp:
        pa = kp_xy[best_i, 0].astype(float)  # KP1: IC Tip
        pb = kp_xy[best_i, 1].astype(float)  # KP2: Datum
        pc = kp_xy[best_i, 2].astype(float)  # KP3: Upper Resin
        pd = kp_xy[best_i, 3].astype(float)  # KP4: Lower Resin
        cka = float(kp_conf[best_i, 0]) if kp_conf is not None else 1.0
        ckb = float(kp_conf[best_i, 1]) if kp_conf is not None else 1.0
        ckc = float(kp_conf[best_i, 2]) if kp_conf is not None else 1.0
        ckd = float(kp_conf[best_i, 3]) if kp_conf is not None else 1.0
    else:
        pa = kp_xy[best_i, idx_a].astype(float)
        pb = kp_xy[best_i, idx_b].astype(float)
        pc = None
        pd = None
        cka = float(kp_conf[best_i, idx_a]) if kp_conf is not None else 1.0
        ckb = float(kp_conf[best_i, idx_b]) if kp_conf is not None else 1.0
        ckc = None
        ckd = None

    # ── Pastikan pa di kiri (Datum Wall) dan pb di kanan (Sudut Maju Ujung IC) ──
    if ai.get('swap_points_if_needed', True) and pa[0] > pb[0]:
        pa, pb = pb.copy(), pa.copy()
        cka, ckb = ckb, cka

    # ── Pengukuran Presisi Mengikuti Kemiringan Kotak Luar (Housing Tilt Angle) ──
    theta_housing_deg = 0.0
    v_axial = np.array([1.0, 0.0], dtype=float)
    n_transverse = np.array([0.0, 1.0], dtype=float)

    if has_4kp and pc is not None and pd is not None:
        meas = detect_housing_tilt_and_measure(img_bgr, pa, pb, pc, pd, cfg)
        pa = meas['p_wall']
        pb = meas['p_tip']
        pc = meas['p_upper']
        pd = meas['p_lower']
        p_pin_top = meas['p_pin_top']
        p_pin_bot = meas['p_pin_bot']
        dist_px = meas['dist_px']
        upper_px = meas['upper_px']
        lower_px = meas['lower_px']
        theta_housing_deg = meas['theta_housing_deg']
        v_axial = meas['v_axial']
        n_transverse = meas['n_transverse']
    else:
        # Fallback 2-keypoint standard
        if ai.get('force_horizontal_line', True):
            pa[1] = pb[1]
        dist_px = float(np.linalg.norm(pb - pa))
        if ai.get('horizontal_distance_only', True):
            dist_px = abs(float(pb[0] - pa[0]))
        upper_px = 0.0
        lower_px = 0.0
        p_pin_top = pb
        p_pin_bot = pb

    scale = float(cfg.get('scale_mm_per_pixel', 0.05))
    dist_mm = dist_px * scale
    std = cfg.get('standard', {})
    min_mm = float(std.get('min_distance_mm', 0.75)); max_mm = float(std.get('max_distance_mm', 1.70))
    jig_offset = float(std.get('jig_offset_mm', 0.0))
    effective_min = min_mm + jig_offset; effective_max = max_mm - jig_offset
    gap_ok = effective_min <= dist_mm <= effective_max

    min_resin_upper = float(std.get('min_resin_upper_mm', std.get('min_resin_thickness_mm', 0.20)))
    min_resin_lower = float(std.get('min_resin_lower_mm', std.get('min_resin_thickness_mm', 0.20)))

    if has_4kp and pc is not None and pd is not None:
        upper_mm = float(upper_px * scale)
        lower_mm = float(lower_px * scale)
        upper_ok = upper_mm >= min_resin_upper
        lower_ok = lower_mm >= min_resin_lower
        judgement = 'OK' if (gap_ok and upper_ok and lower_ok) else 'NG'
    else:
        upper_mm = 0.0
        lower_mm = 0.0
        upper_ok = True
        lower_ok = True
        judgement = 'OK' if gap_ok else 'NG'

    if is_full_input:
        pa_full = [float(pa[0]), float(pa[1])]
        pb_full = [float(pb[0]), float(pb[1])]
        pa_crop = [float(pa[0] - x0_crop), float(pa[1] - y0_crop)]
        pb_crop = [float(pb[0] - x0_crop), float(pb[1] - y0_crop)]
        pc_full = [float(pc[0]), float(pc[1])] if pc is not None else None
        pd_full = [float(pd[0]), float(pd[1])] if pd is not None else None
        pc_crop = [float(pc[0] - x0_crop), float(pc[1] - y0_crop)] if pc is not None else None
        pd_crop = [float(pd[0] - x0_crop), float(pd[1] - y0_crop)] if pd is not None else None
        p_pin_top_full = [float(p_pin_top[0]), float(p_pin_top[1])] if p_pin_top is not None else None
        p_pin_bot_full = [float(p_pin_bot[0]), float(p_pin_bot[1])] if p_pin_bot is not None else None
        p_pin_top_crop = [float(p_pin_top[0] - x0_crop), float(p_pin_top[1] - y0_crop)] if p_pin_top is not None else None
        p_pin_bot_crop = [float(p_pin_bot[0] - x0_crop), float(p_pin_bot[1] - y0_crop)] if p_pin_bot is not None else None
        scan_y = int(pb[1])
    else:
        pa_crop = [float(pa[0]), float(pa[1])]
        pb_crop = [float(pb[0]), float(pb[1])]
        pa_full = [float(x0_crop + pa[0]), float(y0_crop + pa[1])]
        pb_full = [float(x0_crop + pb[0]), float(y0_crop + pb[1])]
        pc_crop = [float(pc[0]), float(pc[1])] if pc is not None else None
        pd_crop = [float(pd[0]), float(pd[1])] if pd is not None else None
        pc_full = [float(x0_crop + pc[0]), float(y0_crop + pc[1])] if pc is not None else None
        pd_full = [float(x0_crop + pd[0]), float(y0_crop + pd[1])] if pd is not None else None
        p_pin_top_crop = [float(p_pin_top[0]), float(p_pin_top[1])] if p_pin_top is not None else None
        p_pin_bot_crop = [float(p_pin_bot[0]), float(p_pin_bot[1])] if p_pin_bot is not None else None
        p_pin_top_full = [float(x0_crop + p_pin_top[0]), float(y0_crop + p_pin_top[1])] if p_pin_top is not None else None
        p_pin_bot_full = [float(x0_crop + p_pin_bot[0]), float(y0_crop + p_pin_bot[1])] if p_pin_bot is not None else None
        scan_y = int(y0_crop + pb[1])

    return {
        'method': 'yolo_keypoint',
        'model_path': model_path,
        'crop': {'x': int(x0_crop), 'y': int(y0_crop), 'w': int(crop_raw_gray.shape[1]), 'h': int(crop_raw_gray.shape[0])},
        'point_a_crop': pa_crop,
        'point_b_crop': pb_crop,
        'point_c_crop': pc_crop,
        'point_d_crop': pd_crop,
        'point_a_full': pa_full,
        'point_b_full': pb_full,
        'point_c_full': pc_full,
        'point_d_full': pd_full,
        'p_pin_top_full': p_pin_top_full,
        'p_pin_bot_full': p_pin_bot_full,
        'p_pin_top_crop': p_pin_top_crop,
        'p_pin_bot_crop': p_pin_bot_crop,
        'has_4_keypoints': has_4kp,
        'distance_px': dist_px,
        'distance_mm': dist_mm,
        'gap_mm': dist_mm,
        'gap_ok': gap_ok,
        'upper_resin_px': upper_px,
        'upper_resin_mm': upper_mm,
        'upper_ok': upper_ok,
        'lower_resin_px': lower_px,
        'lower_resin_mm': lower_mm,
        'lower_ok': lower_ok,
        'theta_housing_deg': float(theta_housing_deg),
        'v_axial': v_axial.tolist(),
        'n_transverse': n_transverse.tolist(),
        'min_resin_upper_mm': min_resin_upper,
        'min_resin_lower_mm': min_resin_lower,
        'scale_mm_per_pixel': scale,
        'drawing_min_mm': min_mm, 'drawing_max_mm': max_mm,
        'jig_offset_mm': jig_offset,
        'effective_min_mm': effective_min, 'effective_max_mm': effective_max,
        'judgement': judgement,
        'confidence': float(best_score),
        'point_a_confidence': float(cka),
        'point_b_confidence': float(ckb),
        'scan_y_full': scan_y,
        'fallback_used': False,
        'note': 'YOLO Pose 4-Keypoint (Gap + Upper + Lower Resin Thickness with Housing Tilt Alignment)' if has_4kp else 'YOLO keypoint detects Point A and Point B; OpenCV calculates distance and draws overlay.'
    }

def draw_outputs(img, crop_raw, crop_proc, result, out_result, out_debug=None, out_preprocessed=None, out_profile=None):
    vis=img.copy()
    x=result['crop']['x']; y=result['crop']['y']; w=result['crop']['w']; h=result['crop']['h']
    pa_full=(int(round(result['point_a_full'][0])), int(round(result['point_a_full'][1])))
    pb_full=(int(round(result['point_b_full'][0])), int(round(result['point_b_full'][1])))
    pa_crop=(int(round(result['point_a_crop'][0])), int(round(result['point_a_crop'][1])))
    pb_crop=(int(round(result['point_b_crop'][0])), int(round(result['point_b_crop'][1])))
    color=(0,200,0) if result['judgement']=='OK' else (0,0,255)
    cv2.rectangle(vis,(x,y),(x+w,y+h),(255,120,0),2)

    has_4kp = result.get('has_4_keypoints', False) and result.get('point_c_full') is not None
    if 'scan_y_full' in result and not has_4kp:
        cv2.line(vis,(x,int(result['scan_y_full'])),(x+w,int(result['scan_y_full'])),(0,255,255),1)

    if has_4kp:
        pc_full = (int(round(result['point_c_full'][0])), int(round(result['point_c_full'][1])))
        pd_full = (int(round(result['point_d_full'][0])), int(round(result['point_d_full'][1])))

        if result.get('p_pin_top_full') is not None and result.get('p_pin_bot_full') is not None:
            p_pin_top = (int(round(result['p_pin_top_full'][0])), int(round(result['p_pin_top_full'][1])))
            p_pin_bot = (int(round(result['p_pin_bot_full'][0])), int(round(result['p_pin_bot_full'][1])))
        else:
            p_pin_top = (pb_full[0], pb_full[1] - 6)
            p_pin_bot = (pb_full[0], pb_full[1] + 6)

        c_red = (0, 0, 255)
        # 1. Garis Gap Horizontal: dari Dinding Datum ke Ujung Maju Pin IC (Persis Gambar 4)
        cv2.line(vis, pa_full, pb_full, c_red, 3, cv2.LINE_AA)

        # 2. Garis Resin Atas: dari Permukaan Atas Pin ke Tepi Luar Atas Resin (Persis Gambar 4)
        cv2.line(vis, p_pin_top, pc_full, c_red, 3, cv2.LINE_AA)

        # 3. Garis Resin Bawah: dari Permukaan Bawah Pin ke Tepi Luar Bawah Resin (Persis Gambar 4)
        cv2.line(vis, p_pin_bot, pd_full, c_red, 3, cv2.LINE_AA)

        # CATATAN: Badan Pin IC di antara p_pin_top dan p_pin_bot TIDAK DILEWATI GARIS (Persis Gambar 4)

        # End-caps / ticks presisi
        v_ax = np.array(result.get('v_axial', [1.0, 0.0]), dtype=float)
        n_tr = np.array(result.get('n_transverse', [0.0, 1.0]), dtype=float)
        cap_len = 8

        # Ticks hijau di tepi resin atas & bawah sejajar sumbu aksial
        for pt_cap in [pc_full, pd_full]:
            c1 = (int(round(pt_cap[0] - cap_len * v_ax[0])), int(round(pt_cap[1] - cap_len * v_ax[1])))
            c2 = (int(round(pt_cap[0] + cap_len * v_ax[0])), int(round(pt_cap[1] + cap_len * v_ax[1])))
            cv2.line(vis, c1, c2, (0, 255, 0), 2, cv2.LINE_AA)

        # Tick di dinding datum sejajar sumbu transversal
        c1_w = (int(round(pa_full[0] - cap_len * n_tr[0])), int(round(pa_full[1] - cap_len * n_tr[1])))
        c2_w = (int(round(pa_full[0] + cap_len * n_tr[0])), int(round(pa_full[1] + cap_len * n_tr[1])))
        cv2.line(vis, c1_w, c2_w, (0, 255, 255), 2, cv2.LINE_AA)

        label1 = f"{result['judgement']} | Gap: {result['distance_mm']:.3f} mm"
        cv2.putText(vis, label1, (pb_full[0] + 15, pb_full[1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2, cv2.LINE_AA)

        label2 = f"Up: {result.get('upper_resin_mm', 0):.3f}mm | Dn: {result.get('lower_resin_mm', 0):.3f}mm"
        cv2.putText(vis, label2, (pb_full[0] + 15, pc_full[1] + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 255), 2, cv2.LINE_AA)

        tilt_deg = result.get('theta_housing_deg', 0.0)
        tilt_str = f"Tilt: {tilt_deg:+.2f} deg" if abs(tilt_deg) > 0.05 else "Tilt: 0.00 deg (Kotak Luar Lurus)"
        cv2.putText(vis, tilt_str, (pb_full[0] - 80, pd_full[1] + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 200, 100), 2, cv2.LINE_AA)
    else:
        cv2.line(vis,pa_full,pb_full,color,3)
        cv2.circle(vis,pa_full,5,(255,0,0),-1); cv2.circle(vis,pb_full,5,(255,0,255),-1)
        method=result.get('method','opencv_auto_anchor')
        label=f"{result['judgement']} {result['distance_mm']:.3f} mm | {result['distance_px']:.1f}px | {method}"
        cv2.putText(vis,label,(pa_full[0],max(25,pa_full[1]-25)),cv2.FONT_HERSHEY_SIMPLEX,0.75,color,2,cv2.LINE_AA)

    if 'confidence' in result and not has_4kp:
        cv2.putText(vis,f"conf {result['confidence']:.2f}",(pa_full[0],min(vis.shape[0]-10,pa_full[1]+30)),cv2.FONT_HERSHEY_SIMPLEX,0.55,color,2,cv2.LINE_AA)
    if out_result.lower().endswith('.jpg') or out_result.lower().endswith('.jpeg'):
        cv2.imwrite(out_result, vis, [cv2.IMWRITE_JPEG_QUALITY, 90])
    else:
        cv2.imwrite(out_result, vis)

    if out_debug is not None:
        dbg=cv2.cvtColor(crop_proc,cv2.COLOR_GRAY2BGR)
        if 'scan_y_crop' in result:
            sy=int(result['scan_y_crop'])
        else:
            sy=int(round((pa_crop[1]+pb_crop[1])/2))
        cv2.line(dbg,(0,sy),(dbg.shape[1]-1,sy),(0,255,255),1)
        if result.get('method') == 'yolo_keypoint':
            if has_4kp and result.get('point_c_crop') is not None:
                pc_crop=(int(round(result['point_c_crop'][0])), int(round(result['point_c_crop'][1])))
                pd_crop=(int(round(result['point_d_crop'][0])), int(round(result['point_d_crop'][1])))
                cv2.line(dbg, pa_crop, pb_crop, color, 3)
                cv2.line(dbg, pb_crop, pc_crop, (0, 255, 255), 2)
                cv2.line(dbg, pb_crop, pd_crop, (0, 255, 255), 2)
                cv2.circle(dbg, pa_crop, 5, (0, 0, 255), -1)
                cv2.circle(dbg, pb_crop, 5, (255, 0, 0), -1)
                cv2.circle(dbg, pc_crop, 5, (0, 255, 255), -1)
                cv2.circle(dbg, pd_crop, 5, (0, 255, 255), -1)
                cv2.putText(dbg,'YOLO 4-KP: Red=Tip, Blue=Datum, Cyan=Resin',(10,25),cv2.FONT_HERSHEY_SIMPLEX,0.52,(255,255,255),2,cv2.LINE_AA)
            else:
                cv2.line(dbg,pa_crop,pb_crop,color,3)
                cv2.circle(dbg,pa_crop,5,(255,0,0),-1)
                cv2.circle(dbg,pb_crop,5,(255,0,255),-1)
                cv2.putText(dbg,'YOLO Keypoint: blue=A magenta=B',(10,25),cv2.FONT_HERSHEY_SIMPLEX,0.55,(255,255,255),2,cv2.LINE_AA)
        else:
            sx=result['search_x']['start_crop']; ex=result['search_x']['end_crop']
            cv2.rectangle(dbg,(sx,max(0,sy-18)),(ex,min(dbg.shape[0]-1,sy+18)),(255,120,0),1)
            ds=result['dark_run_crop']['start']; de=result['dark_run_crop']['end']
            cv2.line(dbg,(ds,sy+8),(de,sy+8),(255,0,255),3)
            be=result['bright_edge_crop']
            cv2.circle(dbg,(be,sy),4,(255,0,0),-1)
            cv2.line(dbg,pa_crop,pb_crop,color,3)
            cv2.circle(dbg,pa_crop,4,(255,0,0),-1); cv2.circle(dbg,pb_crop,4,(255,0,255),-1)
        cv2.imwrite(out_debug, dbg)

    if out_preprocessed is not None:
        cv2.imwrite(out_preprocessed, crop_proc)

    # Profile chart only if requested and applicable
    if out_profile is not None:
        if '_profile' in result:
            prof=np.array(result['_profile'], dtype=np.float32)
            sx,ex=result['_search_segment']
            chart_w=max(600, len(prof)); chart_h=260
            chart=np.full((chart_h, chart_w, 3), 255, dtype=np.uint8)
            p=cv2.resize(prof.reshape(1,-1), (chart_w,1), interpolation=cv2.INTER_LINEAR).flatten()
            mn,mx=float(p.min()),float(p.max())
            if mx-mn < 1e-6: mx=mn+1
            pts=[]
            for i,v in enumerate(p):
                yy=int((1-(v-mn)/(mx-mn))*(chart_h-40))+20
                pts.append((i,yy))
            for i in range(1,len(pts)):
                cv2.line(chart,pts[i-1],pts[i],(40,40,40),1)
            def mapx(xx): return int(xx / max(1,len(prof)-1) * (chart_w-1))
            for xx,col,label in [
                (sx,(255,120,0),'search start'),(ex,(255,120,0),'search end'),
                (result['bright_edge_crop'],(255,0,0),'bright edge'),
                (result['dark_run_crop']['start'],(255,0,255),'dark start'),
                (result['point_a_crop'][0],(0,160,0),'measure A'),
                (result['point_b_crop'][0],(0,160,0),'measure B')
            ]:
                cx=mapx(xx); cv2.line(chart,(cx,0),(cx,chart_h-1),col,1)
                cv2.putText(chart,label,(min(cx+3,chart_w-120),18),cv2.FONT_HERSHEY_SIMPLEX,0.38,col,1,cv2.LINE_AA)
            cv2.putText(chart,'Horizontal intensity profile after preprocessing',(10,chart_h-10),cv2.FONT_HERSHEY_SIMPLEX,0.5,(0,0,0),1,cv2.LINE_AA)
            cv2.imwrite(out_profile, chart)
        else:
            chart=np.full((220, 720, 3), 255, dtype=np.uint8)
            cv2.putText(chart,'YOLO keypoint mode: profile chart not used.',(30,100),cv2.FONT_HERSHEY_SIMPLEX,0.8,(0,0,0),2,cv2.LINE_AA)
            cv2.imwrite(out_profile, chart)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--output-dir', required=True)
    ap.add_argument('--config', required=True)
    ap.add_argument('--log-dir', default=None)
    args=ap.parse_args()
    cfg=read_config(args.config)
    ensure_dir(args.output_dir)
    if args.log_dir: ensure_dir(args.log_dir)
    img=cv2.imread(args.input)
    if img is None: raise RuntimeError(f'Cannot read image: {args.input}')
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    x,y,w,h=detect_xray_crop(gray,cfg)
    crop_raw=gray[y:y+h,x:x+w]
    crop_proc=apply_preprocessing(crop_raw,cfg)
    try:
        method = cfg.get('measurement_method', 'opencv_auto_anchor')
        ai = cfg.get('ai_model', {})
        if method == 'yolo_keypoint' and ai.get('enabled', True):
            try:
                res = measure_yolo_keypoint(img, crop_raw, crop_proc, x, y, cfg, args.config)
            except Exception as ai_err:
                if ai.get('fallback_to_opencv', True):
                    res = measure(crop_proc, x, y, cfg)
                    res['method'] = 'opencv_auto_anchor_fallback'
                    res['fallback_used'] = True
                    res['fallback_from'] = 'yolo_keypoint'
                    res['fallback_to'] = 'opencv_auto_anchor'
                    res['fallback_reason'] = 'AI keypoint failed or confidence below threshold'
                    res['ai_error'] = str(ai_err)
                else:
                    raise
        else:
            res = measure(crop_proc,x,y,cfg)
            res['method'] = 'opencv_auto_anchor'
            res['fallback_used'] = False
        base=Path(args.input).stem
        result_name=f'{base}_result.png'
        debug_name=f'{base}_debug_roi.png'
        prep_name=f'{base}_preprocessed_crop.png'
        profile_name=f'{base}_profile.png'
        result_path=str(Path(args.output_dir)/result_name)
        debug_path=str(Path(args.output_dir)/debug_name)
        prep_path=str(Path(args.output_dir)/prep_name)
        profile_path=str(Path(args.output_dir)/profile_name)
        draw_outputs(img,crop_raw,crop_proc,res,result_path,debug_path,prep_path,profile_path)
        # Remove large internal arrays from API response.
        res.pop('_profile', None); res.pop('_band', None); res.pop('_search_segment', None)
        res.update({'status':'success','input_file':Path(args.input).name,'result_image':result_name,'debug_image':debug_name,'preprocessed_image':prep_name,'profile_image':profile_name})
        if args.log_dir:
            log_path=Path(args.log_dir)/'measurement_log.csv'
            new=not log_path.exists()
            # ── CSV Log: semua 6 metrik 4-Keypoint ─────────────────────────
            fields_4kp = [
                'time','input_file','method',
                'gap_mm','gap_ok',
                'upper_resin_mm','upper_ok',
                'lower_resin_mm','lower_ok',
                'distance_px','judgement','confidence',
                'scan_y_full','point_a_full','point_b_full',
                'point_c_full','point_d_full',
            ]
            with open(log_path,'a',newline='',encoding='utf-8') as f:
                wr=csv.DictWriter(f, fieldnames=fields_4kp, extrasaction='ignore')
                if new: wr.writeheader()
                wr.writerow({
                    'time':            time.strftime('%Y-%m-%d %H:%M:%S'),
                    'input_file':      res['input_file'],
                    'method':          res.get('method',''),
                    'gap_mm':          res.get('gap_mm', res.get('distance_mm','')),
                    'gap_ok':          res.get('gap_ok',''),
                    'upper_resin_mm':  res.get('upper_resin_mm',''),
                    'upper_ok':        res.get('upper_ok',''),
                    'lower_resin_mm':  res.get('lower_resin_mm',''),
                    'lower_ok':        res.get('lower_ok',''),
                    'distance_px':     res.get('distance_px',''),
                    'judgement':       res['judgement'],
                    'confidence':      res.get('confidence',''),
                    'scan_y_full':     res.get('scan_y_full',''),
                    'point_a_full':    res.get('point_a_full',''),
                    'point_b_full':    res.get('point_b_full',''),
                    'point_c_full':    res.get('point_c_full',''),
                    'point_d_full':    res.get('point_d_full',''),
                })
        save_json(res)
    except Exception as e:
        save_json({'status':'error','input_file':Path(args.input).name,'error':str(e)})
        sys.exit(2)

if __name__=='__main__':
    main()
