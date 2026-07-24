import cv2
import numpy as np
import os
import sys

# We import our Phase 1 preprocessor so OCR always works on a clean image
sys.path.insert(0, os.path.dirname(__file__))
from preprocess import load_image_or_pdf, preprocess_receipt

# ---------------------------------------------------------------------------
# SECTION 1: Initialize the OCR Engine
# ---------------------------------------------------------------------------
# RapidOCR() creates the OCR engine.
# On first run: downloads DB-Net + CLS + CRNN model weights (~150MB) to cache.
# On every subsequent run: loads from cache instantly (no download needed).
from rapidocr_onnxruntime import RapidOCR
_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        print("[OCR] Lazy loading RapidOCR models into memory...")
        _ocr_engine = RapidOCR()
    return _ocr_engine

# ---------------------------------------------------------------------------
# SECTION 2: Output Directory
# ---------------------------------------------------------------------------
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output_steps")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def run_ocr(file_path):
    """
    Run OCR on a receipt image or PDF and return structured results.

    Returns a list of dicts, one per detected text region:
        {
            "text":       "Amul Taaza Milk 1L",  <- recognized text
            "confidence": 0.97,                   <- 0.0 to 1.0
            "box":        [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]  <- 4 corners
        }
    """
    # STEP 1: Load the receipt (handles both .png/.jpg and .pdf)
    # load_image_or_pdf returns an OpenCV BGR numpy array [H, W, 3]
    original_image = load_image_or_pdf(file_path)
    print(f"[OCR] Receipt loaded: {original_image.shape[1]}x{original_image.shape[0]} px")

    # STEP 2: Run Phase 1 preprocessing
    processed = preprocess_receipt(file_path)
    
    # RapidOCR works best on original crisp pixels for digital receipts
    clean_image = original_image

    if len(clean_image.shape) == 2:
        clean_image_bgr = cv2.cvtColor(clean_image, cv2.COLOR_GRAY2BGR)
    else:
        clean_image_bgr = clean_image

    # STEP 4: Run RapidOCR on the preprocessed image
    # get_ocr_engine()() returns: (results, timing_info)
    # results = list of [box, text, confidence] for each detected text region
    engine = get_ocr_engine()
    results, _ = engine(clean_image_bgr)

    if results is None or len(results) == 0:
        print("[OCR] No text detected in this image.")
        return [], original_image

    print(f"\n[OCR] Detected {len(results)} text regions:\n")
    print(f"{'#':<4} {'Confidence':<12} {'Text'}")
    print("-" * 70)

    structured_results = []

    for i, item in enumerate(results):
        box = item[0]          # 4 corner coordinates
        text = str(item[1])    # recognized text string
        confidence = float(item[2])   # cast float confidence score (e.g. 0.985)

        print(f"{i+1:<4} {confidence:<12.3f} {text}")

        # Store in structured format for later use in receipt parsing
        structured_results.append({
            "text": text,
            "confidence": confidence,
            "box": box
        })

    import gc
    del clean_image_bgr
    del processed
    gc.collect()

    return structured_results, original_image


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
