import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAccountBalance } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Account() {
  const { accounts, selectedAccount, setSelectedAccount, handleLogout } = useAuth();
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const navigate = useNavigate();

  const getAccountId = (acc) => acc?.loginid || acc?.id || acc?.account_id || '';
  const getIsVirtual = (acc) => acc?.is_virtual ?? getAccountId(acc).startsWith('VRTC');

  useEffect(() => {
    const accId = getAccountId(selectedAccount);
    if (!accId) return;

    setLoadingBalance(true);
    getAccountBalance(accId)
      .then((res) => {
        const balData = res.balance || {};
        setBalance(balData.balance ?? balData);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingBalance(false));
  }, [selectedAccount]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Account Overview</h2>
        <div>
          <button onClick={() => navigate('/trade')} style={styles.navBtn}>Trading Terminal</button>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div style={styles.group}>
          <label><strong>Select Account: </strong></label>
          <select
            value={getAccountId(selectedAccount)}
            onChange={(e) => setSelectedAccount(accounts.find((a) => getAccountId(a) === e.target.value))}
            style={styles.select}
          >
            {accounts.map((acc) => {
              const id = getAccountId(acc);
              return (
                <option key={id} value={id}>
                  {id} — {getIsVirtual(acc) ? 'Demo' : 'Real'} ({acc.currency || 'USD'})
                </option>
              );
            })}
          </select>
        </div>
      )}

      {selectedAccount && (
        <div style={styles.card}>
          <h3>{getIsVirtual(selectedAccount) ? 'Demo Account' : 'Real Account'}</h3>
          <p><strong>Account ID:</strong> <code>{getAccountId(selectedAccount)}</code></p>
          <div style={styles.balanceBox}>
            <span>Server Authenticated Balance:</span>
            <h1>
              {loadingBalance ? 'Fetching via Backend OTP...' : `$${Number(balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </h1>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '30px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  card: { padding: '20px', border: '1px solid #e1e4e8', borderRadius: '8px', backgroundColor: '#fff' },
  balanceBox: { marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' },
  select: { padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' },
  navBtn: { padding: '8px 14px', marginRight: '10px', backgroundColor: '#24292e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  logoutBtn: { padding: '8px 14px', backgroundColor: '#cf222e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  group: { marginBottom: '20px' }
};