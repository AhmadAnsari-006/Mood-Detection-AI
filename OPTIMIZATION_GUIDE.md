# Advanced Optimization Guide

This document provides additional optimization techniques to further improve model accuracy beyond the current 85.14%.

## 1. Handle Class Imbalance

### Current Distribution
- joy: 2816 (34%)
- sadness: 2397 (29%)
- anger: 1125 (14%)
- fear: 956 (12%)
- love: 666 (8%)
- surprise: 313 (4%) ← Severely imbalanced

### Solution: Class Weights

Update `train_model.py`:
```python
from sklearn.utils.class_weight import compute_class_weight

# Calculate class weights
classes = np.unique(y_train)
weights = compute_class_weight('balanced', classes=classes, y=y_train)
class_weight_dict = dict(zip(classes, weights))

# Use in SVM
model = SVC(kernel='linear', C=1, class_weight='balanced', probability=True)
```

**Expected improvement**: +2-3% accuracy, especially for minority classes

---

## 2. Advanced Hyperparameter Tuning

### Better GridSearchCV for SVM

```python
from sklearn.model_selection import RandomizedSearchCV

param_grid = {
    'C': [0.1, 0.5, 1, 5, 10, 100],
    'kernel': ['linear', 'rbf', 'poly'],
    'gamma': ['scale', 'auto', 0.001, 0.01, 0.1],
    'degree': [2, 3, 4]  # for poly kernel
}

grid = RandomizedSearchCV(
    SVC(), param_grid, 
    cv=5, 
    n_jobs=-1, 
    n_iter=50,
    scoring='f1_weighted'  # Better for imbalanced data
)
grid.fit(X_train, y_train)
```

**Expected improvement**: +3-5% accuracy

---

## 3. Enhanced Feature Engineering

### Add N-gram Range
```python
# Current: ngram_range=(1,2)
# Try: ngram_range=(1,3)  # Unigram, bigram, trigram
```

### Add Custom Tokenizer
```python
def custom_tokenizer(text):
    # Preserve some punctuation for sentiment indicators
    tokens = text.split()
    return [t.strip('.,!?;:') for t in tokens if t.strip()]

vectorizer = TfidfVectorizer(
    tokenizer=custom_tokenizer,
    ...
)
```

### Increase max_features
```python
# Current: 5000
# Try: 7000 or 10000 (if RAM allows)
# Balance: More features = better representation but longer training
```

---

## 4. Sentiment-Aware Features

Add sentiment intensity indicators:

```python
import re

def extract_sentiment_features(text):
    """Extract additional sentiment indicators"""
    features = {}
    
    # Exclamation marks (usually indicate stronger emotions)
    features['exclamation_count'] = text.count('!')
    
    # Question marks (uncertainty, worry)
    features['question_count'] = text.count('?')
    
    # Uppercase letters (emphasis)
    features['uppercase_ratio'] = sum(1 for c in text if c.isupper()) / len(text)
    
    # Word repetition (emphasis)
    features['repetition'] = len(re.findall(r'(\w)\1{2,}', text))
    
    return features
```

Add to feature matrix as additional columns.

**Expected improvement**: +1-2% accuracy

---

## 5. Ensemble Methods

### Voting Classifier

```python
from sklearn.ensemble import VotingClassifier

voting_clf = VotingClassifier(
    estimators=[
        ('svm', SVC(kernel='linear', C=1, probability=True)),
        ('svm_rbf', SVC(kernel='rbf', C=10, probability=True)),
        ('gb', GradientBoostingClassifier(n_estimators=150))
    ],
    voting='soft'  # Use probability estimates
)

voting_clf.fit(X_train, y_train)
```

**Expected improvement**: +2-4% accuracy

---

## 6. Stratified Cross-Validation

Better validation than single train-test split:

```python
from sklearn.model_selection import StratifiedKFold

skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

cv_scores = cross_validate(
    model, X, y,
    cv=skf,
    scoring=['accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted']
)

print(f"CV Accuracy: {cv_scores['test_accuracy'].mean():.4f} (+/- {cv_scores['test_accuracy'].std():.4f})")
```

---

## 7. Data Augmentation

Artificially expand the training data for minority classes:

```python
from imblearn.over_sampling import RandomOverSampler, SMOTE

# Option 1: Random Oversampling
ros = RandomOverSampler(random_state=42)
X_resampled, y_resampled = ros.fit_resample(X_train, y_train)

# Option 2: SMOTE (better - creates synthetic samples)
smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X_train, y_train)

model.fit(X_resampled, y_resampled)
```

**Expected improvement**: +3-5% accuracy (especially for minority classes)

**Note**: Requires `pip install imbalanced-learn`

---

## 8. Deep Learning Alternative

### Using Scikit-Learn's MLPClassifier

```python
from sklearn.neural_network import MLPClassifier

mlp = MLPClassifier(
    hidden_layer_sizes=(256, 128, 64),
    activation='relu',
    solver='adam',
    batch_size=32,
    learning_rate='adaptive',
    max_iter=200,
    random_state=42,
    early_stopping=True,
    validation_fraction=0.1
)

mlp.fit(X_train, y_train)
```

**Expected improvement**: +5-10% accuracy

---

## 9. Feature Selection

Reduce noise and improve interpretability:

```python
from sklearn.feature_selection import SelectKBest, chi2

selector = SelectKBest(chi2, k=3000)  # Keep top 3000 features
X_train_selected = selector.fit_transform(X_train, y_train)
X_test_selected = selector.transform(X_test)

model.fit(X_train_selected, y_train)
```

**Expected improvement**: +1-2% accuracy, faster training

---

## 10. Probability Calibration

For better confidence scores:

```python
from sklearn.calibration import CalibratedClassifierCV

# Wrap trained model
calibrated_model = CalibratedClassifierCV(model, method='sigmoid', cv=5)
calibrated_model.fit(X_train, y_train)

# Now predictions include well-calibrated probabilities
pred_proba = calibrated_model.predict_proba(X_test)
```

---

## Implementation Priority

**Quick Wins (Easy, High Impact):**
1. Class weights - Add to train_model.py
2. Enhanced GridSearchCV - More thorough tuning
3. Data augmentation (SMOTE) - Especially for rare classes

**Medium Effort:**
4. Ensemble voting classifier
5. Sentiment features
6. Stratified cross-validation

**Advanced (High effort, highest gain):**
7. Deep learning (MLPClassifier)
8. Feature selection + optimization
9. Custom preprocessing

---

## Testing Recommendations

Always evaluate improvements using:
```python
from sklearn.model_selection import cross_validate

cv_results = cross_validate(
    model, X, y,
    cv=StratifiedKFold(5),
    scoring={
        'accuracy': 'accuracy',
        'precision': 'precision_weighted',
        'recall': 'recall_weighted',
        'f1': 'f1_weighted'
    }
)

for metric, scores in cv_results.items():
    if metric.startswith('test_'):
        print(f"{metric}: {scores.mean():.4f} (+/- {scores.std():.4f})")
```

This ensures improvements are statistically significant and not due to random variance.

---

## Expected Overall Improvements

| Technique | Expected Gain | Cumulative |
|-----------|---|---|
| Current Baseline | - | 85.14% |
| Class Weights | +2-3% | 87-88% |
| Better Tuning | +3-5% | 90-93% |
| Ensemble | +2-4% | 92-97% |
| Deep Learning | +5-10% | 97%+ |
| All Combined | +15-20% | 95%+ |

Note: These are estimates. Actual improvements depend on implementation and data characteristics.

---

Last Updated: May 22, 2026
