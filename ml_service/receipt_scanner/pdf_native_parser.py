"""
pdf_native_parser.py
─────────────────────────────────────────────────────────────────
Native PDF text-layer extractor for digitally generated invoices.

Strategy
────────
1. Use PyMuPDF to check if the PDF has a usable text layer
   (char count > threshold -> "native PDF", not a scanned image).
2. Extract each page as a list of word dicts: { text, x0, y0, x1, y1 }.
3. Reconstruct rows by grouping words that share a similar Y-midpoint.
4. Detect the item-description column and the "Total" / "Net" price column
   using the header row keyword positions.
5. For each product row, output clean (description, price) pairs.

This gives zero-OCR-noise extraction for Blinkit / Swiggy tax invoices.
"""

import re
import sys
import os

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from receipt_scanner.receipt_parser import safe_float, clean_item_name


# ─────────────────────────────────────────────────────────────────────────────
# Section 1: Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _is_subrow_fee_text(text: str) -> bool:
    """True for the hyphen-prefixed sub-row fee strings in Blinkit invoices."""
    t = text.strip()
    return (
        t.startswith("-") and
        any(k in t.lower() for k in ["delivery", "charges", "handling", "order"])
    )

def _is_header_keyword(text: str) -> bool:
    """True for recognised table-column header words."""
    t = text.lower().strip()
    HEADERS = [
        "sr", "upc", "item", "description", "mrp", "discount", "qty",
        "taxable", "value", "cgst", "sgst", "cess", "additional", "total",
        "no.", "no", "s.no", "s no", "price", "rate", "amount",
    ]
    return t in HEADERS or t.rstrip('.') in HEADERS

def _is_doc_metadata(text: str) -> bool:
    """True for invoice header / footer text that is NOT a product."""
    SKIP_PATTERNS = [
        r'sold\s*by', r'seller', r'blinkit', r'commerce', r'gstin', r'fssai',
        r'cin\b', r'pan\b', r'invoice\s*(number|to|date)', r'order\s*id',
        r'place\s*of\s*supply', r'pin\s*code', r'state\b', r'moreshwar',
        r'dhokali', r'kalwa', r'thane', r'mumbai', r'maharashtra',
        r'runwal', r'narayana', r'balkum', r'majiwada', r'terms\s*&\s*conditions',
        r'authorised\s*signatory', r'whether\s*the\s*tax', r'reverse\s*charge',
        r'annexure', r'nature\s*of\s*charge', r'taxable\s*value', r'amount\s*in\s*words',
        r'tax\s*invoice', r'sr\.\s*no', r'tax\s*summary', r'tax\s*rate',
        r'customer\s*address', r'billing\s*address', r'shipping\s*address',
        r'hsn\s*code', r'upc',
    ]
    t = text.lower()
    for pat in SKIP_PATTERNS:
        if re.search(pat, t):
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Section 2: Is this a native (text-layer) PDF?
# ─────────────────────────────────────────────────────────────────────────────

def is_native_pdf(file_path: str, min_chars: int = 150) -> bool:
    """
    Returns True if the PDF has a text layer with enough characters to be
    processed natively (i.e. it is NOT a scanned image).
    """
    try:
        doc = fitz.open(file_path)
        total_chars = sum(len(page.get_text("text")) for page in doc)
        doc.close()
        print(f"[PDF NATIVE] '{os.path.basename(file_path)}' text-layer char count: {total_chars}")
        return total_chars >= min_chars
    except Exception as e:
        print(f"[PDF NATIVE] Could not check text layer: {e}")
        return False


# -----------------------------------------------------------------------------
# Section 3: Word-level extraction from text layer
# -----------------------------------------------------------------------------

def _extract_words_per_page(file_path: str, max_pages: int = 5):
    """
    Extract every word from the PDF text layer, returning a LIST OF PAGES.
    Each page is a list of word dicts: { text, x0, y0, x1, y1, xm, ym }.
    Coordinates are LOCAL to the page (no Y stacking between pages).
    PyMuPDF get_text('words') returns (x0,y0,x1,y1,text,block,line,word).
    """
    doc = fitz.open(file_path)
    pages_words = []
    for page_num in range(min(len(doc), max_pages)):
        page = doc[page_num]
        page_words = []
        for w in page.get_text("words"):
            x0, y0, x1, y1, text = w[0], w[1], w[2], w[3], w[4]
            text = text.strip()
            if not text:
                continue
            page_words.append({
                "text": text,
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1,
                "xm": (x0 + x1) / 2.0,
                "ym": (y0 + y1) / 2.0,
            })
        pages_words.append(page_words)
    doc.close()
    return pages_words


# Keep old flat extractor for backward compat (used in debug scripts)
def _extract_words_from_pdf(file_path: str, max_pages: int = 3):
    """Flat word list with Y-stacked pages (kept for debug scripts)."""
    doc = fitz.open(file_path)
    words = []
    page_offset_y = 0.0
    for page_num in range(min(len(doc), max_pages)):
        page = doc[page_num]
        page_h = page.rect.height
        for w in page.get_text("words"):
            x0, y0, x1, y1, text = w[0], w[1], w[2], w[3], w[4]
            text = text.strip()
            if not text:
                continue
            words.append({
                "text": text,
                "x0": x0, "y0": y0 + page_offset_y,
                "x1": x1, "y1": y1 + page_offset_y,
                "xm": (x0 + x1) / 2.0,
                "ym": (y0 + y1) / 2.0 + page_offset_y,
                "page": page_num,
            })
        page_offset_y += page_h + 20.0
    doc.close()
    return words


# ─────────────────────────────────────────────────────────────────────────────
# Section 4: Group words into rows
# ─────────────────────────────────────────────────────────────────────────────

def _group_into_rows(words, y_tolerance: float = 6.0):
    """
    Group words into horizontal rows using Y-midpoint proximity.
    Returns list of rows; each row is a list of word dicts sorted by x0.
    """
    if not words:
        return []

    sorted_words = sorted(words, key=lambda w: (w["ym"], w["x0"]))
    rows = []
    current_row = [sorted_words[0]]

    for word in sorted_words[1:]:
        if abs(word["ym"] - current_row[-1]["ym"]) <= y_tolerance:
            current_row.append(word)
        else:
            rows.append(sorted(current_row, key=lambda w: w["x0"]))
            current_row = [word]
    rows.append(sorted(current_row, key=lambda w: w["x0"]))
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Section 5: GST Tax Invoice structured parser
# ─────────────────────────────────────────────────────────────────────────────

def _find_header_row(rows):
    """
    Locate the table header row containing "Item Description" or "Description".
    Returns (header_row_index, header_row) or (None, None).
    """
    HEADER_SIGNALS = ["item description", "description of goods", "description", "particulars", "item name"]
    for idx, row in enumerate(rows):
        row_text = " ".join(w["text"] for w in row).lower()
        if any(sig in row_text for sig in HEADER_SIGNALS):
            return idx, row
    return None, None


def _find_column_x_range(header_row, col_name_patterns, page_width):
    """
    Scan header_row for words matching col_name_patterns and return
    the (x_start, x_end) bounding box for that column.
    """
    if not header_row:
        return None, None

    for word in header_row:
        wt = word["text"].lower()
        for pat in col_name_patterns:
            if re.search(pat, wt):
                return word["x0"], word["x1"] + page_width * 0.18  # generous right bound
    return None, None


def _parse_gst_invoice_rows(rows, header_idx, header_row, page_width):
    """
    Parse rows below the header as GST invoice table rows.

    Uses a state-machine accumulator:
    - Each product spans one "anchor" row (has a price in the Total column)
      plus zero or more "continuation" rows (description/HSN overflow, no price).
    - We accumulate all description words from anchor + continuation rows,
      then emit the item when the next anchor row (or footer) is reached.

    Column detection strategy:
    - Description column: x0 between UPC column end (~70px) and ≤52% page width.
    - "Total" column: rightmost column, x0 ≥ 92% of page width (for Blinkit ≈530px on 561px page).
    - Sub-row fee lines starting with '-' are aggregated into "Delivery & Order Charges".
    """
    items = []
    delivery_fees = []

    # Detect exact "Total" column X position from header row
    total_col_x = None
    for word in header_row:
        wt = word["text"].lower().rstrip(".")
        if wt in ["total", "net", "amount"]:
            total_col_x = word["x0"]
            break

    # Fallback: rightmost column is the Total column
    if total_col_x is None:
        total_col_x = page_width * 0.90

    # Price is valid only from the Total column (allow 20px slack)
    price_x_min = total_col_x - 20.0

    # Detect description column right boundary dynamically:
    # Find the x0 of the "Quantity" / "Qty" / "No" column which comes AFTER description.
    # Everything to the right of that is Quantity/SAC/Tax columns, not description.
    desc_col_end_x = None
    QTY_COLUMN_KEYWORDS = {"quantity", "qty", "qty.", "no", "no.", "upc", "uqc", "nos", "sac", "hsn"}
    # Find x positions of header words in the right half of the page
    desc_header_words = sorted(header_row, key=lambda w: w["x0"])
    for i, w in enumerate(desc_header_words):
        wt = w["text"].lower().rstrip(".")
        if wt in QTY_COLUMN_KEYWORDS:
            # Use x0 of this column minus a small margin as the desc right boundary
            desc_col_end_x = w["x0"] - 5.0
            break

    # Fallback: use 52% of page width as desc right boundary
    if desc_col_end_x is None or desc_col_end_x < page_width * 0.10:
        desc_col_end_x = page_width * 0.52

    desc_x_min = 0.0   # include all from left edge (Sr.no numbers are filtered by isdigit())
    desc_x_max = desc_col_end_x

    print(f"[PDF NATIVE] Total col at x={total_col_x:.0f}, price_x_min={price_x_min:.0f}, desc range [{desc_x_min:.0f},{desc_x_max:.0f}]")


    # Stop extraction at common footer signals
    STOP_SIGNALS = [
        "amount in words", "terms & conditions", "annexure", "reverse charge",
        "authorised signatory", "tax summary", "invoice value", "grand total",
        "nature of charge",
    ]

    # State machine buffers
    pending_desc_words = []   # accumulated description tokens for current item
    pending_price = None       # price found for current item (from Total column)

    def _flush_item():
        """Emit a completed item from accumulated state."""
        nonlocal pending_desc_words, pending_price
        if pending_price is None or pending_price <= 0.0:
            pending_desc_words = []
            pending_price = None
            return

        raw_desc = " ".join(pending_desc_words)
        clean_name = clean_item_name(raw_desc)
        if clean_name and not any(kw in clean_name.lower() for kw in [
            "total", "amount in words", "grand total", "invoice value",
            "subtotal", "eight hundred", "disclaimer", "tax rate"
        ]):
            items.append({
                "item_index": len(items) + 1,
                "name": clean_name,
                "quantity": 1,
                "price": pending_price,
            })
            print(f"[PDF NATIVE] Item: '{clean_name}' -> Rs.{pending_price:.2f}")

        pending_desc_words = []
        pending_price = None

    # For normal pages: iterate rows AFTER the header
    # For continuation pages (header_idx=-1): iterate ALL rows from the beginning
    start_row = 0 if header_idx < 0 else header_idx + 1

    for row in rows[start_row:]:
        row_text = " ".join(w["text"] for w in row)
        row_text_lower = row_text.lower()

        # Stop at footer
        if any(sig in row_text_lower for sig in STOP_SIGNALS):
            _flush_item()
            break

        # Skip pure metadata rows
        if _is_doc_metadata(row_text):
            continue

        # ── Sub-row fee line (e.g. "-Delivery and other charges---5.78 2.50 ... 6.07") ──
        if row_text_lower.strip() in ["charges", "charge", "-charges"]:
            continue

        if row_text.lstrip().startswith("-") and any(
            k in row_text_lower for k in ["delivery", "charge", "handling"]
        ):
            _flush_item()
            # The rightmost number on this row is the total fee
            nums = re.findall(r'\d+\.?\d*', row_text)
            if nums:
                fee_val = safe_float(nums[-1])
                if 0.01 <= fee_val <= 500.0:
                    delivery_fees.append(fee_val)
            continue


        # Check if this row has a price in the Total column
        price_words_in_total_col = [
            w["text"] for w in row if w["x0"] >= price_x_min
        ]
        row_price = None
        for pw in reversed(price_words_in_total_col):
            v = safe_float(pw)
            if 0.50 <= v <= 15000.0:
                row_price = v
                break

        # Collect description words from this row (left portion only)
        row_desc_words = [
            w["text"] for w in row
            if desc_x_min <= w["x0"] <= desc_x_max
        ]
        filtered_row_desc = [
            t for t in row_desc_words
            if not re.match(r'^\d{4,}$', t) 
            and "HSN" not in t.upper() 
            and not re.match(r'^\d+(?:\.\d+)?%$', t) 
            and t not in ["%", "+", "0.00%", "="]
        ]

        # Check if this row starts a new item number (e.g. "1", "2", "3", "1.", "2.")
        is_new_item_num_row = False
        if filtered_row_desc:
            first_t = filtered_row_desc[0].rstrip('.')
            if first_t.isdigit() and int(first_t) <= 200:
                is_new_item_num_row = True

        if is_new_item_num_row and pending_price is not None:
            _flush_item()

        if row_price is not None:
            if pending_price is not None:
                # Flush previous item if it already had its price captured
                _flush_item()
            pending_desc_words.extend(filtered_row_desc)
            pending_price = row_price
        elif filtered_row_desc:
            # Continuation row (no price) -> accumulate description
            pending_desc_words.extend(filtered_row_desc)

    # Flush the last item if any
    _flush_item()


    # Aggregate delivery sub-row fees
    if delivery_fees:
        total_fee = round(sum(delivery_fees), 2)
        if total_fee > 0.0 and not any("delivery" in it["name"].lower() for it in items):
            items.append({
                "item_index": len(items) + 1,
                "name": "Delivery & Order Charges",
                "quantity": 1,
                "price": total_fee,
            })
            print(f"[PDF NATIVE] Aggregated delivery fees -> Rs.{total_fee:.2f}")

    return items



# ─────────────────────────────────────────────────────────────────────────────
# Section 6: Simple line-by-line parser (Blinkit / Swiggy simple receipts)
# ─────────────────────────────────────────────────────────────────────────────

def _parse_simple_receipt_rows(rows, page_width):
    """
    Fallback parser for simple Blinkit / Swiggy receipts that don't have
    a formal GST table header.  Looks for rows that have a description on
    the left and a price on the right.
    """
    items = []
    seen_names = set()
    price_x_min = page_width * 0.55

    SKIP_SIGNALS = [
        "total", "sub total", "subtotal", "grand total", "amount", "savings",
        "you saved", "discount", "coupon", "promo", "platform fee", "gst",
        "cgst", "sgst", "mrp", "taxes", "invoice", "order id", "bill to",
        "date", "payment", "mode", "upi", "cash", "wallet", "card",
        "thank you", "customer", "seller", "gstin", "address",
    ]

    for row in rows:
        row_text = " ".join(w["text"] for w in row)
        row_text_lower = row_text.lower()

        # Skip metadata / summary rows
        if _is_doc_metadata(row_text):
            continue
        if any(s in row_text_lower for s in SKIP_SIGNALS):
            continue

        # Collect left-side description words
        desc_words = [w["text"] for w in row if w["x0"] < page_width * 0.60]
        price_words = [w["text"] for w in row if w["x0"] >= price_x_min]

        raw_desc = " ".join(desc_words)
        clean_name = clean_item_name(raw_desc)
        if not clean_name or len(clean_name) < 3:
            continue

        # Find price
        price_val = 0.0
        for pw in reversed(price_words):
            v = safe_float(pw)
            if 0.50 <= v <= 15000.0:
                price_val = v
                break

        if price_val == 0.0:
            continue

        name_key = clean_name.lower()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)

        items.append({
            "item_index": len(items) + 1,
            "name": clean_name,
            "quantity": 1,
            "price": price_val,
        })
        print(f"[PDF NATIVE SIMPLE] Item: '{clean_name}' -> Rs.{price_val:.2f}")

    return items


# -----------------------------------------------------------------------------
# Section 7: Public API
# ─────────────────────────────────────────────────────────────────────────────

def parse_pdf_natively(file_path: str):
    """
    Main entry point. Extracts structured line items from a native (text-layer)
    PDF invoice without using OCR.

    Processes EACH PAGE independently so that footer signals on page 1
    (e.g. 'Amount in words', 'Terms & Conditions') do not stop extraction
    of products on page 2 or 3.

    Returns a list of item dicts compatible with parse_receipt_items_spatial():
        [{ "item_index", "name", "quantity", "price" }, ...]
    """
    print(f"[PDF NATIVE] Starting native text extraction from '{os.path.basename(file_path)}'")

    pages_words = _extract_words_per_page(file_path, max_pages=5)
    print(f"[PDF NATIVE] PDF has {len(pages_words)} pages to process")

    all_items = []
    # Track seen names globally across pages to avoid duplicates
    seen_names_global = set()
    # Remember last detected header so pages without a header use it
    last_header_row = None
    last_page_width = 595.0

    for page_num, page_words in enumerate(pages_words):
        if not page_words:
            print(f"[PDF NATIVE] Page {page_num+1}: empty, skipping")
            continue

        page_width = max(w["x1"] for w in page_words)
        rows = _group_into_rows(page_words, y_tolerance=6.0)
        print(f"[PDF NATIVE] Page {page_num+1}: {len(page_words)} words, {len(rows)} rows, width={page_width:.0f}")

        # Try to find a table header on this page
        header_idx, header_row = _find_header_row(rows)

        if header_idx is not None:
            print(f"[PDF NATIVE] Page {page_num+1}: found table header at row {header_idx}")
            last_header_row = header_row
            last_page_width = page_width
        elif last_header_row is not None:
            # No header on this page but we have one from a previous page ->
            # this might be a continuation page. Use row 0 as the starting point.
            header_idx = -1   # signals: start from row 0 (no header to skip)
            header_row = last_header_row
            page_width = last_page_width
            print(f"[PDF NATIVE] Page {page_num+1}: no header, using header from previous page")
        else:
            print(f"[PDF NATIVE] Page {page_num+1}: no header found, trying simple parser")
            page_items = _parse_simple_receipt_rows(rows, page_width)
            _merge_items(page_items, all_items, seen_names_global)
            continue

        # header_idx=-1 means "continuation page, start from row 0"
        # header_idx>=0 means start from rows[header_idx+1] (skip the header row itself)
        page_items = _parse_gst_invoice_rows(rows, header_idx, header_row, page_width)
        _merge_items(page_items, all_items, seen_names_global)

    # Re-number item_index sequentially
    for i, item in enumerate(all_items):
        item["item_index"] = i + 1

    if all_items:
        print(f"[PDF NATIVE] Total extracted across all pages: {len(all_items)} items (OK)")
    else:
        print("[PDF NATIVE] Native extraction found 0 items - caller should fall back to OCR")

    return all_items


def _merge_items(new_items, all_items, seen_names_global):
    """Add new_items into all_items, skipping duplicates by name.
    Delivery charges across pages are accumulated (summed) rather than duplicated.
    """
    for item in new_items:
        name_key = item["name"].lower().strip()
        if not name_key:
            continue

        # Delivery charges: always accumulate across pages regardless of dedup state
        if "delivery" in name_key:
            existing_delivery = next(
                (it for it in all_items if "delivery" in it["name"].lower()), None
            )
            if existing_delivery:
                existing_delivery["price"] = round(
                    existing_delivery["price"] + item["price"], 2
                )
                print(f"[PDF NATIVE MERGE] Accumulated delivery -> Rs.{existing_delivery['price']:.2f}")
                continue
            # No existing delivery entry: fall through to add as new item

        # Regular items: skip if already seen
        if name_key in seen_names_global:
            continue

        seen_names_global.add(name_key)
        all_items.append(item)
