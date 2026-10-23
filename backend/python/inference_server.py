"""
inference_server.py — AIXRay FastAPI Inference Sidecar
=======================================================
Model YOLO di-load SEKALI saat startup dan tetap di-RAM.
Setiap request process/jig langsung dieksekusi tanpa cold-start.

Port default : 5001 (internal, hanya diakses oleh server.js)
"""

import argparse
import csv
import sys
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ── Pastikan auto_anchor_measure & jig_measure bisa di-import ────────────────
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from auto_anchor_measure import (
    apply_preprocessing,
    detect_housing_tilt_and_measure,
    detect_xray_crop,
    draw_outputs,
    ensure_dir,
    find_outer_resin_edge,
    measure,
    read_config,
)
from jig_measure import (
    detect_jig_vertical,
    draw_jig_overlay,
)

# ── Global Model Cache ───────────────────────────────────────────────────────
_model = None
_model_path: str = ""

app = FastAPI(title="AIXRay Inference Server", version="1.0.0")


# ── Helpers ──────────────────────────────────────────────────────────────────

# ── OS & CPU Scheduling Optimization (Windows 11 Hybrid Intel Architecture) ────
import os
import sys
import torch

# 1. Hindari Intel OpenMP busy-waiting spin loop yang berebut CPU dengan browser
os.environ["KMP_BLOCKTIME"] = "0"
os.environ["OMP_WAIT_POLICY"] = "PASSIVE"

# 2. PyTorch num_threads di-set ke 6 P-cores
try:
    torch.set_num_threads(6)
except Exception:
    pass

# 3. Nonaktifkan Windows 11 PowerThrottling / EcoQoS via Win32 API
if sys.platform == "win32":
    try:
        import ctypes
        from ctypes import wintypes
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        kernel32.SetProcessInformation.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        kernel32.SetProcessInformation.restype = wintypes.BOOL

        class PROCESS_POWER_THROTTLING_STATE(ctypes.Structure):
            _fields_ = [
                ("Version", wintypes.DWORD),
                ("ControlMask", wintypes.DWORD),
                ("StateMask", wintypes.DWORD),
            ]

        power_throttling = PROCESS_POWER_THROTTLING_STATE()
        power_throttling.Version = 1
        power_throttling.ControlMask = 0x1  # PROCESS_POWER_THROTTLING_EXECUTION_SPEED
        power_throttling.StateMask = 0      # 0 = Off (HighQoS / Maximum Speed)

        kernel32.SetProcessInformation(
            kernel32.GetCurrentProcess(),
            4,
            ctypes.byref(power_throttling),
            ctypes.sizeof(power_throttling)
        )
        print("[InferenceServer] Windows PowerThrottling/EcoQoS disabled successfully", flush=True)
    except Exception as e:
        print(f"[InferenceServer] PowerThrottling disable warning: {e}", flush=True)

# 4. Kunci Priority ke HIGH dan kunci CPU Affinity ke P-Cores
try:
    import psutil
    proc = psutil.Process()
    proc.nice(psutil.HIGH_PRIORITY_CLASS)
    if psutil.cpu_count(logical=True) >= 12:
        proc.cpu_affinity(list(range(12)))
    print("[InferenceServer] Process priority set to HIGH & pinned to P-Cores", flush=True)
except Exception as p_err:
    print(f"[InferenceServer] Priority/Affinity warning: {p_err}", flush=True)

def _normalize_model_path(p: str) -> str:
    if not p:
        return ""
    try:
        return str(Path(p).resolve()).lower().replace("/", "\\")
    except Exception:
        return str(p).lower().replace("/", "\\")


def _resolve_model_path(model_path: str, config_path: str) -> str:
    if not model_path:
        return ""
    p = Path(model_path)
    if p.is_absolute():
        return str(p)
    return str((Path(config_path).parent / p).resolve())


def _load_model(model_path: str, warmup: bool = True):
    """Load YOLO ke cache. Reuse jika path sama — tidak reload ulang."""
    global _model, _model_path
    norm_target = _normalize_model_path(model_path)
    if _model is not None:
        # Jika model sudah ada di RAM dan nama file sama, langsung reuse tanpa reload!
        if _model_path == norm_target or Path(_model_path).name == Path(norm_target).name:
            return _model

    try:
        from ultralytics import YOLO  # import di sini agar tidak block startup
        print(f"[InferenceServer] Loading model: {model_path}", flush=True)
        t0 = time.time()
        _model = YOLO(model_path)
        _model_path = norm_target
        print(f"[InferenceServer] Model loaded in {time.time() - t0:.2f}s", flush=True)

        if warmup:
            try:
                print("[InferenceServer] Pre-warming up PyTorch JIT graph...", flush=True)
                tw = time.time()
                dummy = np.zeros((640, 640, 3), dtype=np.uint8)
                with torch.inference_mode():
                    _ = _model.predict(dummy, imgsz=640, conf=0.35, verbose=False, device="cpu")
                print(f"[InferenceServer] Model warmed up in {time.time() - tw:.2f}s", flush=True)
            except Exception as w_err:
                print(f"[InferenceServer] Warmup warning: {w_err}", flush=True)

        return _model
    except Exception as exc:
        _model = None
        _model_path = ""
        raise RuntimeError(f"Gagal load model: {exc}") from exc


def _run_yolo_inference(model, img_bgr, crop_raw_gray, crop_proc_gray, x0, y0, cfg, config_path):
    """
    Inferensi YOLO dengan model yang sudah di-cache.
    Logika identik dengan measure_yolo_keypoint() di auto_anchor_measure.py,
    hanya tidak memanggil YOLO() ulang.
    """
    ai = cfg.get("ai_model", {})

    input_mode = str(ai.get("input_mode", "full_raw")).lower()
    use_prep   = ai.get("use_preprocessed_crop", False)

    if input_mode == "full_raw" or (not use_prep and input_mode != "crop_raw"):
        infer_img = img_bgr
        is_full   = True
    elif input_mode == "crop_raw" or not use_prep:
        infer_img = cv2.cvtColor(crop_raw_gray, cv2.COLOR_GRAY2BGR)
        is_full   = False
    else:
        infer_img = cv2.cvtColor(crop_proc_gray, cv2.COLOR_GRAY2BGR)
        is_full   = False

    conf_th     = float(ai.get("confidence_threshold", 0.35))
    kpt_conf_th = float(ai.get("keypoint_confidence_threshold", 0.25))
    device      = ai.get("device", "cpu")

    with torch.inference_mode():
        results = model.predict(infer_img, imgsz=640, conf=conf_th, verbose=False, device=device)
    if not results:
        raise RuntimeError("YOLO tidak menghasilkan result.")
    r = results[0]
    if r.keypoints is None or len(r.keypoints) == 0:
        raise RuntimeError(
            "Keypoint tidak terdeteksi. Coba confidence lebih rendah atau model lain."
        )

    kp_xy   = r.keypoints.xy.cpu().numpy()
    kp_conf = (
        r.keypoints.conf.cpu().numpy()
        if getattr(r.keypoints, "conf", None) is not None
        else None
    )
    boxes_conf = (
        r.boxes.conf.cpu().numpy()
        if r.boxes is not None and len(r.boxes) > 0
        else np.ones((kp_xy.shape[0],), dtype=np.float32)
    )

    idx_a = int(ai.get("point_a_index", 0))
    idx_b = int(ai.get("point_b_index", 1))
    best_i, best_score = None, -1.0

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
        raise RuntimeError(
            "Keypoint A/B confidence terlalu rendah. Turunkan keypoint_confidence_threshold."
        )

    has_4kp = kp_xy.shape[1] >= 4
    if has_4kp:
        pa  = kp_xy[best_i, 0].astype(float)  # KP1: IC Tip
        pb  = kp_xy[best_i, 1].astype(float)  # KP2: Datum
        pc  = kp_xy[best_i, 2].astype(float)  # KP3: Upper Resin
        pd  = kp_xy[best_i, 3].astype(float)  # KP4: Lower Resin
        cka = float(kp_conf[best_i, 0]) if kp_conf is not None else 1.0
        ckb = float(kp_conf[best_i, 1]) if kp_conf is not None else 1.0
        ckc = float(kp_conf[best_i, 2]) if kp_conf is not None else 1.0
        ckd = float(kp_conf[best_i, 3]) if kp_conf is not None else 1.0
    else:
        pa  = kp_xy[best_i, idx_a].astype(float)
        pb  = kp_xy[best_i, idx_b].astype(float)
        pc  = None
        pd  = None
        cka = float(kp_conf[best_i, idx_a]) if kp_conf is not None else 1.0
        ckb = float(kp_conf[best_i, idx_b]) if kp_conf is not None else 1.0
        ckc = None
        ckd = None

    # ── Pastikan pa di kiri (Datum Wall) dan pb di kanan (Sudut Maju Ujung IC) ──
    if ai.get("swap_points_if_needed", True) and pa[0] > pb[0]:
        pa, pb = pb.copy(), pa.copy()
        cka, ckb = ckb, cka

    # ── Pengukuran Presisi Mengikuti Kemiringan Kotak Luar (Housing Tilt Angle) ──
    theta_housing_deg = 0.0
    v_axial = np.array([1.0, 0.0], dtype=float)
    n_transverse = np.array([0.0, 1.0], dtype=float)

    if has_4kp and pc is not None and pd is not None:
        meas = detect_housing_tilt_and_measure(img_bgr, pa, pb, pc, pd, cfg)
        pa = meas["p_wall"]
        pb = meas["p_tip"]
        pc = meas["p_upper"]
        pd = meas["p_lower"]
        p_pin_top = meas["p_pin_top"]
        p_pin_bot = meas["p_pin_bot"]
        dist_px = meas["dist_px"]
        upper_px = meas["upper_px"]
        lower_px = meas["lower_px"]
        theta_housing_deg = meas["theta_housing_deg"]
        v_axial = meas["v_axial"]
        n_transverse = meas["n_transverse"]
    else:
        if ai.get("force_horizontal_line", True):
            pa[1] = pb[1]
        dist_px = float(np.linalg.norm(pb - pa))
        if ai.get("horizontal_distance_only", True):
            dist_px = abs(float(pb[0] - pa[0]))
        upper_px = 0.0
        lower_px = 0.0
        p_pin_top = pb
        p_pin_bot = pb

    scale       = float(cfg.get("scale_mm_per_pixel", 0.05))
    dist_mm     = dist_px * scale
    std         = cfg.get("standard", {})
    min_mm      = float(std.get("min_distance_mm", 0.75))
    max_mm      = float(std.get("max_distance_mm", 1.70))
    jig_offset  = float(std.get("jig_offset_mm", 0.0))
    eff_min     = min_mm + jig_offset
    eff_max     = max_mm - jig_offset
    gap_ok      = eff_min <= dist_mm <= eff_max

    min_resin_upper = float(std.get("min_resin_upper_mm", std.get("min_resin_thickness_mm", 0.20)))
    min_resin_lower = float(std.get("min_resin_lower_mm", std.get("min_resin_thickness_mm", 0.20)))

    if has_4kp and pc is not None and pd is not None:
        upper_mm = float(upper_px * scale)
        lower_mm = float(lower_px * scale)
        upper_ok = upper_mm >= min_resin_upper
        lower_ok = lower_mm >= min_resin_lower
        judgement = "OK" if (gap_ok and upper_ok and lower_ok) else "NG"
    else:
        upper_mm = 0.0
        lower_mm = 0.0
        upper_ok = True
        lower_ok = True
        judgement = "OK" if gap_ok else "NG"

    model_path_str = _resolve_model_path(ai.get("model_path", ""), config_path)

    if is_full:
        pa_full  = [float(pa[0]),        float(pa[1])]
        pb_full  = [float(pb[0]),        float(pb[1])]
        pa_crop  = [float(pa[0] - x0),   float(pa[1] - y0)]
        pb_crop  = [float(pb[0] - x0),   float(pb[1] - y0)]
        pc_full  = [float(pc[0]),        float(pc[1])] if pc is not None else None
        pd_full  = [float(pd[0]),        float(pd[1])] if pd is not None else None
        pc_crop  = [float(pc[0] - x0),   float(pc[1] - y0)] if pc is not None else None
        pd_crop  = [float(pd[0] - x0),   float(pd[1] - y0)] if pd is not None else None
        p_pin_top_full = [float(p_pin_top[0]), float(p_pin_top[1])] if p_pin_top is not None else None
        p_pin_bot_full = [float(p_pin_bot[0]), float(p_pin_bot[1])] if p_pin_bot is not None else None
        p_pin_top_crop = [float(p_pin_top[0] - x0), float(p_pin_top[1] - y0)] if p_pin_top is not None else None
        p_pin_bot_crop = [float(p_pin_bot[0] - x0), float(p_pin_bot[1] - y0)] if p_pin_bot is not None else None
        scan_y   = int(pb[1])
    else:
        pa_crop  = [float(pa[0]),         float(pa[1])]
        pb_crop  = [float(pb[0]),         float(pb[1])]
        pa_full  = [float(x0 + pa[0]),    float(y0 + pa[1])]
        pb_full  = [float(x0 + pb[0]),    float(y0 + pb[1])]
        pc_crop  = [float(pc[0]),         float(pc[1])] if pc is not None else None
        pd_crop  = [float(pd[0]),         float(pd[1])] if pd is not None else None
        pc_full  = [float(x0 + pc[0]),    float(y0 + pc[1])] if pc is not None else None
        pd_full  = [float(x0 + pd[0]),    float(y0 + pd[1])] if pd is not None else None
        p_pin_top_crop = [float(p_pin_top[0]), float(p_pin_top[1])] if p_pin_top is not None else None
        p_pin_bot_crop = [float(p_pin_bot[0]), float(p_pin_bot[1])] if p_pin_bot is not None else None
        p_pin_top_full = [float(x0 + p_pin_top[0]), float(y0 + p_pin_top[1])] if p_pin_top is not None else None
        p_pin_bot_full = [float(x0 + p_pin_bot[0]), float(y0 + p_pin_bot[1])] if p_pin_bot is not None else None
        scan_y   = int(y0 + pb[1])

    return {
        "method":                 "yolo_keypoint",
        "model_path":             model_path_str,
        "crop":                   {"x": int(x0), "y": int(y0), "w": int(crop_raw_gray.shape[1]), "h": int(crop_raw_gray.shape[0])},
        "point_a_crop":           pa_crop,
        "point_b_crop":           pb_crop,
        "point_c_crop":           pc_crop,
        "point_d_crop":           pd_crop,
        "point_a_full":           pa_full,
        "point_b_full":           pb_full,
        "point_c_full":           pc_full,
        "point_d_full":           pd_full,
        "p_pin_top_full":         p_pin_top_full,
        "p_pin_bot_full":         p_pin_bot_full,
        "p_pin_top_crop":         p_pin_top_crop,
        "p_pin_bot_crop":         p_pin_bot_crop,
        "has_4_keypoints":        has_4kp,
        "distance_px":            dist_px,
        "distance_mm":            dist_mm,
        "gap_mm":                 dist_mm,
        "gap_ok":                 gap_ok,
        "upper_resin_px":         upper_px,
        "upper_resin_mm":         upper_mm,
        "upper_ok":               upper_ok,
        "lower_resin_px":         lower_px,
        "lower_resin_mm":         lower_mm,
        "lower_ok":               lower_ok,
        "theta_housing_deg":      float(theta_housing_deg),
        "v_axial":                v_axial.tolist(),
        "n_transverse":           n_transverse.tolist(),
        "min_resin_upper_mm":     min_resin_upper,
        "min_resin_lower_mm":     min_resin_lower,
        "scale_mm_per_pixel":     scale,
        "drawing_min_mm":         min_mm,
        "drawing_max_mm":         max_mm,
        "jig_offset_mm":          jig_offset,
        "effective_min_mm":       eff_min,
        "effective_max_mm":       eff_max,
        "judgement":              judgement,
        "confidence":             float(best_score),
        "point_a_confidence":     float(cka),
        "point_b_confidence":     float(ckb),
        "scan_y_full":            scan_y,
        "fallback_used":          False,
        "note":                   "YOLO Pose 4-Keypoint (Gap + Upper + Lower Resin Thickness with Housing Tilt Alignment)" if has_4kp else "YOLO keypoint detects Point A and Point B; OpenCV calculates distance and draws overlay.",
    }


def _append_log(log_dir: str, res: dict):
    log_path = Path(log_dir) / "measurement_log.csv"
    is_new   = not log_path.exists()
    fields   = [
        "time", "input_file", "method", "distance_px", "distance_mm",
        "judgement", "confidence", "scan_y_full", "point_a_full", "point_b_full",
    ]
    with open(log_path, "a", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=fields)
        if is_new:
            wr.writeheader()
        wr.writerow({
            "time":          time.strftime("%Y-%m-%d %H:%M:%S"),
            "input_file":    res["input_file"],
            "method":        res.get("method", ""),
            "distance_px":   res["distance_px"],
            "distance_mm":   res["distance_mm"],
            "judgement":     res["judgement"],
            "confidence":    res.get("confidence", ""),
            "scan_y_full":   res.get("scan_y_full", ""),
            "point_a_full":  res["point_a_full"],
            "point_b_full":  res["point_b_full"],
        })


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class ProcessRequest(BaseModel):
    input_path:  str
    output_dir:  str
    config_path: str
    log_dir:     Optional[str] = None


class JigRequest(BaseModel):
    input_path:  str
    output_dir:  str
    config_path: str


class ReloadRequest(BaseModel):
    model_path: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "ok":           True,
        "model_loaded": _model is not None,
        "model_path":   _model_path,
    }


@app.post("/reload-model")
def reload_model(req: ReloadRequest):
    """Dipanggil oleh server.js setelah user upload model baru."""
    global _model, _model_path
    _model      = None
    _model_path = ""
    try:
        _load_model(req.model_path)
        return {"ok": True, "model_path": req.model_path}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.on_event("startup")
def on_startup():
    """Preload dan warmup model saat server pertama kali diaktifkan agar st1 tidak lag."""
    default_model = Path(SCRIPT_DIR).parent / "models" / "best.pt"
    if default_model.exists():
        try:
            _load_model(str(default_model), warmup=True)
        except Exception as exc:
            print(f"[InferenceServer] Startup warmup warning: {exc}", flush=True)


@app.post("/process")
def process_image(req: ProcessRequest):
    """Proses gambar X-Ray — model sudah di-RAM, tidak perlu load ulang."""
    t_start = time.perf_counter()
    try:
        cfg = read_config(req.config_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Gagal baca config: {exc}")

    ensure_dir(req.output_dir)
    if req.log_dir:
        ensure_dir(req.log_dir)

    img = cv2.imread(req.input_path)
    if img is None:
        raise HTTPException(status_code=400, detail=f"Tidak bisa baca gambar: {req.input_path}")

    gray     = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    x, y, w, h = detect_xray_crop(gray, cfg)
    crop_raw  = gray[y: y + h, x: x + w]
    crop_proc = apply_preprocessing(crop_raw, cfg)

    ai     = cfg.get("ai_model", {})
    method = cfg.get("measurement_method", "opencv_auto_anchor")

    try:
        if method == "yolo_keypoint" and ai.get("enabled", True):
            try:
                model_path = _resolve_model_path(ai.get("model_path", ""), req.config_path)
                if not model_path or not Path(model_path).exists():
                    raise RuntimeError(f"Model tidak ditemukan: {model_path}")
                model = _load_model(model_path, warmup=False)
                res   = _run_yolo_inference(model, img, crop_raw, crop_proc, x, y, cfg, req.config_path)
            except Exception as ai_err:
                if ai.get("fallback_to_opencv", True):
                    res = measure(crop_proc, x, y, cfg)
                    res["method"]          = "opencv_auto_anchor_fallback"
                    res["fallback_used"]   = True
                    res["fallback_from"]   = "yolo_keypoint"
                    res["fallback_to"]     = "opencv_auto_anchor"
                    res["fallback_reason"] = "AI keypoint failed or confidence below threshold"
                    res["ai_error"]        = str(ai_err)
                else:
                    raise HTTPException(status_code=500, detail=str(ai_err))
        else:
            res = measure(crop_proc, x, y, cfg)
            res["method"]        = "opencv_auto_anchor"
            res["fallback_used"] = False

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    base   = Path(req.input_path).stem
    fmt = str(cfg.get("storage", {}).get("image_format", "jpg")).lower()
    ext = "jpg" if fmt in ["jpg", "jpeg"] else "png"
    result_name = f"{base}_result.{ext}"
    result_path = str(Path(req.output_dir) / result_name)
    
    # Hanya generate dan simpan overlay gambar visualisasi yang dibutuhkan viewport UI (Fast JPEG quality 90)
    draw_outputs(img, crop_raw, crop_proc, res, result_path)

    res.pop("_profile",        None)
    res.pop("_band",           None)
    res.pop("_search_segment", None)

    ct_sec = round(time.perf_counter() - t_start, 3)

    res.update({
        "status":              "success",
        "input_file":          Path(req.input_path).name,
        "result_image":        result_name,
        "debug_image":         result_name,
        "preprocessed_image":  result_name,
        "profile_image":       result_name,
        "ct_sec":              ct_sec,
    })

    if req.log_dir:
        _append_log(req.log_dir, res)

    return res


@app.post("/jig-measure")
def jig_measure_endpoint(req: JigRequest):
    """Kalibrasi jig — tidak membutuhkan YOLO, tetap di-sidecar untuk zero spawn overhead."""
    try:
        cfg = read_config(req.config_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Gagal baca config: {exc}")

    jig_real_mm = float(cfg.get("jig_calibration", {}).get("jig_real_mm", 0))
    if jig_real_mm <= 0:
        raise HTTPException(
            status_code=400,
            detail="jig_real_mm belum diset. Isi ukuran fisik jig (mm) di Settings.",
        )

    ensure_dir(req.output_dir)
    img = cv2.imread(req.input_path)
    if img is None:
        raise HTTPException(status_code=400, detail=f"Tidak bisa baca gambar: {req.input_path}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    try:
        jig_top, jig_bottom, jig_height_px, profile, info = detect_jig_vertical(gray, cfg)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    scale_mm_per_pixel = jig_real_mm / jig_height_px
    base         = Path(req.input_path).stem
    overlay_name = f"jig_{base}_overlay.png"
    overlay_path = str(Path(req.output_dir) / overlay_name)
    draw_jig_overlay(
        img, jig_top, jig_bottom, jig_height_px,
        scale_mm_per_pixel, jig_real_mm,
        info["scan_x_range"], overlay_path,
    )

    return {
        "status":               "success",
        "input_file":           Path(req.input_path).name,
        "overlay_image":        overlay_name,
        "jig_top_px":           int(jig_top),
        "jig_bottom_px":        int(jig_bottom),
        "jig_height_px":        int(jig_height_px),
        "jig_real_mm":          float(jig_real_mm),
        "scale_mm_per_pixel":   float(scale_mm_per_pixel),
        "scan_x_range":         info["scan_x_range"],
        "jig_core_intensity":   info.get("jig_core_intensity"),
        "background_intensity": info.get("background_intensity"),
        "threshold_used":       info.get("threshold_used"),
        "note":                 "Jig calibration berhasil. scale_mm_per_pixel otomatis tersimpan ke config.",
    }


# ── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AIXRay FastAPI Inference Server")
    parser.add_argument("--host",          default="127.0.0.1")
    parser.add_argument("--port",          type=int, default=5001)
    parser.add_argument("--preload-model", default="",
                        help="Path model YOLO untuk di-load saat startup")
    args = parser.parse_args()

    if args.preload_model and Path(args.preload_model).exists():
        try:
            _load_model(args.preload_model)
        except Exception as exc:
            print(f"[InferenceServer] Warning: preload model gagal: {exc}", flush=True)

    print(f"[InferenceServer] Starting on {args.host}:{args.port}", flush=True)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
