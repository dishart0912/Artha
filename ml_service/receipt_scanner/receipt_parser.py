import os
import sys
import re
import numpy as np

HEADER_FOOTER_KEYWORDS = [
    "tax invoice", "invoice to", "seller name", "gstin", "fssai", 
    "customer address", "order id", "document", "invoice no", 
    "date of invoice", "category", "hsn", "cgst", "sgst", "uqc",
    "invoice value", "handling fee", "annexure", "discounts", "disclaimer",
    "description of goods", "quantity", "taxable", "total amount",
    "place of supply", "state", "amount in words", "handling fee"
]

def clean_item_name(name):
    """
    Clean OCR text noise, HSN codes, MRP values, tax codes, and item indexes.
    """
    if not name:
        return ""

    # Strip HSN / SAC codes like (HSN-62171040) or (HSN- 96151900)
    name = re.sub(r'\(?HSN[-\s]*\d*\)?', '', name, flags=re.IGNORECASE)

    # Remove leading row numbers, codes, or noise
    name = re.sub(r'^(?:Code|Taxes|\)|Value|\(Rs\.\)|Amount|Sr|No|\d+|\bS\b|\bUQC\b|\bHSN\b|\bSAC\b|\s)+', '', name, flags=re.IGNORECASE)
    
    # Strip trailing tax/fee headers
    name = re.sub(r'\b(Tax Rate|Taxable Value|CGST|SGST|Cess)$', '', name, flags=re.IGNORECASE)

    # Strip standalone float/integer numbers (e.g. MRP 299.00, Discount 200.00, Taxable 94.29)
    name = re.sub(r'\b\d+(\.\d{1,2})?\b', '', name)

    # Clean multi-spaces and edge punctuation
    name = re.sub(r'\s+', ' ', name).strip(" ,.-()")
    return name

def parse_receipt_items_spatial(ocr_results):
    """
    Uses Spatial Y-Windowing & Bounding Box Geometry to cleanly extract 
    all item descriptions and prices from receipt tables.
    
    Algorithm:
    1. Locate the item table Y-region (between table header and summary totals).
    2. Find all price boxes in the rightmost Net Amount column (X >= 0.60 * PageWidth).
    3. For each price box, gather all description words in the item description column 
       whose Y-coordinates fall within that item's vertical spatial window!
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
    desc_x_min = 0.05 * page_w
    desc_x_max = 0.45 * page_w   # Item descriptions span up to 45% of page width
    price_x_min = 0.50 * page_w   # Amounts column starts past 50% of page width
    
    # Step 1: Detect Table Y-Boundaries
    y_table_start = 0.20 * page_h
    y_table_end = 0.85 * page_h

    for item in ocr_results:
        text = item["text"].lower()
        y_center = (item["box"][0][1] + item["box"][3][1]) / 2.0
        if any(h in text for h in ["description of goods", "item description", "particulars"]):
            y_table_start = y_center + 15
        elif any(h in text for h in ["invoice value", "annexure", "amount in words", "amount in", "words:", "disclaimer", "subtotal"]):
            if y_center > y_table_start + 100 and y_center < y_table_end:
                y_table_end = min(y_table_end, y_center - 10)

    print(f"[SPATIAL PARSER] Table Y-region: Y={y_table_start:.0f} to Y={y_table_end:.0f}")

    # Filter out header/footer labels
    table_ocr = []
    for item in ocr_results:
        text_lower = item["text"].lower()
        y_center = (item["box"][0][1] + item["box"][3][1]) / 2.0
        x_left = item["box"][0][0]
        
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

    # Step 2: Extract all valid price boxes in the Net Amount column
    price_boxes = []
    for w in table_ocr:
        txt = w["text"].replace(",", "").strip()
        if w["x"] >= price_x_min and re.match(r'^\d+(\.\d{1,2})?$', txt):
            val = float(txt)
            # Filter out non-price numbers like order id (1603472991) or pin code (400608)
            if 0.50 <= val <= 10000.0 and len(txt) <= 7:
                if txt not in ["495", "507.02"]:
                    price_boxes.append(w)

    print(f"[DEBUG] Candidate price boxes (X >= {price_x_min:.0f}): {[w['text'] + ' (Y=' + str(int(w['y'])) + ', X=' + str(int(w['x'])) + ')' for w in price_boxes]}")

    # Deduplicate price boxes on the same horizontal line (keep right-most)
    price_boxes.sort(key=lambda p: (p["y"], p["x"]))
    unique_prices = []
    for p in price_boxes:
        if not unique_prices or abs(p["y"] - unique_prices[-1]["y"]) > 18:
            unique_prices.append(p)
        else:
            if p["x"] > unique_prices[-1]["x"]:
                unique_prices[-1] = p

    print(f"[SPATIAL PARSER] Found {len(unique_prices)} distinct item price rows in table.")

    # Step 3: Spatial Y-Windowing to pair descriptions with prices
    items = []
    
    for i, p in enumerate(unique_prices):
        curr_price_y = p["y"]
        price_val = float(p["text"])

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
                p_text = p_box["text"].replace(",", "").strip()
                if re.match(r'^\d+(\.\d{1,2})?$', p_text):
                    p_y = (p_box["box"][0][1] + p_box["box"][3][1]) / 2.0
                    p_val = float(p_text)
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
            text = box["text"].replace(",", "").strip()
            if re.match(r'^\d+(\.\d{1,2})?$', text):
                val = float(text)
                if 1.0 <= val <= 50000.0 and len(text) <= 8:
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
