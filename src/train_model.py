import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report, confusion_matrix
import numpy as np

from preprocessing import clean_text
from feature_engineering import get_vectorizer
import utils

def train():
    # Get paths
    data_path = utils.get_data_path("final_cleaned_data.csv.xls")
    print(f"Loading data from: {data_path}")
    
    df = pd.read_csv(data_path)
    print(f"Dataset shape: {df.shape}")
    print(f"Class distribution:\n{df['emotion'].value_counts()}")

    # Clean text
    print("\nPreprocessing text data...")
    df = df.dropna(subset=['clean_text'])
    df['clean_text'] = df['clean_text'].apply(clean_text)

    # Feature engineering
    print("Vectorizing text data...")
    vectorizer = get_vectorizer()
    X = vectorizer.fit_transform(df['clean_text'])
    y = df['emotion']
    print(f"Feature matrix shape: {X.shape}")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Training set size: {X_train.shape[0]}, Test set size: {X_test.shape[0]}")

    # Train multiple models and compare
    models = {
        'SVM (Linear)': SVC(kernel='linear', C=1, probability=True),
        'SVM (RBF)': SVC(kernel='rbf', C=10, probability=True),
        'Random Forest': RandomForestClassifier(n_estimators=200, max_depth=20, random_state=42, n_jobs=-1),
        'Gradient Boosting': GradientBoostingClassifier(n_estimators=150, learning_rate=0.05, max_depth=5, random_state=42)
    }
    
    best_model = None
    best_accuracy = 0
    best_model_name = None
    results = {}
    
    print("\n" + "="*80)
    print("Training and evaluating models...")
    print("="*80)
    
    for model_name, model in models.items():
        print(f"\nTraining {model_name}...")
        model.fit(X_train, y_train)
        
        # Predictions
        y_pred = model.predict(X_test)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        
        results[model_name] = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1
        }
        
        print(f"  Accuracy:  {accuracy:.4f}")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1-Score:  {f1:.4f}")
        
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_model = model
            best_model_name = model_name
    
    print("\n" + "="*80)
    print(f"Best Model: {best_model_name} with Accuracy: {best_accuracy:.4f}")
    print("="*80)
    
    # Detailed evaluation for best model
    print(f"\n\nDetailed Classification Report for {best_model_name}:")
    y_pred = best_model.predict(X_test)
    print(classification_report(y_test, y_pred))
    
    print(f"\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    # Save best model and vectorizer
    model_path = utils.get_model_path("model.pkl")
    vectorizer_path = utils.get_model_path("vectorizer.pkl")
    
    utils.save_pickle(best_model, model_path)
    utils.save_pickle(vectorizer, vectorizer_path)
    print(f"\nBest model saved to {model_path}")
    print(f"Vectorizer saved to {vectorizer_path}")

if __name__ == "__main__":
    train()