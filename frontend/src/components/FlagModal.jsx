import React from 'react';

export default function FlagModal({ transaction, onClose, onDecision }) {
  if (!transaction) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Transaction flagged</h2>
        <p>
          We noticed suspicious activity on <strong>{transaction.merchant_name}</strong> for $
          {Number(transaction.amount).toFixed(2)}.
        </p>
        <p>Risk score: {transaction.risk_score}</p>
        {transaction.explanation?.flags?.length > 0 && (
          <ul>
            {transaction.explanation.flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button onClick={() => onDecision('approve')}>Approve</button>
          <button className="danger" onClick={() => onDecision('decline')}>
            Report as Fraud
          </button>
          <button className="link" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
