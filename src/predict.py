import os
from preprocessing import clean_text
import utils

# Global variables to cache loaded model and vectorizer
_model = None
_vectorizer = None

def load_prediction_assets():
    global _model, _vectorizer
    if _model is None or _vectorizer is None:
        model_path = utils.get_model_path("model.pkl")
        vectorizer_path = utils.get_model_path("vectorizer.pkl")
        
        if not os.path.exists(model_path) or not os.path.exists(vectorizer_path):
            raise FileNotFoundError("Model or Vectorizer pickle files not found. Please train the model first.")
            
        _model = utils.load_pickle(model_path)
        _vectorizer = utils.load_pickle(vectorizer_path)
    return _model, _vectorizer

def predict_mood(text):
    model, vectorizer = load_prediction_assets()
    
    # Clean text
    cleaned = clean_text(text)
    if not cleaned:
        return "neutral" # default fallback
    
    # Vectorize & predict
    vec = vectorizer.transform([cleaned])
    pred = model.predict(vec)[0]
    return pred

def predict_mood_with_confidence(text):
    model, vectorizer = load_prediction_assets()
    
    # Clean text
    cleaned = clean_text(text)
    if not cleaned:
        return "neutral", 0.5
    
    # Vectorize
    vec = vectorizer.transform([cleaned])
    
    # Predict
    pred = model.predict(vec)[0]
    
    # Extract confidence
    if hasattr(model, "predict_proba"):
        probas = model.predict_proba(vec)[0]
        classes = list(model.classes_)
        if pred in classes:
            idx = classes.index(pred)
            confidence = probas[idx]
        else:
            confidence = max(probas)
    else:
        confidence = 0.85
        
    return pred, float(confidence)

