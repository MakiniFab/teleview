import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePublicMarket } from '../hooks/usePublicMarket';
import { executeBuyOrder } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Trade() {
  const { selectedAccount } = useAuth();
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState('R_100');
  const [amount, setAmount] = useState(10);
  const [tradeMessage, setTradeMessage] = useState(null);

  const { isConnected, ticks } = usePublicMarket(symbol);
  const currentPrice = ticks.length > 0 ? ticks[ticks.length - 1].quote : 'Loading...';

  const handleTrade = async (contractType) => {
    const accountId = selectedAccount?.loginid || selectedAccount?.id;
    if (!accountId) {
      setTradeMessage('No active account selected.');
      return;
    }

    try {
      setTradeMessage('Sending trade request to server...');
      const result = await executeBuyOrder(accountId, amount, {
        amount,
        basis: 'stake',
        contract_type: contractType,
        currency: selectedAccount.currency || 'USD',
        duration: 5,
        duration_unit: 't',
        symbol: symbol
      });

      if (result.buy_result?.error) {
        setTradeMessage(`Error: ${result.buy_result.error.message}`);
      } else {
        setTradeMessage(`Success! Contract ID: ${result.buy_result?.buy?.contract_id || 'Executed'}`);
      }
    } catch (err) {
      setTradeMessage(`Trade execution failed: ${err.message}`);
    }
  };

  return (
    <div style={styles.container}>
      <button onClick={() => navigate('/account')} style={styles.backBtn}>← Back to Account</button>
      <h2>Options Trading Terminal</h2>

      <div style={styles.marketBar}>
        <span>Public Market Feed: <strong>{isConnected ? 'Connected' : 'Connecting...'}</strong></span>
        <h3>Symbol: {symbol} | Price: {currentPrice}</h3>
      </div>

      <div style={styles.controls}>
        <label><strong>Stake Amount ($):</strong></label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          style={styles.input}
        />

        <div style={styles.btnGroup}>
          <button onClick={() => handleTrade('CALL')} style={styles.riseBtn}>Higher / Rise</button>
          <button onClick={() => handleTrade('PUT')} style={styles.fallBtn}>Lower / Fall</button>
        </div>
      </div>

      {tradeMessage && (
        <div style={styles.messageBox}>
          <p>{tradeMessage}</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '30px', maxWidth: '700px', margin: '0 auto', fontFamily: 'sans-serif' },
  backBtn: { padding: '6px 12px', marginBottom: '20px', cursor: 'pointer' },
  marketBar: { padding: '15px', backgroundColor: '#f6f8fa', borderRadius: '6px', marginBottom: '20px' },
  controls: { padding: '20px', border: '1px solid #e1e4e8', borderRadius: '6px' },
  input: { padding: '8px', fontSize: '16px', display: 'block', margin: '10px 0 20px 0', width: '100%', boxSizing: 'border-box' },
  btnGroup: { display: 'flex', gap: '15px' },
  riseBtn: { flex: 1, padding: '12px', backgroundColor: '#2da44e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' },
  fallBtn: { flex: 1, padding: '12px', backgroundColor: '#cf222e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' },
  messageBox: { marginTop: '20px', padding: '12px', backgroundColor: '#f1f8ff', borderRadius: '4px' }
};