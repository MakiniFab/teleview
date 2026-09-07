const API_BASE = '/api';

export async function fetchSession() {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
  return res.json();
}

export async function logoutUser() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}

export async function getUserAccounts() {
  const res = await fetch(`${API_BASE}/trading/accounts`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch user accounts');
  return res.json();
}

export async function getAccountBalance(accountId) {
  const res = await fetch(`${API_BASE}/trading/balance?accountId=${accountId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch account balance');
  return res.json();
}

export async function executeBuyOrder(accountId, price, parameters = {}) {
  const res = await fetch(`${API_BASE}/trading/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accountId, price, parameters }),
  });
  if (!res.ok) throw new Error('Buy trade execution failed');
  return res.json();
}

export async function getPortfolio(accountId) {
  const res = await fetch(`${API_BASE}/trading/portfolio?accountId=${accountId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch portfolio');
  return res.json();
}

export async function getStatement(accountId) {
  const res = await fetch(`${API_BASE}/trading/statement?accountId=${accountId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch statement');
  return res.json();
}