import json
import os
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pytest

from app import app, load_model, MODEL_PATH


@pytest.fixture(scope='session', autouse=True)
def setup_model(tmp_path_factory):
    # ensure a model exists for tests; if not available, create simple dummy bundle
    if not MODEL_PATH.exists():
        dummy_path = MODEL_PATH
        dummy_path.parent.mkdir(exist_ok=True)
        import joblib
        from sklearn.dummy import DummyClassifier
        from sklearn.ensemble import IsolationForest
        import numpy as np

        clf = DummyClassifier(strategy='uniform')
        clf.fit([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], [0])
        anomaly = IsolationForest().fit(np.zeros((10, 10)))
        joblib.dump({'model': clf, 'anomaly': anomaly}, dummy_path)
    load_model()


def test_health():
    client = app.test_client()
    res = client.get('/health')
    assert res.status_code == 200
    assert res.json['status'] == 'ok'


def test_score_endpoint():
    client = app.test_client()
    payload = {
        'user_id': 'user-1',
        'transaction': {'amount': 120, 'date': '2024-01-01', 'merchant_name': 'Test Shop', 'category': ['Shops']},
        'history': [
            {'amount': 20, 'date': '2023-12-30', 'merchant_name': 'Test Shop', 'category': ['Shops']},
            {'amount': 25, 'date': '2023-12-25', 'merchant_name': 'Coffee Hut', 'category': ['Restaurants']},
        ],
    }
    res = client.post('/score', data=json.dumps(payload), content_type='application/json')
    assert res.status_code == 200
    body = res.get_json()
    assert 'score' in body
    assert 'explanation' in body
