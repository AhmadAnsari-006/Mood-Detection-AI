from sklearn.feature_extraction.text import TfidfVectorizer

def get_vectorizer():
    return TfidfVectorizer(
        stop_words='english',
        ngram_range=(1, 2),   # unigram + bigram
        max_df=0.95,          # Increased from 0.9 for better feature coverage
        min_df=1,             # Reduced from 2 to capture more features
        max_features=5000,    # Limit features to avoid overfitting
        sublinear_tf=True,    # Apply sublinear tf scaling for better performance
        strip_accents='unicode',
        lowercase=True,
        analyzer='word',
        token_pattern=r'\w{1,}'
    )
