import React from 'react';

export default function TransactionList({ transactions, onDecision }) {
  if (!transactions?.length) {
    return <p>No transactions yet.</p>;
  }
  return (
    <div className="transactions">
      {transactions.map((tx) => (
        <div key={tx.id || tx.tx_id} className={`transaction ${tx.is_flagged ? 'flagged' : ''}`}>
          <div>
            <strong>{tx.merchant_name || tx.raw?.merchant}</strong>
            <div className="meta">{tx.date}</div>
          </div>
          <div className="amount">${Number(tx.amount).toFixed(2)}</div>
          <div className="risk">Risk: {tx.risk_score ?? 'N/A'}</div>
          {tx.is_flagged && !tx.decision && (
            <div className="actions">
              <button onClick={() => onDecision(tx, 'approve')}>Approve</button>
              <button className="danger" onClick={() => onDecision(tx, 'decline')}>
                Report Fraud
              </button>
            </div>
          )}
          {tx.decision && <div className="decision">Decision: {tx.decision}</div>}
        </div>
      ))}
    </div>
  );
}
