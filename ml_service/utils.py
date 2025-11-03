import numpy as np
import pandas as pd
from datetime import datetime

FEATURE_COLUMNS = [
    'amount',
    'amount_vs_avg_ratio',
    'days_since_last_tx',
    'merchant_frequency',
    'category_risk',
    'velocity_1h',
    'velocity_24h',
    'velocity_7d',
    'is_card_not_present',
    'is_new_merchant',
]

CATEGORY_RISK = {
    'Travel': 0.6,
    'Restaurants': 0.2,
    'Shops': 0.4,
    'Entertainment': 0.5,
}


def parse_date(date_str):
    if isinstance(date_str, (datetime, pd.Timestamp)):
        return pd.Timestamp(date_str)
    return pd.to_datetime(date_str)


def compute_features(transaction, history):
    history_df = pd.DataFrame(history) if history else pd.DataFrame(columns=transaction.keys())
    now = parse_date(transaction.get('date', datetime.utcnow()))
    history_df['date'] = pd.to_datetime(history_df.get('date', now))
    history_df = history_df.sort_values('date')

    amount = float(transaction.get('amount', 0))
    merchant = transaction.get('merchant_name') or transaction.get('name')
    category = transaction.get('category', [])
    category_main = category[0] if category else 'Other'

    avg_amount = history_df['amount'].astype(float).mean() if not history_df.empty else 50
    last_tx_date = history_df['date'].iloc[-1] if not history_df.empty else None
    days_since_last = (now - last_tx_date).days if last_tx_date is not None else 30

    merchant_counts = history_df['merchant_name'].value_counts() if 'merchant_name' in history_df else pd.Series(dtype=float)
    merchant_freq = merchant_counts.get(merchant, 0) / max(len(history_df), 1)

    def count_in_period(hours):
        if history_df.empty:
            return 0
        cutoff = now - pd.Timedelta(hours=hours)
        return history_df[history_df['date'] >= cutoff].shape[0]

    velocity_1h = count_in_period(1)
    velocity_24h = count_in_period(24)
    velocity_7d = count_in_period(24 * 7)

    amount_vs_avg_ratio = amount / (avg_amount + 1e-6)
    category_risk = CATEGORY_RISK.get(category_main, 0.3)
    is_cnp = 1 if (transaction.get('payment_channel') == 'online') else 0
    is_new_merchant = 1 if merchant_counts.get(merchant, 0) == 0 else 0

    features = np.array([
        amount,
        amount_vs_avg_ratio,
        days_since_last,
        merchant_freq,
        category_risk,
        velocity_1h,
        velocity_24h,
        velocity_7d,
        is_cnp,
        is_new_merchant,
    ], dtype=float)

    return features


def explain_prediction(model, features):
    importances = getattr(model, 'feature_importances_', None)
    if importances is None:
        importances = np.ones(len(features)) / len(features)
    ranked = sorted(
        [
            {
                'feature': FEATURE_COLUMNS[i],
                'weight': float(importances[i]),
                'value': float(features[i]),
            }
            for i in range(len(features))
        ],
        key=lambda x: x['weight'],
        reverse=True,
    )[:3]
    flags = []
    if features[1] > 3:
        flags.append('high_amount_vs_avg')
    if features[4] > 0.5:
        flags.append('risky_category')
    if features[9] == 1:
        flags.append('new_merchant')
    return ranked, flags
