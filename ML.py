# ML.py
from flask import Flask, request, jsonify
import pandas as pd
import os

app = Flask(__name__)

# --- Load allergy dataset ---
DATA_PATH = os.path.join('data', 'allergy_data_cleaned.xlsx')

try:
    df = pd.read_excel(DATA_PATH)
    print(f"✅ Loaded allergy dataset with {len(df)} rows and {len(df.columns)} columns.")
except Exception as e:
    print(f"❌ Error loading dataset: {e}")
    df = pd.DataFrame()

@app.route('/')
def home():
    return jsonify({"message": "Allergy ML API is running!"})

# --- Predict or search endpoint ---
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    query = data.get('text', '').lower().strip()
    if not query:
        return jsonify({"error": "No input provided"}), 400

    # Example logic: find matches in any column that contains the query
    if df.empty:
        return jsonify({"error": "Dataset not loaded"}), 500

    matches = df[df.apply(lambda row: row.astype(str).str.lower().str.contains(query).any(), axis=1)]

    if matches.empty:
        return jsonify({"result": "No matches found"})
   
    # Return first 5 results
    results = matches.head(5).to_dict(orient='records')
    return jsonify({"matches": results})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
