import os
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
from dynamic_matcher import match_transaction_to_user_categories

# Import receipt scanner pipeline modules
from receipt_scanner.preprocess import load_image_or_pdf, preprocess_receipt
from receipt_scanner.ocr_reader import run_ocr
from receipt_scanner.receipt_parser import parse_receipt_items_spatial

app = Flask(__name__)
CORS(app)

# Load trained Machine Learning model pipeline on startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), "receipt_scanner", "receipt_model.joblib")
_receipt_ml_model = None

def get_ml_model():
    global _receipt_ml_model
    if _receipt_ml_model is None:
        if os.path.exists(MODEL_PATH):
            try:
                print(f"[ML SERVICE] Lazy loading Receipt ML Model from '{MODEL_PATH}'...")
                _receipt_ml_model = joblib.load(MODEL_PATH)
            except Exception as e:
                print(f"[ML SERVICE WARNING] Failed to load ML model: {e}")
        else:
            print(f"[ML SERVICE WARNING] ML model file not found at '{MODEL_PATH}'")
    return _receipt_ml_model

DEFAULT_CATEGORIES = [
    {"name": "Home", "subcategories": ["Groceries", "Electricity Bill", "Water Bill", "Rent", "Maintenance"]},
    {"name": "Personal", "subcategories": ["Food & Cafe", "Travel & Cabs", "Shopping", "Entertainment", "Medical"]},
    {"name": "Business", "subcategories": ["Office Supplies", "Client Expenses", "Equipment", "Salaries"]},
    {"name": "Others", "subcategories": ["Others"]}
]

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "Artha Dynamic AI Category Predictor & Receipt Scanner",
        "ml_model_loaded": receipt_ml_model is not None
    }), 200

@app.route("/classify-item", methods=["POST"])
def classify_item():
    """Predict category for a single item string using trained Logistic Regression ML model."""
    data = request.get_json(silent=True) or {}
    item_name = data.get("item_name", "").strip()

    if not item_name:
        return jsonify({"error": "Please provide 'item_name'"}), 400

    model = get_ml_model()
    if model is None:
        return jsonify({"error": "Receipt ML Model is not loaded"}), 500

    predicted_category = model.predict([item_name])[0]
    probabilities = model.predict_proba([item_name])[0]
    max_confidence = float(max(probabilities))

    return jsonify({
        "success": True,
        "item_name": item_name,
        "predicted_category": predicted_category,
        "confidence": round(max_confidence, 2)
    }), 200

@app.route("/predict", methods=["POST"])
@app.route("/predict-dynamic", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    user_categories = data.get("userCategories") or DEFAULT_CATEGORIES

    if not name or len(name) < 2:
        return jsonify({
            "error": "Please provide a valid transaction name (minimum 2 characters)."
        }), 400

    try:
        result = match_transaction_to_user_categories(name, user_categories)
        if result:
            return jsonify({
                "success": True,
                "name": name,
                "mainCategory": result["mainCategory"],
                "subCategory": result["subCategory"],
                "confidence": result["confidence"]
            }), 200
        else:
            return jsonify({
                "success": True,
                "name": name,
                "mainCategory": user_categories[0]["name"],
                "subCategory": user_categories[0]["subcategories"][0],
                "confidence": 0.50
            }), 200
    except Exception as e:
        print(f"Error in prediction: {e}")
        return jsonify({
            "error": f"Prediction failed: {str(e)}"
        }), 500

@app.route("/scan-receipt", methods=["POST"])
def scan_receipt():
    """
    End-to-end Smart Receipt Scanner endpoint:
    File/Image Upload -> OpenCV Preprocess -> RapidOCR -> Spatial Parser -> Dynamic Category Matching
    """
    import json
    import tempfile

    temp_path = None
    try:
        # Check if file was uploaded via multipart/form-data
        if "file" in request.files:
            uploaded_file = request.files["file"]
            if uploaded_file.filename == "":
                return jsonify({"error": "No file selected for upload"}), 400

            # Save uploaded file to temporary directory with proper suffix
            filename = uploaded_file.filename or "receipt.pdf"
            suffix = os.path.splitext(filename)[1].lower()

            # Inspect stream bytes or mimetype if extension is missing
            if not suffix:
                header = uploaded_file.read(5)
                uploaded_file.seek(0)
                if header.startswith(b"%PDF") or uploaded_file.mimetype == "application/pdf":
                    suffix = ".pdf"
                elif uploaded_file.mimetype and uploaded_file.mimetype.startswith("image/"):
                    suffix = f".{uploaded_file.mimetype.split('/')[-1]}"
                else:
                    suffix = ".pdf"

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                uploaded_file.save(temp_file.name)
                temp_path = temp_file.name
        else:
            # Fallback to json request payload with local file path
            data = request.get_json(silent=True) or {}
            temp_path = data.get("image_path")

        if not temp_path or not os.path.exists(temp_path):
            return jsonify({"error": "Valid file upload or image_path is required"}), 400

        # Retrieve dynamic user categories from form or json
        user_categories_raw = request.form.get("userCategories")
        if user_categories_raw:
            try:
                user_categories = json.loads(user_categories_raw)
            except Exception:
                user_categories = DEFAULT_CATEGORIES
        else:
            user_categories = DEFAULT_CATEGORIES

        print(f"[RECEIPT SCANNER] Processing uploaded bill from: '{temp_path}'")

        # Step 1: Preprocess & OCR Extraction
        ocr_results, original_img = run_ocr(temp_path)

        # Step 2: Spatial Bounding Box Receipt Parsing
        parsed_items = parse_receipt_items_spatial(ocr_results)

        # Step 4: Map each parsed item against User's Dynamic Categories
        itemized_expenses = []
        total_bill_amount = 0.0

        for item in parsed_items:
            item_desc = item.get("name") or item.get("description", "")
            item_price = item["price"]
            total_bill_amount += item_price

            # Match item description against user's custom category tree
            match_res = match_transaction_to_user_categories(item_desc, user_categories)

            itemized_expenses.append({
                "description": item_desc,
                "amount": item_price,
                "quantity": item.get("quantity", 1),
                "mainCategory": match_res["mainCategory"] if match_res else "Home",
                "subCategory": match_res["subCategory"] if match_res else "Groceries",
                "confidence": match_res["confidence"] if match_res else 0.50
            })

        print(f"[RECEIPT SCANNER SUCCESS] Parsed {len(itemized_expenses)} line items. Total: Rs.{total_bill_amount:.2f}")

        import gc
        del original_img
        gc.collect()

        return jsonify({
            "success": True,
            "totalItems": len(itemized_expenses),
            "totalAmount": round(total_bill_amount, 2),
            "items": itemized_expenses
        }), 200

    except Exception as e:
        print(f"[RECEIPT SCANNER ERROR] Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Receipt scanning failed: {str(e)}"}), 500

    finally:
        # Clean up temporary upload file if created
        if temp_path and "file" in request.files and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        import gc
        gc.collect()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"[ML SERVICE] Artha Dynamic AI Category Predictor & Receipt Scanner running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)

