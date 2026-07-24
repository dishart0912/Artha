import os
import pandas as pd
import joblib

# Import scikit-learn modules for ML pipeline, model, and metrics
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.metrics import classification_report, accuracy_score

def train_and_evaluate_model():
    # Define absolute file paths
    base_dir = os.path.dirname(__file__)
    csv_path = os.path.join(base_dir, "receipt_dataset.csv")
    model_path = os.path.join(base_dir, "receipt_model.joblib")

    print(f"[STEP 1] Loading training dataset from '{csv_path}'...")
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} total dataset rows.")

    # Step 2: Separate Features (X) and Target Labels (y)
    X = df["item_name"]
    y = df["category"]

    # Step 3: Split into 80% Training and 20% Testing sets
    # random_state=42 guarantees reproducible random splitting
    # stratify=y ensures balanced category distribution in train and test sets
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"[STEP 2] Data Split Complete: {len(X_train)} training samples, {len(X_test)} test samples.")

    # Step 4: Build a scikit-learn Pipeline
    # TfidfVectorizer converts text -> TF-IDF feature matrices
    # LogisticRegression with class_weight='balanced' handles class imbalance
    print("[STEP 3] Training Logistic Regression Model with TF-IDF Vectorizer...")
    pipeline = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), stop_words="english", lowercase=True),
        LogisticRegression(C=5.0, class_weight='balanced', max_iter=1000, random_state=42)
    )

    # Train the pipeline on the training data
    pipeline.fit(X_train, y_train)
    print("[COMPLETED] Model training finished successfully!")

    # Step 5: Evaluate Model on the Hidden Test Set
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    
    print("\n" + "=" * 55)
    print(f"  MODEL PERFORMANCE EVALUATION (Accuracy: {acc * 100:.2f}%)")
    print("=" * 55)
    print(classification_report(y_test, y_pred, zero_division=0))

    # Step 6: Save the trained model pipeline to disk using joblib
    joblib.dump(pipeline, model_path)
    print(f"[SUCCESS] Trained model pipeline saved to: '{model_path}'")

if __name__ == "__main__":
    train_and_evaluate_model()
