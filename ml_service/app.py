from flask import Flask, jsonify, request
from pathlib import Path
import joblib
import numpy as np

from utils import compute_features, explain_prediction

app = Flask(__name__)

MODEL_PATH = Path(__file__).parent / 'model' / 'model.pkl'
MODEL_STORE = None


def load_model():
    global MODEL_STORE
    if MODEL_STORE is None:
        if MODEL_PATH.exists():
            MODEL_STORE = joblib.load(MODEL_PATH)
        else:
            raise RuntimeError('Model not found. Run train.py first.')
    return MODEL_STORE


@app.route('/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/score', methods=['POST'])
def score():
    payload = request.get_json(force=True)
    user_id = payload.get('user_id')
    transaction = payload.get('transaction', {})
    history = payload.get('history', [])

    model_bundle = load_model()
    model = model_bundle['model']
    anomaly = model_bundle['anomaly']

    features = compute_features(transaction, history)
    proba = model.predict_proba([features])[0][1]
    score = int(np.clip(proba * 100, 0, 100))

    anomaly_score = anomaly.decision_function([features])[0]
    if anomaly_score < -0.2:
        score = min(100, score + int(abs(anomaly_score) * 50))

    top_features, flags = explain_prediction(model, features)

    action = 'allow'
    if score >= 85:
        action = 'flag'
    elif score >= 60:
        action = 'challenge'

    return jsonify(
        {
            'user_id': user_id,
            'score': score,
            'explanation': {
                'top_features': top_features,
                'flags': flags,
            },
            'recommended_action': action,
        }
    )


if __name__ == '__main__':
    load_model()
    app.run(host='0.0.0.0', port=5000)
