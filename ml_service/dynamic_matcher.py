import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SYNONYM_MAP = {
    # Groceries, Fruits & Food Items
    "banana": "groceries fruit fruits food kitchen fresh produce supermarket house",
    "apple": "groceries fruit fruits food kitchen fresh produce supermarket house",
    "mango": "groceries fruit fruits food kitchen fresh produce supermarket house",
    "orange": "groceries fruit fruits food kitchen fresh produce supermarket house",
    "grapes": "groceries fruit fruits food kitchen fresh produce supermarket house",
    "papaya": "groceries fruit fruits food kitchen fresh produce supermarket house",
    "fruit": "groceries fruit fruits food kitchen fresh produce supermarket house",
    "fruits": "groceries fruit fruits food kitchen fresh produce supermarket house",
    "dragon": "groceries fruit fruits food kitchen fresh produce house",
    "gooseberry": "groceries fruit fruits food kitchen amla produce house",
    "amla": "groceries fruit fruits food kitchen gooseberry produce house",
    "amta": "groceries fruit fruits food kitchen gooseberry amla produce house",
    "vegetable": "groceries vegetables veggies food kitchen fresh produce house",
    "vegetables": "groceries vegetables veggies food kitchen fresh produce house",
    "veggies": "groceries vegetables veggies food kitchen fresh produce house",
    "tomato": "groceries vegetables veggies food kitchen house",
    "potato": "groceries vegetables veggies food kitchen batate house",
    "batate": "groceries vegetables veggies food kitchen potato house",
    "onion": "groceries vegetables veggies food kitchen house",
    "beetroot": "groceries vegetables veggies food kitchen beet produce house",
    "beet": "groceries vegetables veggies food kitchen beetroot produce house",
    "chilli": "groceries vegetables veggies food kitchen mirchi hirwi house",
    "mirchi": "groceries vegetables veggies food kitchen chilli hirwi house",
    "cucumber": "groceries vegetables veggies food kitchen kakadi house",
    "kakadi": "groceries vegetables veggies food kitchen cucumber house",
    "brinjal": "groceries vegetables veggies food kitchen vange eggplant house",
    "vange": "groceries vegetables veggies food kitchen brinjal eggplant house",
    "milk": "groceries food daily dairy kitchen amul house",
    "pasteurised": "groceries food daily dairy kitchen milk amul house",
    "cream": "groceries food daily dairy kitchen milk amul house",
    "toned": "groceries food daily dairy kitchen milk amul house",
    "gold": "groceries food daily dairy kitchen milk amul house",
    "curd": "groceries food daily dairy kitchen house",
    "paneer": "groceries food daily dairy kitchen house",
    "butter": "groceries food daily dairy kitchen house",
    "cheese": "groceries food daily dairy kitchen house",
    "bread": "groceries food bakery daily kitchen house",
    "eggs": "groceries food daily kitchen house",
    "rice": "groceries food kitchen grains staples house",
    "wheat": "groceries food kitchen grains staples atta house",
    "atta": "groceries food kitchen grains staples wheat house",
    "dal": "groceries food kitchen pulses staples house",
    "oil": "groceries food kitchen cooking oil staples house",
    "sugar": "groceries food kitchen staples house",
    "salt": "groceries food kitchen staples house",
    "grocery": "groceries food kitchen vegetables milk rice fruits house",
    "groceries": "groceries food kitchen vegetables milk rice fruits house",
    "house": "groceries home house kitchen domestic household",
    "handling": "groceries fee delivery charges house",
    "fee": "groceries fee delivery charges house",

    # Factory & Business synonyms
    "steel": "raw material metals iron construction factory",
    "iron": "raw material metals construction factory",
    "cement": "raw material construction factory",
    "bricks": "raw material construction factory",
    "copper": "raw material metals factory",
    "plastic": "raw material factory",
    "wages": "worker salary payment labor staff employee",
    "worker": "worker salary labor staff employee",
    "salary": "worker salary wages staff payment",
    "labor": "worker salary wages staff employee",
    "machinery": "equipment maintenance repair tools factory",
    "machine": "equipment maintenance repair tools factory",
    "generator": "machinery fuel diesel electricity power factory",
    "diesel": "fuel gas generator machinery transport",
    "petrol": "fuel gas vehicle transport travel",
    
    # Utilities & Home synonyms
    "light": "electricity power bill energy utility",
    "power": "electricity bill energy power utility",
    "electricity": "electricity bill power energy utility",
    "water": "water bill utility municipal",
    "maid": "house help maid salary domestic servant",
    "rent": "house rent office rent lease deposit",

    # Travel & Dining synonyms
    "cab": "travel transport taxi uber rapido auto fare",
    "taxi": "travel transport cab uber auto fare",
    "coffee": "food cafe drinks beverage tea snacks",
    "tea": "food cafe drinks beverage chai snacks",
    "food": "food dining meal lunch dinner swiggy zomato restaurant"
}

def expand_text(text):
    """Enriches text by appending relevant financial synonyms."""
    words = re.findall(r'\w+', text.lower())
    expanded = list(words)
    for word in words:
        if word in SYNONYM_MAP:
            expanded.append(SYNONYM_MAP[word])
    return " ".join(expanded)

def match_transaction_to_user_categories(txn_name, user_categories):
    """
    Computes TF-IDF Cosine Similarity between txn_name and user's dynamic categories list.
    
    user_categories format:
    [
        {"name": "Factory", "subcategories": ["Raw Material", "Worker Salary", "Machinery Repair"]},
        {"name": "Home", "subcategories": ["Groceries", "Electricity Bill", "Rent"]}
    ]
    """
    if not user_categories or not txn_name:
        return None

    # Flatten user categories into candidate pairs
    candidate_pairs = []
    candidate_texts = []

    for cat in user_categories:
        main_name = cat.get("name", "")
        sub_list = cat.get("subcategories", [])
        
        if not sub_list:
            # Fallback if no subcategories exist
            candidate_pairs.append((main_name, "Others"))
            candidate_texts.append(expand_text(f"{main_name} Others"))
        else:
            for sub_name in sub_list:
                candidate_pairs.append((main_name, sub_name))
                # Combine mainCategory + subCategory string and expand with synonyms
                combined_desc = f"{main_name} {sub_name}"
                candidate_texts.append(expand_text(combined_desc))

    if not candidate_pairs:
        return None

    # 1. Expand input transaction name
    expanded_txn = expand_text(txn_name)

    # 2. Build TF-IDF Vectorizer across input and candidate texts
    all_texts = [expanded_txn] + candidate_texts
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), lowercase=True)
    
    try:
        tfidf_matrix = vectorizer.fit_transform(all_texts)
    except ValueError:
        # If vectorizer fails due to empty vocabulary
        return {
            "mainCategory": candidate_pairs[0][0],
            "subCategory": candidate_pairs[0][1],
            "confidence": 0.50
        }

    # 3. Calculate Cosine Similarity between Txn (index 0) and Candidates (indices 1..N)
    txn_vec = tfidf_matrix[0]
    candidates_vec = tfidf_matrix[1:]
    
    similarity_scores = cosine_similarity(txn_vec, candidates_vec).flatten()

    # 4. Find candidate with highest similarity score
    best_idx = int(np.argmax(similarity_scores))
    best_score = float(similarity_scores[best_idx])
    best_main, best_sub = candidate_pairs[best_idx]

    # Normalize score for friendly confidence percentage display (e.g. 0.50 -> 0.90)
    confidence = min(0.99, max(0.65, round(best_score + 0.35 if best_score > 0.05 else 0.50, 2)))

    return {
        "mainCategory": best_main,
        "subCategory": best_sub,
        "confidence": confidence,
        "rawScore": round(best_score, 4)
    }

# Test sample if run standalone
if __name__ == "__main__":
    sample_categories = [
        {"name": "Factory", "subcategories": ["Raw Material", "Worker Salary", "Machinery Maintenance", "Power Bill"]},
        {"name": "Home", "subcategories": ["Groceries", "House Rent", "Maid Salary", "Electricity Bill"]},
        {"name": "Personal", "subcategories": ["Food & Cafe", "Travel & Cabs", "Shopping"]}
    ]

    test_queries = [
        "banana 1 dozen",
        "apple 1 kg",
        "milk and eggs",
        "Purchased 100kg Steel rods for construction",
        "Paid weekly wages to Ramesh labor",
        "Electricity bill for home",
        "Swiggy lunch food order",
        "Uber cab fare"
    ]

    print("--- Dynamic User-Category Matcher Test Results ---")
    for q in test_queries:
        res = match_transaction_to_user_categories(q, sample_categories)
        print(f" * Input: '{q}'")
        print(f"   -> Matched: {res['mainCategory']} -> {res['subCategory']} ({res['confidence']*100:.0f}% confidence | raw score: {res['rawScore']})\n")
