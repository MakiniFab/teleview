import React, { useState } from "react";
import { useTrading } from "../context/TradingContext";
import "./HomePage.css";

export default function HomePage() {
  const { patToken, setPatToken, handleConnect, isConnected, accountType, switchAccount, accountData, error, status } = useTrading();
  const [inputToken, setInputToken] = useState(patToken);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    setPatToken(inputToken);
    handleConnect(inputToken, accountType);
  };

  return (
    <div className="home-container">
      {/* Brand & Hero Banner */}
      <section className="hero-card">
        <div className="brand-badge">
          <span className="logo-text">Autom<span className="logo-accent">8</span> DERIV Trading Website.</span>
        </div>
        <h1>Automated Options and Analysis Suite</h1>
        <p className="hero-subtitle">
          Connect your Deriv account securely using a Personal Access Token (PAT) to unlock automated staking strategies.
        </p>
      </section>

      <div className="grid-layout">
        {/* Authentication Section */}
        <section className="auth-card">
          <h2>Deriv PAT Authentication</h2>
          <p className="hint">Enter your Personal Access Token below to establish a direct session.</p>

          {!isConnected ? (
            <form onSubmit={onSubmit} className="auth-form">
              <div className="account-type-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${accountType === "demo" ? "active" : ""}`}
                  onClick={() => switchAccount("demo")}
                >
                  Demo Account
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${accountType === "real" ? "active" : ""}`}
                  onClick={() => switchAccount("real")}
                >
                  Real Account
                </button>
              </div>

              <div className="input-group">
                <input
                  type="password"
                  placeholder="Paste your Deriv PAT Token"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  className="token-input"
                  required
                />
                <button type="submit" className="connect-btn">
                  Connect {accountType === "demo" ? "Demo" : "Real"}
                </button>
              </div>
            </form>
          ) : (
            <div className="connected-panel">
              <div className="status-indicator online">
                <span className="dot"></span> Connected Successfully ({accountType.toUpperCase()})
              </div>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}
          {status && <div className="status-banner">{status}</div>}

          {/* Guide for obtaining PAT */}
          <div className="pat-guide">
            <h3>How to get your PAT Token</h3>
            <ol>
              <li>Log in to your <strong>Deriv Account</strong>.</li>
              <li>Go to <strong>Account Settings &gt; API Token</strong>.</li>
              <li>Select scopes: <code>Read</code> and <code>Trade</code>.</li>
              <li>Generate the token, copy it, and paste it in the form above.</li>
            </ol>
            <a 
              href="https://developers.deriv.com/dashboard/tokens/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="deriv-link"
            >
              Get Token on Deriv &rarr;
            </a>
          </div>
        </section>

        {/* Account Details Section */}
        <section className="dashboard-card">
          <h2>Account Summary</h2>
          {isConnected && accountData ? (
            <div className="account-details">
              <div className="metric-box">
                <span className="label">Account Type</span>
                <span className="value">{accountType.toUpperCase()}</span>
              </div>
              <div className="metric-box">
                <span className="label">Account ID</span>
                <span className="value">{accountData.account || "N/A"}</span>
              </div>
              <div className="metric-box">
                <span className="label">Available Balance</span>
                <span className="value highlighted">
                  ${accountData.balance ? accountData.balance.toFixed(2) : "0.00"} <small>{accountData.currency || "USD"}</small>
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🔒</div>
              <p>Connect your Deriv PAT above to view live balance and account specifications.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}