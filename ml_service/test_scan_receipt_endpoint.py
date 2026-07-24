import os
import requests
import json

# Define backend Flask URL
URL = "http://localhost:5001/scan-receipt"

# Sample file path
SAMPLE_PDF = os.path.join(os.path.dirname(__file__), "receipt_scanner", "sample_receipt.pdf")

# Custom User Categories representing Artha user preferences
USER_CATEGORIES = [
    {"name": "Home", "subcategories": ["Groceries", "Milk & Dairy", "Vegetables & Fruits", "Utilities"]},
    {"name": "PersonalCare", "subcategories": ["Hygiene", "Beauty"]},
    {"name": "Health", "subcategories": ["Medicines"]}
]

def test_endpoint():
    print(f"[TEST] Sending POST request to {URL} with file '{SAMPLE_PDF}'...")
    
    with open(SAMPLE_PDF, "rb") as f:
        files = {"file": ("sample_receipt.pdf", f, "application/pdf")}
        data = {"userCategories": json.dumps(USER_CATEGORIES)}
        
        response = requests.post(URL, files=files, data=data)
        
    print(f"[STATUS] {response.status_code}")
    print("[RESPONSE PAYLOAD]:")
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    # Test local function directly without HTTP server if app is not running in background
    from app import app
    with app.test_client() as client:
        with open(SAMPLE_PDF, "rb") as f:
            res = client.post(
                "/scan-receipt",
                data={
                    "file": (f, "sample_receipt.pdf"),
                    "userCategories": json.dumps(USER_CATEGORIES)
                },
                content_type="multipart/form-data"
            )
            print("==========================================================================")
            print("   FLASK /scan-receipt ENDPOINT INTEGRATION TEST RESULTS")
            print("==========================================================================")
            print(f"STATUS: {res.status_code}")
            print(json.dumps(res.get_json(), indent=2))
