import re

# Try to import NLTK for lemmatization, fall back to simple processing if not available
try:
    from nltk.stem import WordNetLemmatizer
    import nltk
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt', quiet=True)
    try:
        nltk.data.find('corpora/wordnet')
    except LookupError:
        nltk.download('wordnet', quiet=True)
    lemmatizer = WordNetLemmatizer()
    HAS_NLTK = True
except ImportError:
    HAS_NLTK = False
    lemmatizer = None

def clean_text(text):
    text = str(text).lower()
    # Remove punctuation and special characters
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Lemmatize words for better feature extraction (if NLTK available)
    if HAS_NLTK and lemmatizer:
        tokens = text.split()
        tokens = [lemmatizer.lemmatize(token) for token in tokens if len(token) > 2]
        return ' '.join(tokens)
    else:
        # Without NLTK, just filter short words
        tokens = text.split()
        tokens = [token for token in tokens if len(token) > 2]
        return ' '.join(tokens)
