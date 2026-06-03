# Libraries Used in Mood-Detection-AI

This document provides a detailed overview of all the libraries and modules used in the **Mood-Detection-AI** project, along with their purpose and where they are used in the codebase.

---

## Third-Party Libraries (installed via pip)

### 1. Flask
- **Package**: `flask`
- **Purpose**: A lightweight Python web framework used to build the web application, handle HTTP requests/responses, serve HTML templates, and manage routes.
- **Where Used**:
  - `app/app.py` — Initializes the Flask app, registers blueprints, and defines routes.
  - `app/routes_auth.py` — Authentication-related API routes (signup, signin, logout, session management).
  - `app/routes_feedback.py` — Mood prediction and user feedback API routes.
  - `app/routes_dev.py` — Developer portal API routes (analytics, dataset management, backups, corrections).
  - `app/services/auth_service.py` — Uses Flask's `request`, `jsonify`, and `g` objects for auth decorators.
- **Key Components Used**: `Flask`, `Blueprint`, `render_template`, `request`, `jsonify`, `make_response`, `send_file`, `g`

---

### 2. Scikit-learn (sklearn)
- **Package**: `scikit-learn`
- **Purpose**: Machine learning library used for text classification (mood/emotion detection). It provides ML algorithms, model evaluation metrics, and text vectorization tools.
- **Where Used**:
  - `src/train_model.py` — Training multiple ML classifiers (SVM, Random Forest, Gradient Boosting), model evaluation, and comparison.
  - `src/feature_engineering.py` — TF-IDF text vectorization using `TfidfVectorizer`.
- **Key Components Used**:
  - `sklearn.model_selection`: `train_test_split`, `GridSearchCV`, `cross_val_score`
  - `sklearn.svm`: `SVC` (Support Vector Classifier)
  - `sklearn.ensemble`: `RandomForestClassifier`, `GradientBoostingClassifier`
  - `sklearn.metrics`: `accuracy_score`, `precision_score`, `recall_score`, `f1_score`, `classification_report`, `confusion_matrix`
  - `sklearn.feature_extraction.text`: `TfidfVectorizer`

---

### 3. Pandas
- **Package**: `pandas`
- **Purpose**: Data manipulation and analysis library. Used for loading, cleaning, and processing the training dataset (CSV/XLS file).
- **Where Used**:
  - `src/train_model.py` — Reading the dataset with `pd.read_csv()`, handling missing values with `dropna()`, applying text preprocessing, and analyzing class distribution.
- **Key Components Used**: `pd.read_csv()`, `DataFrame.apply()`, `DataFrame.dropna()`, `DataFrame.shape`, `Series.value_counts()`

---

### 4. NumPy
- **Package**: `numpy`
- **Purpose**: Fundamental package for numerical computing in Python. Used for array operations and numerical manipulations.
- **Where Used**:
  - `src/train_model.py` — Imported for numerical operations during model training.
  - `src/predict.py` — Imported for handling prediction arrays and probability computations.
- **Key Components Used**: `numpy` (general array operations)

---

### 5. NLTK (Natural Language Toolkit)
- **Package**: `nltk`
- **Purpose**: Natural language processing library used for text preprocessing, specifically word lemmatization to normalize words to their base form (e.g., "running" → "run").
- **Where Used**:
  - `src/preprocessing.py` — Lemmatizes text tokens using `WordNetLemmatizer`. Automatically downloads required NLTK data packages (`punkt` tokenizer and `wordnet` corpus) if not already present.
- **Key Components Used**:
  - `nltk.stem.WordNetLemmatizer` — Lemmatization of words
  - `nltk.data.find()` — Checking for available NLTK data
  - `nltk.download()` — Downloading required corpora (`punkt`, `wordnet`)
- **Required NLTK Data**:
  - `tokenizers/punkt` — Sentence/word tokenizer
  - `corpora/wordnet` — Lexical database for lemmatization

---

## Python Standard Library Modules

These modules come pre-installed with Python and do not require separate installation.

| Module | Purpose | Where Used |
|---|---|---|
| `os` | File system operations, path handling | `app/app.py`, `src/predict.py`, `src/utils.py`, `app/services/db_service.py`, `app/routes_dev.py` |
| `sys` | System path manipulation for module imports | `app/app.py`, `app/routes_auth.py`, `app/routes_feedback.py`, `app/routes_dev.py` |
| `re` | Regular expressions for text cleaning | `src/preprocessing.py` |
| `pickle` | Serialization/deserialization of ML models and vectorizers | `src/utils.py` |
| `json` | Reading/writing JSON database files | `app/services/db_service.py`, `app/routes_dev.py` |
| `uuid` | Generating unique identifiers for users, sessions, predictions | `app/services/auth_service.py`, `app/services/db_service.py`, `app/routes_feedback.py` |
| `hashlib` | SHA-256 password hashing | `app/services/db_service.py` |
| `shutil` | File/directory copy operations for backups | `app/services/db_service.py` |
| `threading` | Thread-safe locks for concurrent database access | `app/services/db_service.py` |
| `io` | In-memory file streams for dataset export | `app/routes_dev.py` |
| `datetime` | Timestamp generation, session management, analytics | `app/services/auth_service.py`, `app/services/db_service.py`, `app/services/learning_service.py`, `app/routes_feedback.py`, `app/routes_dev.py` |
| `functools` | `wraps` decorator for auth middleware | `app/services/auth_service.py` |

---

## Auto-installed Dependencies (installed automatically with main packages)

These are transitive dependencies — they get installed automatically when you install the main packages listed above.

| Dependency | Installed With | Purpose |
|---|---|---|
| `Werkzeug` | Flask | WSGI utility library for Flask |
| `Jinja2` | Flask | Template engine for Flask HTML rendering |
| `MarkupSafe` | Jinja2 | Safe string markup for HTML escaping |
| `itsdangerous` | Flask | Secure data signing |
| `click` | Flask | Command-line interface toolkit |
| `blinker` | Flask | Signal/event support |
| `colorama` | click | Colored terminal output on Windows |
| `SciPy` | scikit-learn | Scientific computing (used internally by sklearn) |
| `joblib` | scikit-learn | Parallel computing and model persistence |
| `threadpoolctl` | scikit-learn | Thread pool management |
| `python-dateutil` | pandas | Date parsing utilities |
| `pytz` / `tzdata` | pandas | Timezone handling |
| `six` | python-dateutil | Python 2/3 compatibility |
| `regex` | NLTK | Advanced regular expression support |
| `tqdm` | NLTK | Progress bar display |

---

## Installation

To install all required libraries, activate the virtual environment and run:

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate

# Install all dependencies
pip install -r requirements.txt

# Download required NLTK data
python -c "import nltk; nltk.download('punkt'); nltk.download('wordnet')"
```

---

## Summary Table

| # | Library | Version (approx.) | Category | Role in Project |
|---|---|---|---|---|
| 1 | Flask | 3.x | Web Framework | Web application & REST API server |
| 2 | scikit-learn | 1.x | Machine Learning | Emotion classification models & text vectorization |
| 3 | Pandas | 2.x | Data Analysis | Dataset loading, cleaning & manipulation |
| 4 | NumPy | 2.x | Numerical Computing | Array operations for ML computations |
| 5 | NLTK | 3.x | NLP | Text preprocessing & lemmatization |
