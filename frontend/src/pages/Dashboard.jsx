import React, { useEffect, useState } from 'react';
import PlaidLinkButton from '../components/PlaidLinkButton.jsx';
import TransactionList from '../components/TransactionList.jsx';
import FlagModal from '../components/FlagModal.jsx';
import { apiClient } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(null);
  const { user, logout } = useAuth();

  const loadTransactions = () => {
    apiClient.get('/transactions').then((res) => {
      setTransactions(res.data.transactions);
      const flagged = res.data.transactions.find((tx) => tx.is_flagged && !tx.decision);
      if (flagged) {
        setSelected(flagged);
      }
    });
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleDecision = async (tx, decision) => {
    await apiClient.post(`/transactions/${tx.id}/decision`, { decision });
    setSelected(null);
    loadTransactions();
  };

  const handleModalDecision = async (decision) => {
    if (!selected) return;
    await handleDecision(selected, decision);
  };

  return (
    <div className="dashboard">
      <header>
        <div>
          <h1>Welcome, {user?.name || user?.email}</h1>
          <p>Monitor accounts, review risk scores, and take action on suspicious transactions.</p>
        </div>
        <div>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <section className="actions">
        <PlaidLinkButton onSuccess={loadTransactions} />
        <button onClick={loadTransactions}>Refresh</button>
      </section>

      <section>
        <h2>Recent transactions</h2>
        <TransactionList transactions={transactions} onDecision={handleDecision} />
      </section>

      <FlagModal transaction={selected} onClose={() => setSelected(null)} onDecision={handleModalDecision} />
    </div>
  );
}
