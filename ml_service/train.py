import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib

from utils import compute_features

np.random.seed(42)

MODEL_DIR = Path(__file__).parent / 'model'
MODEL_DIR.mkdir(exist_ok=True)


def generate_synthetic_data(n_users=200, tx_per_user=50):
    rows = []
    labels = []
    for user_idx in range(n_users):
        user_id = f'user-{user_idx}'
        history = []
        base_spend = np.random.uniform(20, 80)
        for tx_idx in range(tx_per_user):
            amount = np.random.normal(base_spend, 15)
            amount = max(1, amount)
            merchant = np.random.choice(['Coffee Hut', 'Grocery Co', 'Online Books', 'RideShare', 'Gym Membership'])
            category = ['Restaurants'] if 'Coffee' in merchant else ['Shops']
            date = pd.Timestamp('2023-01-01') + pd.Timedelta(days=tx_idx)
            tx = {
                'transaction_id': f'{user_id}-{tx_idx}',
                'amount': round(float(amount), 2),
                'merchant_name': merchant,
                'category': category,
                'payment_channel': 'in_store',
                'date': date,
            }
            features = compute_features(tx, history)
            rows.append(features)
            labels.append(0)
            history.append(tx)
        # inject fraud events
        for fraud_idx in range(max(1, tx_per_user // 10)):
            amount = np.random.uniform(200, 600)
            merchant = np.random.choice(['Crypto Exchange', 'Luxury Electronics', 'TravelNow'])
            category = ['Travel'] if 'Travel' in merchant else ['Shops']
            date = pd.Timestamp('2023-03-01') + pd.Timedelta(days=fraud_idx)
            tx = {
                'transaction_id': f'{user_id}-fraud-{fraud_idx}',
                'amount': round(float(amount), 2),
                'merchant_name': merchant,
                'category': category,
                'payment_channel': np.random.choice(['online', 'in_store']),
                'date': date,
            }
            features = compute_features(tx, history)
            rows.append(features)
            labels.append(1)
            history.append(tx)
    data = np.vstack(rows)
    labels = np.array(labels)
    return data, labels


def train():
    X, y = generate_synthetic_data()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y)
    clf = GradientBoostingClassifier()
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    report = classification_report(y_test, y_pred, output_dict=True)

    anomaly = IsolationForest(contamination=0.05)
    anomaly.fit(X_train)

    joblib.dump({'model': clf, 'anomaly': anomaly}, MODEL_DIR / 'model.pkl')
    with open(MODEL_DIR / 'metrics.json', 'w') as f:
        json.dump(report, f, indent=2)

    print('Model trained and saved to', MODEL_DIR / 'model.pkl')


if __name__ == '__main__':
    train()
