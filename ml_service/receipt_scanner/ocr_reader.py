import time
import cv2
import numpy as np
import os
import sys
import gc

# Helper for process RSS memory tracking
def get_process_rss_mb():
    try:
        import psutil
        return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)
    except Exception:
        try:
            import resource
            return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0
        except Exception:
            return 0.0

def log_step(step_name, start_time, img=None):
    elapsed = time.time() - start_time
    rss = get_process_rss_mb()
    img_str = "N/A"
    if img is not None and hasattr(img, "shape"):
        h, w = img.shape[:2]
        nbytes_mb = img.nbytes / (1024 * 1024)
        img_str = f"{w}x{h} px ({nbytes_mb:.2f} MB)"
    print(f"[PIPELINE TRACKER] Step: '{step_name}' | Elapsed: {elapsed:.3f}s | Image: {img_str} | Process RSS: {rss:.2f} MB", flush=True)
    return time.time()

# We import our Phase 1 preprocessor so OCR always works on a clean image
sys.path.insert(0, os.path.dirname(__file__))
from preprocess import load_image_or_pdf, preprocess_receipt

# ---------------------------------------------------------------------------
# SECTION 1: Initialize the OCR Engine
# ---------------------------------------------------------------------------
from rapidocr_onnxruntime import RapidOCR
_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        t0 = time.time()
        print(f"[OCR] Lazy loading RapidOCR ONNX models into memory (use_angle_cls=False, RSS: {get_process_rss_mb():.2f} MB)...", flush=True)
        _ocr_engine = RapidOCR(use_angle_cls=False)
        print(f"[OCR] RapidOCR model loaded in {time.time()-t0:.3f}s (RSS: {get_process_rss_mb():.2f} MB).", flush=True)
    return _ocr_engine

# ---------------------------------------------------------------------------
# SECTION 2: Output Directory
# ---------------------------------------------------------------------------
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output_steps")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def run_ocr(file_path):
    """
    Run OCR on a receipt image or PDF and return structured results.
    """
    t_start = time.time()
    t_step = t_start

    # STEP 1: Load image or PDF
    print(f"[OCR] Starting pipeline for: '{file_path}' (RSS: {get_process_rss_mb():.2f} MB)", flush=True)
    original_image = load_image_or_pdf(file_path)
    t_step = log_step("1. load_image_or_pdf", t_step, original_image)

    # STEP 2: Preprocess receipt (reuse original_image directly to avoid duplicate file loads)
    processed = preprocess_receipt(original_image)
    t_step = log_step("2. preprocess_receipt", t_step, original_image)

    # Use deskewed preprocessed image if available, else original
    if isinstance(processed, dict) and "deskewed" in processed:
        clean_image = processed["deskewed"]
    else:
        clean_image = original_image

    if len(clean_image.shape) == 2:
        clean_image_bgr = cv2.cvtColor(clean_image, cv2.COLOR_GRAY2BGR)
    else:
        clean_image_bgr = clean_image.copy()

    # STEP 3: Optimize dimensions (max width 1200px, max height 2500px) for ultra-sharp high-accuracy OCR
    h, w = clean_image_bgr.shape[:2]
    new_w, new_h = w, h

    if w > 1200:
        scale_w = 1200.0 / w
        new_w = 1200
        new_h = int(h * scale_w)

    if new_h > 2500:
        scale_h = 2500.0 / new_h
        new_h = 2500
        new_w = int(new_w * scale_h)

    if (new_w, new_h) != (w, h):
        print(f"[OCR] Resizing image for high-accuracy OCR from {w}x{h} -> {new_w}x{new_h} px.", flush=True)
        clean_image_bgr = cv2.resize(clean_image_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)
        t_step = log_step("3. image_downscale_for_ocr", t_step, clean_image_bgr)

    # STEP 4: Lazy load OCR engine
    engine = get_ocr_engine()
    t_step = log_step("4. get_ocr_engine", t_step)

    # Free all temporary image references and run garbage collector IMMEDIATELY before ONNX inference
    del original_image
    del processed
    gc.collect()

    # STEP 5: Run RapidOCR ONNX inference
    rss_pre = get_process_rss_mb()
    print(f"[OCR PRE-INFERENCE] RSS immediately before engine(...): {rss_pre:.2f} MB | Input shape: {clean_image_bgr.shape[1]}x{clean_image_bgr.shape[0]} px ({clean_image_bgr.nbytes / (1024*1024):.2f} MB)", flush=True)
    
    t_inf = time.time()
    results, _ = engine(clean_image_bgr)
    
    rss_post = get_process_rss_mb()
    print(f"[OCR POST-INFERENCE] RSS immediately after engine(...): {rss_post:.2f} MB | Inference Time: {time.time()-t_inf:.3f}s | Delta RSS: +{rss_post - rss_pre:.2f} MB", flush=True)
    t_step = log_step("5. RapidOCR_inference", t_step, clean_image_bgr)

    if results is None or len(results) == 0:
        print("[OCR] No text detected in this image.", flush=True)
        del clean_image_bgr
        gc.collect()
        return [], None

    print(f"\n[OCR] Detected {len(results)} text regions (Total Pipeline Elapsed: {time.time()-t_start:.3f}s):\n", flush=True)

    structured_results = []
    for item in results:
        box = item[0]
        text = str(item[1])
        confidence = float(item[2])
        structured_results.append({
            "text": text,
            "confidence": confidence,
            "box": box
        })

    del clean_image_bgr
    gc.collect()

    return structured_results, None


def draw_bounding_boxes(image, structured_results, output_path):
    """
    Draws colored bounding box quadrilaterals on the receipt image.
    - HIGH confidence (>= 0.85): GREEN box
    - MEDIUM confidence (0.50–0.85): YELLOW/ORANGE box
    - LOW confidence (< 0.50): RED box
    """
    annotated = image.copy()  # Don't modify original; work on a copy

    for item in structured_results:
        box = item["box"]
        confidence = item["confidence"]
        text = item["text"]

        # Convert the 4 corner floats to integer pixel coordinates
        # np.int32 because cv2.polylines requires integer arrays
        pts = np.array(box, dtype=np.int32)

        # Choose bounding box color based on confidence level
        if confidence >= 0.85:
            color = (0, 200, 0)      # Green: high confidence
        elif confidence >= 0.50:
            color = (0, 165, 255)    # Orange: medium confidence
        else:
            color = (0, 0, 220)      # Red: low confidence (may need review)

        # cv2.polylines draws a polygon connecting all 4 corner points
        # pts.reshape(-1, 1, 2): reshapes array to the format polylines expects
        # True: close the polygon (draw line from last point back to first)
        # 2: line thickness in pixels
        cv2.polylines(annotated, [pts.reshape(-1, 1, 2)], True, color, 2)

        # Draw confidence label text above the bounding box
        top_left = tuple(pts[0])   # first corner = top-left
        label = f"{confidence:.2f}"

        # Draw a small filled rectangle behind the label text for readability
        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
        cv2.rectangle(
            annotated,
            (top_left[0], top_left[1] - text_h - 4),
            (top_left[0] + text_w, top_left[1]),
            color,
            -1   # -1 thickness fills the rectangle
        )
        # Draw the confidence number in black text on the colored label
        cv2.putText(
            annotated, label,
            (top_left[0], top_left[1] - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,       # font scale
            (0, 0, 0), # black text
            1,         # thickness
            cv2.LINE_AA
        )

    cv2.imwrite(output_path, annotated)
    print(f"\n[SAVED] Annotated receipt saved to '{output_path}'")
    return annotated


if __name__ == "__main__":
    sample_path = os.path.join(os.path.dirname(__file__), "sample_receipt.png")

    if not os.path.exists(sample_path):
        # Also check for PDF
        sample_pdf = os.path.join(os.path.dirname(__file__), "sample_receipt.pdf")
        if os.path.exists(sample_pdf):
            sample_path = sample_pdf
        else:
            print("⚠️  Place your Swiggy Instamart bill as 'sample_receipt.png' or")
            print("    'sample_receipt.pdf' inside 'ml_service/receipt_scanner/' and re-run.")
            sys.exit(1)

    print(f"Running OCR on: {sample_path}\n")
    results, original = run_ocr(sample_path)

    if results:
        annotated_path = os.path.join(OUTPUT_DIR, "step5_ocr_annotated.png")
        draw_bounding_boxes(original, results, annotated_path)
        print(f"\n[OK] OCR Complete! {len(results)} text regions detected.")
        print(f"     Check annotated image at: {annotated_path}")
