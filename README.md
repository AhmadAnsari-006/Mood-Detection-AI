# AI Mood Detection from Text

## Project Overview

**AI Mood Detection from Text** is a Machine Learning based web application that analyzes user-written text and predicts the emotional mood behind it. The system uses Natural Language Processing (NLP) techniques and a trained Machine Learning model to classify text into emotions such as **Happy, Sad, Angry, Fear, or Neutral**.

This project demonstrates the practical implementation of **Machine Learning, NLP, and Web Development** using Python and Flask. It is designed as a **micro-project for academic purposes** but can be expanded into a large-scale AI system for applications like mental health monitoring, customer sentiment analysis, and social media analytics.

---

## Objectives

* Build a Machine Learning model that can detect emotions from text.
* Implement Natural Language Processing techniques for text preprocessing.
* Create a simple and interactive web interface for users to input text.
* Integrate the ML model with a Flask backend to return predictions.
* Demonstrate a complete **ML pipeline from dataset to prediction**.

---

## Features

* User-friendly web interface
* Real-time mood detection
* AI-based text analysis
* Machine Learning emotion classification
* Interactive result display (popup or message box)
* Modular project structure for easy scalability

---

## Technology Stack

### Programming Language

* Python

### Machine Learning & NLP

* Scikit-learn
* Pandas
* NumPy
* NLTK / Text preprocessing techniques

### Web Development

* HTML
* CSS
* JavaScript
* Flask (Python web framework)

### Dataset

Emotion dataset containing labeled text with emotions such as:

* Happy
* Sad
* Angry
* Fear
* Neutral

---

## How the System Works

1. The user enters a text message in the web interface.
2. The text is sent to the Flask backend.
3. The backend preprocesses the text:

   * Convert to lowercase
   * Remove punctuation
   * Remove stopwords
   * Tokenization
4. The cleaned text is converted into numerical features using **TF-IDF vectorization**.
5. The trained Machine Learning model predicts the emotion.
6. The predicted emotion is returned to the frontend and displayed to the user.

---

## Installation and Setup

### Step 1: Clone the Repository

```
git clone https://github.com/yourusername/mood-detection-ai.git
cd mood-detection-ai
```

### Step 2: Install Required Libraries

```
pip install -r requirements.txt
```

### Step 3: Train the Model

Run the training script to generate the trained model.

```
python train_model.py
```

This will create:

* `model.pkl`
* `vectorizer.pkl`

---

### Step 4: Run the Application

Start the Flask server:

```
python app.py
```

---

### Step 5: Open in Browser

```
http://127.0.0.1:5000
```

Enter any sentence and the system will detect the mood.

---

## Example Input and Output

**Input Text**

```
I am feeling very happy today!
```

**Predicted Mood**

```
Happy 😊
```

---

## Applications

* Mental health monitoring systems
* Social media sentiment analysis
* Customer feedback analysis
* AI chatbots emotion detection
* Human-computer interaction systems

---

## Future Improvements

* Use **Deep Learning models (LSTM / BERT)** for higher accuracy
* Detect emotions from **voice and facial expressions**
* Build a **mobile application**
* Add **multi-language emotion detection**
* Deploy the project on **cloud platforms**

---

## Learning Outcomes

Through this project, students learn:

* Natural Language Processing basics
* Text preprocessing techniques
* Machine Learning classification models
* Flask backend integration
* Full ML pipeline development
* Building AI-powered web applications

---

## Contributors

Project developed by:

* Ahmad Shoaib
* Team Members (if applicable)

---

## License

This project is developed for **educational purposes** and can be modified or extended for learning and research.
