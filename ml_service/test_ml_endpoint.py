import os
import joblib

# Load trained model
model_path = os.path.join(os.path.dirname(__file__), "receipt_scanner", "receipt_model.joblib")
model = joblib.load(model_path)

test_items = [
    "Amul Gold Pasteurised Full Cream Milk",
    "Organic Certified Beetroot (Beet)",
    "Crocin Advance 650mg Paracetamol Tablet",
    "Uber Premier Ride Airport Drop",
    "Dominos Cheesy Margherita Large Pizza",
    "Logitech MX Master 3S Wireless Mouse",
    "MSEDCL Electricity Power Bill Payment",
    "Netflix Premium 4K Ultra HD Plan"
]

print("==========================================================================")
print("  TESTING REAL-TIME LOGISTIC REGRESSION ML PREDICTIONS ON RECEIPT ITEMS")
print("==========================================================================")
print(f"{'#':<3} {'Receipt Item Description':<42} {'Predicted Category':<18} {'Confidence'}")
print("-" * 75)

for i, item in enumerate(test_items):
    category = model.predict([item])[0]
    probs = model.predict_proba([item])[0]
    confidence = max(probs) * 100
    print(f"{i+1:<3} {item:<42} {category:<18} {confidence:.1f}%")

print("-" * 75)
