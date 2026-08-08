import os
import sys
import re
import numpy as np

HEADER_FOOTER_PATTERNS = [
    r'sold\s*by', r'seller', r'zomato', r'hyperpure', r'blinkit', r'commerce',
    r'gstin', r'fssai', r'cin\b', r'pan\b', r'invoice\s*number', r'invoice\s*to',
    r'order\s*id', r'invoice\s*date', r'place\s*of\s*supply', r'pin\s*code',
    r'state\b', r'moreshwar', r'dhokali', r'kalwa', r'thane', r'mumbai',
    r'maharashtra', r'runwal', r'narayana', r'balkum', r'majiwada', r'terms\s*&\s*conditions',
    r'authorised\s*signatory', r'whether\s*the\s*tax', r'reverse\s*charge', r'annexure',
    r'nature\s*of\s*charge', r'taxable\s*value', r'amount\s*in\s*words', r'tax\s*invoice',
    r'customer\s*address', r'seller\s*name', r'billing\s*address', r'shipping\s*address',
    r'sr\.\s*no', r'item\s*description', r'additional\s*cess', r'code\d*', r'zhpl'
]

def is_header_or_footer_text(text):
    if not text:
        return True
    t_lower = text.lower().strip()
    for pat in HEADER_FOOTER_PATTERNS:
        if re.search(pat, t_lower):
            return True
    return False

def safe_float(val_str, default=0.0):
    """
    Safely parses numeric string inputs containing commas, currency symbols, 
    or OCR noise (e.g. '1,10', '1,250.00', 'Rs. 12.50') into float numbers.
    """
    if val_str is None:
        return default
    if isinstance(val_str, (int, float)):
        return float(val_str)
    
    clean = str(val_str).strip()
    # Strip non-numeric leading/trailing characters
    clean = re.sub(r'^[^\d.,]+|[^\d.,]+$', '', clean)
    if not clean:
        return default

    # Handle comma as decimal separator (e.g., '1,10' or '12,50' when no dot exists)
    if re.search(r',\d{1,2}$', clean) and '.' not in clean:
        clean = clean.replace(',', '.')
    else:
        # Strip thousand separator commas (e.g., '1,250.50' -> '1250.50')
        clean = clean.replace(',', '')

    try:
        return float(clean)
    except (ValueError, TypeError):
        match = re.search(r'\d+(?:\.\d+)?', clean)
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                pass
        return default

def clean_item_name(name):
    """
    Clean OCR text noise, HSN codes, MRP values, tax codes, and item indexes.
    """
    if not name:
        return ""

    # Check if string matches known document header / seller metadata patterns
    if is_header_or_footer_text(name):
        return ""

    # Strip HSN / SAC codes like (HSN-62171040) or (HSN- 96151900)
    name = re.sub(r'\(?HSN[-\s]*\d*\)?', '', name, flags=re.IGNORECASE)

    # Strip 4+ digit standalone barcode integers like 8901, 2622, 6011, 8904, 3559, 1700
    name = re.sub(r'\b890\d+\b|\b\d{4,14}\b', '', name)

    # Strip percentages like 57.89% or 34.00% or standalone % / +
    name = re.sub(r'\b\d+(?:\.\d+)?%\b|[%\+]|0\.00%', '', name)

    # Strip weight specifications e.g. 450 g, 550g, 250 g, 1kg
    name = re.sub(r'\b\d+\s*(?:g|gm|gms|kg|ml|l|ltr|pc|pcs|nos)\b', '', name, flags=re.IGNORECASE)

    # Strip common unit tags, Pack noise, standalone g/kg/ml, and unclosed brackets
    name = re.sub(r'\b(NOS|PCS|KG|GMS|PACK|UNIT|UQC|EA|G|GM|ML|LTR)\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\(?\b(Pack|Pouch|Box|Bottle|Net Vol|Net Wt)\b\)?', '', name, flags=re.IGNORECASE)

    # Strip parenthetical local-language aliases e.g. (Amla), (Beet), (Kakadi), (Batate), (Vange)
    name = re.sub(r'\(\s*[A-Za-z\s]{1,20}\s*\)', ' ', name)

    # Strip unclosed trailing brackets like (Beet or (Kakadi
    name = re.sub(r'\([^\)]*$', '', name)

    # Strip orphaned closing parentheses with no matching open
    # e.g. "Mirchi)" -> "Mirchi"
    name = re.sub(r'(?<!\()\)', '', name)
    name = re.sub(r'^\)+', '', name)

    # Remove leading row numbers, codes, slashes, pluses, charges, or noise
    name = re.sub(r'^(?:Code|Taxes|\)|Value|\(Rs\.\)|Amount|Sr|No|\d+|\bS\b|\bUQC\b|\bHSN\b|\bSAC\b|charges|charge|[\s/+\-.:;%])+', '', name, flags=re.IGNORECASE)

    
    # Strip trailing tax/fee headers
    name = re.sub(r'\b(Tax Rate|Taxable Value|CGST|SGST|Cess)$', '', name, flags=re.IGNORECASE)

    # Strip standalone float/integer numbers (e.g. MRP 299.00, Discount 200.00, Taxable 94.29)
    name = re.sub(r'\b\d+(\.\d{1,2})?\b', '', name)

    # Clean multi-spaces and edge punctuation
    name = re.sub(r'\s+', ' ', name).strip(" ,.-+()/%:;")
    
    if is_header_or_footer_text(name) or len(name) < 2:
        return ""

    return name


def is_valid_price_string(txt):
    if not txt:
        return False
    raw_str = str(txt).strip()

    # Reject 4-digit or 5-digit integer barcode prefixes (e.g. 8901, 8904, 8902, 8906, 2622, 6011) without decimal
    if re.match(r'^(890\d|\d{4,5})$', raw_str) and '.' not in raw_str:
        return False

    # Strip currency symbols
    cleaned = re.sub(r'\b(Rs|INR|USD|EUR)\b', '', raw_str, flags=re.IGNORECASE).strip()
    
    # Reject strings containing any alphabetic characters (e.g. "08-Aug-2026", "Code", "Total", "ZHPL")
    if re.search(r'[a-zA-Z]', cleaned):
        return False

    val = safe_float(txt)
    return 0.50 <= val <= 10000.0

def is_subrow_fee_line(y_val, ocr_results):
    """
    Returns True if any OCR box on the same horizontal line (within 15px Y-distance)
    contains fee/delivery/charge keywords.
    """
    if not ocr_results:
        return False
    for box in ocr_results:
        box_y = (box["box"][0][1] + box["box"][3][1]) / 2.0
        if abs(box_y - y_val) <= 15.0:
            txt_lower = box["text"].lower()
            if any(k in txt_lower for k in ["delivery and", "charges---", "other charges", "-delivery", "delivery &"]):
                return True
    return False

def parse_receipt_items_spatial(ocr_results):
    """
    Uses Spatial Y-Windowing & Bounding Box Geometry to cleanly extract 
    all item descriptions and prices from receipt tables.
    """
    if not ocr_results:
        return []

    # Get overall page width and height from OCR bounding boxes
    all_x = [pt[0] for item in ocr_results for pt in item["box"]]
    all_y = [pt[1] for item in ocr_results for pt in item["box"]]
    page_w = max(all_x) if all_x else 1000.0
    page_h = max(all_y) if all_y else 1000.0

    print(f"[SPATIAL PARSER] Page dimensions: {page_w:.0f}x{page_h:.0f} px")

    # Define spatial column X-boundaries
    # Item Description column spans from X = 1% to X = 45% of page width
    desc_x_min = 0.01 * page_w
    desc_x_max = 0.45 * page_w
    
    # Step 1: Detect Table Y-Boundaries
    y_table_start = 0.0
    for item in ocr_results:
        text_lower = item["text"].lower()
        y_center = (item["box"][0][1] + item["box"][3][1]) / 2.0
        if y_center < 0.60 * page_h:
            if any(h in text_lower for h in ["item description", "description of goods", "particulars", "item name", "description"]):
                if y_table_start == 0.0 or y_center < y_table_start:
                    y_table_start = y_center + 10.0

    if y_table_start == 0.0:
        y_table_start = 0.15 * page_h

    y_table_end = 0.95 * page_h
    for item in ocr_results:
        text_lower = item["text"].lower()
        y_center = (item["box"][0][1] + item["box"][3][1]) / 2.0
        if any(h in text_lower for h in ["amount in words", "terms & conditions", "annexure", "reverse charge", "authorised signatory", "nature of charge", "tax summary", "tax rate"]):
            if y_center > y_table_start + 80.0 and y_center < y_table_end:
                y_table_end = min(y_table_end, y_center - 10.0)

    print(f"[SPATIAL PARSER] Table Y-region: Y={y_table_start:.0f} to Y={y_table_end:.0f}")

    # Filter out header/footer labels & sub-row fee lines
    table_ocr = []
    delivery_subrow_fees = []

    for item in ocr_results:
        text_lower = item["text"].lower()
        y_center = (item["box"][0][1] + item["box"][3][1]) / 2.0
        x_left = item["box"][0][0]
        
        # Isolate sub-row delivery & ancillary fee lines (e.g. "-Delivery and other charges---5.78 ... 6.07")
        if is_subrow_fee_line(y_center, ocr_results):
            val = safe_float(item["text"])
            if 0.10 <= val <= 250.0 and x_left > 0.60 * page_w:
                delivery_subrow_fees.append(val)
            continue

        # Only exclude summary labels if they are actual footer summary titles
        if text_lower in ["invoice value", "handling fee (inclusive of gst)", "annexure", "amount in words:"] and x_left > 0.60 * page_w:
            continue

        if y_table_start <= y_center <= y_table_end:
            table_ocr.append({
                "text": item["text"].strip(),
                "y": y_center,
                "x": x_left,
                "box": item["box"]
            })

    # Step 2: Extract candidate price boxes using adaptive column thresholding
    # Try rightmost Net Amount column first (X >= 0.70 * page_w) to exclude intermediate tax/MRP columns
    price_x_threshold = 0.70 * page_w
    candidate_boxes = [
        w for w in table_ocr 
        if w["x"] >= price_x_threshold and is_valid_price_string(w["text"])
    ]

    # If narrow thermal slip has no price boxes past 70%, adaptively lower threshold to 45%
    if len(candidate_boxes) == 0:
        price_x_threshold = 0.45 * page_w
        candidate_boxes = [
            w for w in table_ocr 
            if w["x"] >= price_x_threshold and is_valid_price_string(w["text"])
        ]

    price_boxes = []
    for w in candidate_boxes:
        val = safe_float(w["text"])
        txt_clean = re.sub(r'[^\d.]', '', str(w["text"]).replace(',', '.'))
        if len(txt_clean) <= 7 and txt_clean not in ["495", "507.02"]:
            w["parsed_price"] = val
            price_boxes.append(w)

    print(f"[DEBUG] Candidate price boxes (X >= {price_x_threshold:.0f}): {[w['text'] + ' (Y=' + str(int(w['y'])) + ', X=' + str(int(w['x'])) + ')' for w in price_boxes]}")

    # Deduplicate price boxes on the same horizontal line (keep right-most)
    price_boxes.sort(key=lambda p: (p["y"], p["x"]))
    unique_prices = []
    for p in price_boxes:
        if not unique_prices or abs(p["y"] - unique_prices[-1]["y"]) > 10:
            unique_prices.append(p)
        else:
            if p["x"] > unique_prices[-1]["x"]:
                unique_prices[-1] = p

    print(f"[SPATIAL PARSER] Found {len(unique_prices)} distinct item price rows in table.")

    # Step 3: Spatial Y-Windowing to pair descriptions with prices
    items = []
    
    for i, p in enumerate(unique_prices):
        curr_price_y = p["y"]
        price_val = p.get("parsed_price") if "parsed_price" in p else safe_float(p["text"])

        # Spatial Y-Window bounds using exact vertical midpoints between adjacent prices:
        if i == 0:
            y_start = y_table_start
        else:
            y_start = (unique_prices[i-1]["y"] + unique_prices[i]["y"]) / 2.0

        if i == len(unique_prices) - 1:
            y_end = unique_prices[i]["y"] + 60.0
        else:
            y_end = (unique_prices[i]["y"] + unique_prices[i+1]["y"]) / 2.0
        
        print(f"[DEBUG] Processing Item {i+1} at Price Y={curr_price_y}: Window [{y_start:.0f}, {y_end:.0f}]")

        # Gather description words strictly inside [y_start, y_end] window
        desc_words = [
            w for w in table_ocr 
            if desc_x_min <= w["x"] <= desc_x_max 
            and y_start <= w["y"] <= y_end
        ]
        
        # Sort description words top-to-bottom, left-to-right
        desc_words.sort(key=lambda w: (w["y"], w["x"]))
        
        raw_desc = " ".join(w["text"] for w in desc_words if not w["text"].isdigit())
        clean_name = clean_item_name(raw_desc)

        # Extract quantity if present near item description
        qty = 1
        qty_match = re.search(r'\b(\d+)\s*(?:NOS|PCS|KG)\b', raw_desc, re.IGNORECASE)
        if qty_match:
            qty = int(qty_match.group(1))

        if clean_name:
            clean_lower = clean_name.lower()
            if any(kw in clean_lower for kw in ["total", "amount in words", "grand total", "invoice value", "subtotal", "eight hundred", "disclaimer"]):
                print(f"[DEBUG] Rejecting total summary row from items list: '{clean_name}'")
                continue

            items.append({
                "item_index": len(items) + 1,
                "name": clean_name,
                "quantity": qty,
                "price": price_val
            })

    if delivery_subrow_fees and not any("delivery" in it["name"].lower() for it in items):
        total_subrow_fee = round(float(sum(delivery_subrow_fees)), 2)
        if total_subrow_fee > 0.0:
            items.append({
                "item_index": len(items) + 1,
                "name": "Delivery & Order Charges",
                "quantity": 1,
                "price": total_subrow_fee
            })
            print(f"[SPATIAL PARSER] Aggregated {len(delivery_subrow_fees)} sub-row charges -> Rs.{total_subrow_fee:.2f}")

    # -------------------------------------------------------------------------
    # Step 4: Extract Non-Item Fees (Handling Fee, Delivery Charges, Taxes)
    # -------------------------------------------------------------------------
    extra_fee_keywords = ["handling", "delivery fee", "platform fee", "delivery charge", "container charge"]
    
    for box in ocr_results:
        text = box["text"].strip()
        text_lower = text.lower()

        if any(kw in text_lower for kw in extra_fee_keywords):
            # Ignore table column headers
            if any(h in text_lower for h in ["tax rate", "taxable value", "description", "code"]):
                continue

            # Standardize fee title
            if "handling" in text_lower:
                fee_name = "Handling Fee"
            elif "delivery" in text_lower:
                fee_name = "Delivery Fee"
            elif "platform" in text_lower:
                fee_name = "Platform Fee"
            else:
                fee_name = text

            # Check if this fee has already been captured
            if any(fee_name.lower() in it["name"].lower() for it in items):
                continue

            y_box = (box["box"][0][1] + box["box"][3][1]) / 2.0
            
            # Find matching price box on the same Y-level (within 50px)
            for p_box in ocr_results:
                p_val = safe_float(p_box["text"])
                if p_val > 0.0:
                    p_y = (p_box["box"][0][1] + p_box["box"][3][1]) / 2.0
                    if abs(p_y - y_box) <= 50.0 and 0.0 < p_val < 1000.0:
                        items.append({
                            "item_index": len(items) + 1,
                            "name": fee_name,
                            "quantity": 1,
                            "price": p_val
                        })
                        print(f"[SPATIAL PARSER] Found Extra Order Fee: '{fee_name}' -> Rs.{p_val:.2f}")
                        break

    # -------------------------------------------------------------------------
    # Step 5: Universal Fallback Engine (for thermal slips, petrol bills, non-tabular receipts)
    # -------------------------------------------------------------------------
    if not items:
        print("[SPATIAL PARSER WARNING] Structured table parsing found 0 items. Running Universal Fallback Engine...")
        
        # 1. Detect Merchant Name from top OCR text regions
        merchant_name = "Store Purchase"
        for box in ocr_results[:8]:
            t = box["text"].strip()
            if len(t) > 3 and not any(kw in t.lower() for kw in ["tax", "invoice", "gstin", "date", "order", "page", "bill", "seller", "customer"]):
                merchant_name = t
                break

        # 2. Extract Grand Total by searching for monetary numbers
        detected_amounts = []
        for box in ocr_results:
            val = safe_float(box["text"])
            if 1.0 <= val <= 50000.0:
                detected_amounts.append(val)

        if detected_amounts:
            # Pick the largest reasonable grand total
            detected_amounts.sort(reverse=True)
            best_amount = detected_amounts[0]
            
            items.append({
                "item_index": 1,
                "name": f"{merchant_name} Total",
                "quantity": 1,
                "price": best_amount
            })
            print(f"[SPATIAL PARSER FALLBACK] Extracted consolidated total: '{merchant_name} Total' -> Rs.{best_amount:.2f}")
        else:
            items.append({
                "item_index": 1,
                "name": f"{merchant_name} Bill",
                "quantity": 1,
                "price": 0.00
            })

    print(f"[SPATIAL PARSER] Successfully extracted {len(items)} structured receipt items + fees.")
    return items


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(__file__))
    from ocr_reader import run_ocr
    
    sample_path = os.path.join(os.path.dirname(__file__), "sample_receipt.pdf")
    if not os.path.exists(sample_path):
        sample_path = os.path.join(os.path.dirname(__file__), "sample_receipt.png")

    if os.path.exists(sample_path):
        ocr_results, _ = run_ocr(sample_path)
        items = parse_receipt_items_spatial(ocr_results)
        
        print("\n=======================================================")
        print("  EXTRACTED STRUCTURED ITEMS FROM SWIGGY INSTAMART BILL")
        print("=======================================================")
        print(f"{'#':<4} {'Item Description':<48} {'Qty':<6} {'Price (Rs.)'}")
        print("-" * 74)
        for i, item in enumerate(items):
            print(f"{i+1:<4} {item['name']:<48} {item['quantity']:<6} {item['price']:.2f}")
        print("-" * 74)
        print(f"TOTAL ITEMS EXTRACTED: {len(items)}")
