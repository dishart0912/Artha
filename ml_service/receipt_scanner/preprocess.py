import cv2
import numpy as np
import os

# Define output directory for intermediate visual steps
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output_steps")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def deskew(image):
    """
    Calculates rotation angle of text using minimum area rectangle
    and rotates the image to make text perfectly horizontal.
    """
    # Find all coordinates of black (text) pixels in binary image
    # In binary thresholded image (inverted or thresholded), we find text points
    coords = np.column_stack(np.where(image < 127))
    if len(coords) == 0:
        return image

    # minAreaRect computes the minimum rotated rectangle containing all points
    angle = cv2.minAreaRect(coords)[-1]

    # Adjust angle convention returned by OpenCV
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    # If tilt is very small (< 0.5 degrees), no rotation needed
    if abs(angle) < 0.5:
        return image

    # Compute rotation matrix around center of image
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    
    # Perform affine transformation (rotation)
    rotated = cv2.warpAffine(
        image, M, (w, h), 
        flags=cv2.INTER_CUBIC, 
        borderMode=cv2.BORDER_REPLICATE
    )
    print(f"[DESKEW] Corrected tilt angle by {angle:.2f} degrees.")
    return rotated

def is_pdf_file(file_path):
    """
    Check if file is a PDF either by file extension (.pdf) or by magic header bytes (%PDF-).
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return True
    try:
        with open(file_path, "rb") as f:
            header = f.read(5)
            return header.startswith(b"%PDF")
    except Exception:
        return False

def load_image_or_pdf(file_path):
    """
    Loads an image file (.png, .jpg, .jpeg) or renders Page 1 of a PDF (.pdf)
    into an OpenCV BGR image array. Auto-detects PDFs via extension or magic bytes (%PDF-).
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at path: {file_path}")

    if is_pdf_file(file_path):
        pdf_errors = []
        
        # Primary Renderer: PyMuPDF (fitz)
        try:
            # pyrefly: ignore [missing-import]
            import fitz
            print(f"[PDF] Rendering Page 1 of PDF file: '{file_path}' at 150 DPI using PyMuPDF...")
            doc = fitz.open(file_path)
            if len(doc) > 0:
                page = doc[0]
                pix = page.get_pixmap(dpi=150)
                image_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                if pix.n == 4:
                    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGBA2BGR)
                else:
                    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
                return image_bgr
            else:
                raise ValueError("Uploaded PDF file contains 0 pages.")
        except ImportError:
            pdf_errors.append("PyMuPDF (fitz) module not installed.")
        except Exception as e:
            print(f"[PDF WARN] PyMuPDF rendering failed: {e}")
            pdf_errors.append(f"PyMuPDF error: {e}")

        # Fallback Renderer: pdf2image
        try:
            # pyrefly: ignore [missing-import]
            from pdf2image import convert_from_path
            print(f"[PDF] Attempting fallback rendering with pdf2image...")
            images = convert_from_path(file_path, first_page=1, last_page=1, dpi=150)
            if images:
                image_np = np.array(images[0])
                return cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        except Exception as e:
            pdf_errors.append(f"pdf2image error: {e}")

        raise ValueError(
            f"Failed to read PDF file. Errors: {'; '.join(pdf_errors)}. "
            "Please verify the PDF is valid and not password protected."
        )

    # Standard raster image load
    image = cv2.imread(file_path)
    if image is None:
        raise ValueError(f"Could not decode image file at: {file_path}")
    return image

def preprocess_receipt(file_path):
    """
    Complete Phase 1 Receipt Preprocessing Pipeline:
    1. Load original image OR render PDF Page 1
    2. Convert to Grayscale
    3. Denoise with Median Blur
    4. Adaptive Thresholding (Binarization)
    5. Deskewing (Rotation Correction)
    """
    # ---------------------------------------------------------------------
    # STEP 1: Load Image or PDF
    # ---------------------------------------------------------------------
    image = load_image_or_pdf(file_path)
    print(f"[STEP 1] Image Loaded: {image.shape[1]}x{image.shape[0]} px, 3 channels (BGR)")

    # ---------------------------------------------------------------------
    # STEP 2: Grayscale Conversion
    # ---------------------------------------------------------------------
    # Strip color channels -> 1 channel luminance [0..255]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    step1_path = os.path.join(OUTPUT_DIR, "step1_grayscale.png")
    cv2.imwrite(step1_path, gray)

    # ---------------------------------------------------------------------
    # STEP 3: Denoising (Median Blur)
    # ---------------------------------------------------------------------
    # cv2.medianBlur replaces central pixel with median of 3x3 neighborhood.
    # Wipes out stray dust/pepper noise while keeping letter edges sharp.
    denoised = cv2.medianBlur(gray, 3)
    step2_path = os.path.join(OUTPUT_DIR, "step2_denoised.png")
    cv2.imwrite(step2_path, denoised)

    # ---------------------------------------------------------------------
    # STEP 4: Adaptive Thresholding (Binarization)
    # ---------------------------------------------------------------------
    # Gaussian local thresholding over 11x11 pixel neighborhoods
    binary = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11,
        2
    )
    step3_path = os.path.join(OUTPUT_DIR, "step3_binary.png")
    cv2.imwrite(step3_path, binary)

    # ---------------------------------------------------------------------
    # STEP 5: Deskewing (Rotation Correction)
    # ---------------------------------------------------------------------
    deskewed = deskew(binary)
    step4_path = os.path.join(OUTPUT_DIR, "step4_deskewed.png")
    cv2.imwrite(step4_path, deskewed)

    print(f"[COMPLETED] Preprocessing finished! Saved 4 output images to '{OUTPUT_DIR}'.")

    return {
        "original": image,
        "gray": gray,
        "denoised": denoised,
        "binary": binary,
        "deskewed": deskewed
    }

if __name__ == "__main__":
    sample_path = os.path.join(os.path.dirname(__file__), "sample_receipt.jpg")
    
    if os.path.exists(sample_path):
        print(f"Running complete Phase 1 preprocessing on '{sample_path}'...")
        results = preprocess_receipt(sample_path)
    else:
        print(f"⚠️ Test image not found at '{sample_path}'.")
        print("Please save your Swiggy Instamart invoice screenshot as 'sample_receipt.png' in 'ml_service/receipt_scanner/'.")
