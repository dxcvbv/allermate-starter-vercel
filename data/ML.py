# ML.py
from flask import Flask, request, jsonify
import pandas as pd
import os

app = Flask(__name__)

# --- Load the dataset ---
DATA_PATH = os.path.join('data', 'allergy_data_cleaned.xlsx')

try:
    df = pd.read_excel(DATA_PATH)
    print(f"Loaded dataset with {len(df)} rows.")
except Exception as e:
    print(f"Error loading dataset: {e}")
    df = pd.DataFrame()

@app.route('/')
def home():
    return jsonify({"message": "Allergy ML service is running!"})

# --- Prediction / lookup endpoint ---
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    query = data.get('text', '').lower()
    if not query:
        return jsonify({"error": "No text provided"}), 400

    # Basic example: look for rows where the “symptom” or “ingredient” columns contain the query
    matched_rows = df[df.apply(lambda row: row.astype(str).str.lower().str.contains(query).any(), axis=1)]

    if matched_rows.empty:
        return jsonify({"result": "No match found."})

    # Return top 5 matches as JSON
    results = matched_rows.head(5).to_dict(orient='records')
    return jsonify({"matches": results})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
