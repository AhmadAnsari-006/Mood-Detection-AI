import os
import pickle

def get_project_root():
    # Path to directory containing src, data, models, etc.
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def get_data_path(filename="final_cleaned_data.csv.xls"):
    return os.path.join(get_project_root(), "data", "processed", filename)

def get_model_path(filename="model.pkl"):
    models_dir = os.path.join(get_project_root(), "models")
    os.makedirs(models_dir, exist_ok=True)
    return os.path.join(models_dir, filename)

def save_pickle(obj, filepath):
    with open(filepath, "wb") as f:
        pickle.dump(obj, f)

def load_pickle(filepath):
    with open(filepath, "rb") as f:
        return pickle.load(f)
