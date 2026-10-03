import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTrading } from "../context/TradingContext";
import "./HomePage.css";

export default function HomePage() {
  const {
    patToken,
    setPatToken,
    handleConnect,
    isConnected,
    accountType,
    switchAccount,
    error,
    status,
  } = useTrading();

  const [inputToken, setInputToken] = useState(patToken);

  // Initialize state directly from the DOM attribute set by App.jsx or localStorage fallback
  const [theme, setTheme] = useState(
    () =>
      document.documentElement.getAttribute("data-theme") ||
      localStorage.getItem("app_theme") ||
      "dark"
  );

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("app_theme", nextTheme);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    setPatToken(inputToken);
    handleConnect(inputToken, accountType);
  };

  return (
    <div className="home-container">
      {/* Top Banner / Hero Header Section */}
      <section className="hero-card">
        <div className="hero-header-bar">
          <div className="brand-badge">
            <span className="logo-text">
              Autom<span className="logo-accent">8</span> DERIV Trading Suite
            </span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="toggle-btn theme-toggle-btn"
          >
            {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>

        <h1>Automated Options & Trading Bot Suite</h1>
        
        <div className="hero-subtitle-container">
          <p className="hero-subtitle">
            Connect your Deriv account securely using a <strong>Personal Access Token (PAT)</strong> to let our smart trading bots work for you automatically.
          </p>
          <p className="hero-description">
            Our bot algorithms are engineered by an elite team of quantitative financial analysts and software engineers to monitor the markets 24/7, spot clean trading opportunities, and execute trades instantly. Set your own profit goals and stop loss rules, and let the bot handle the rest with complete discipline.
          </p>
        </div>
      </section>

      {!isConnected ? (
        /* DISCONNECTED STATE: Simple Onboarding & PAT Login */
        <div className="grid-layout">
          {/* Authentication Section */}
          <section className="auth-card">
            <h2>Connect Your Deriv Account</h2>
            <p className="hint">
              Enter your Personal Access Token below to connect your account and start trading.
            </p>

            <form onSubmit={onSubmit} className="auth-form">
              <div className="account-type-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${accountType === "demo" ? "active" : ""}`}
                  onClick={() => switchAccount("demo")}
                >
                  🟢 Demo Account
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${accountType === "real" ? "active" : ""}`}
                  onClick={() => switchAccount("real")}
                >
                  🔴 Real Account
                </button>
              </div>

              <div className="input-group">
                <input
                  type="password"
                  placeholder="Paste your Deriv PAT Token here"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  className="token-input"
                  required
                />
                <button type="submit" className="connect-btn">
                  Connect {accountType === "demo" ? "Demo" : "Real"} Account
                </button>
              </div>
            </form>

            {error && <div className="error-banner">{error}</div>}
            {status && <div className="status-banner">{status}</div>}

            {/* Guide for obtaining PAT */}
            <div className="pat-guide">
              <h3>📋 How to Get Your API Token</h3>
              <ol className="icon-list">
                <li>
                  <span className="step-icon">1️⃣</span>
                  <span>Log in to your official <strong>Deriv Account</strong>.</span>
                </li>
                <li>
                  <span className="step-icon">2️⃣</span>
                  <span>Go to <strong>Account Settings &gt; API Token</strong>.</span>
                </li>
                <li>
                  <span className="step-icon">3️⃣</span>
                  <span>Check both the <code>Read</code> and <code>Trade</code> permission boxes.</span>
                </li>
                <li>
                  <span className="step-icon">4️⃣</span>
                  <span>Generate your token, copy it, and paste it into the field above.</span>
                </li>
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

          {/* Account Registration Onboarding Section */}
          <section className="dashboard-card">
            <div className="register-prompt">
              <h2>Don't Have a Deriv Account?</h2>
              <p className="register-text">
                To start trading with automated bots, you need a Deriv account. Creating one takes only a few minutes and gives you instant access to both Demo practice accounts and Real trading.
              </p>
              <a
                href="https://t.deriv.link?t=K63QJVM59A52"
                target="_blank"
                rel="noopener noreferrer"
                className="connect-btn register-btn"
              >
                Create a Free Deriv Account &rarr;
              </a>
            </div>
          </section>
        </div>
      ) : (
        /* CONNECTED STATE: Icon-Rich Trading Platform Hub */
        <div className="connected-dashboard-wrapper">
          {/* Section 1: Trading Bot Overview */}
          <section className="connected-card bot-overview-card">
            <div className="section-badge">🤖 Automated Bot Platform</div>
            <h2>Trading Bots for Deriv Traders</h2>
            <p className="section-lead">
              Pick your strategy, choose your market, and set your risk rules — our trading bots place every trade for you and stop automatically the second your profit or stop-loss limits are hit.
            </p>
            <div className="action-row">
              <Link to="/bots" className="primary-cta-btn">
                Launch Trading Bots &rarr;
              </Link>
            </div>
          </section>

          {/* Section 2: How It Works & Illustrated Steps */}
          <section className="connected-card how-it-works-card">
            <h2>Get Started in 4 Easy Steps</h2>
            <p className="section-subtitle">How It Works</p>
            <p className="hint">
              Follow these simple steps to go from setup to automatic trading in minutes — zero coding needed!
            </p>

            <div className="steps-container">
              <div className="step-card">
                <div className="step-header">
                  <span className="step-number">1</span>
                  <div className="step-title-group">
                    <span className="step-icon-badge">🤖</span>
                    <h3>Pick Your Strategy</h3>
                  </div>
                </div>
                <p>
                  Explore our selection of trading bots on the <Link to="/bots">Bots Page</Link> and select the one that fits your trading style best.
                </p>
              </div>

              <div className="step-card">
                <div className="step-header">
                  <span className="step-number">2</span>
                  <div className="step-title-group">
                    <span className="step-icon-badge">⚙️</span>
                    <h3>Set Your Rules & Risk</h3>
                  </div>
                </div>
                <p>
                  Set your preferred trade stake, target profit per session, and maximum stop-loss amount to protect your capital.
                </p>
              </div>

              <div className="step-card">
                <div className="step-header">
                  <span className="step-number">3</span>
                  <div className="step-title-group">
                    <span className="step-icon-badge">▶️</span>
                    <h3>Start the Bot</h3>
                  </div>
                </div>
                <p>
                  Click start to launch the bot! It will immediately begin scanning the market and placing trades automatically.
                </p>
              </div>

              <div className="step-card">
                <div className="step-header">
                  <span className="step-number">4</span>
                  <div className="step-title-group">
                    <span className="step-icon-badge">📊</span>
                    <h3>Track & Relax</h3>
                  </div>
                </div>
                <p>
                  Watch real-time performance on the <Link to="/history">Trade History Page</Link>. Pause or stop the bot manually anytime, or let your preset stop rules handle it automatically.
                </p>
              </div>
            </div>

            {/* Social Media & Tutorial Community Links */}
            <div className="social-tutorials-box">
              <h3>🎥 Watch Video Tutorials & Setup Guides</h3>
              <p>Join our friendly trading community for quick video demos, bot setup guides, and tips:</p>
              <div className="social-links-grid">
                <a
                  href="https://www.tiktok.com/@olinoh?lang=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <img src="/tiktok.png" alt="TikTok" className="social-icon" />
                </a>
                <a
                  href="https://www.tiktok.com/@olinoh?lang=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <img src="/youtube.png" alt="YouTube" className="social-icon" />
                </a>
                <a
                  href="https://www.tiktok.com/@olinoh?lang=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <img src="/insta.jfif" alt="Instagram" className="social-icon" />
                </a>
                <a
                  href="https://www.tiktok.com/@olinoh?lang=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <img src="/x.png" alt="X (Twitter)" className="social-icon" />
                </a>
                <a
                  href="https://www.tiktok.com/@olinoh?lang=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <img src="/telegram.png" alt="Telegram" className="social-icon" />
                </a>
              </div>
            </div>

            <div className="section-caption-box">
              <p className="quote-caption">"Set your bot before breakfast. Check your results after dinner."</p>
            </div>
          </section>

          {/* Section 3: Markets & Customizable Controls with Icons */}
          <section className="connected-card markets-card">
            <h2>Markets & Customizable Features</h2>
            <p className="section-lead">
              Trade popular <strong>Deriv Synthetic Indexes</strong> with total control over your setup:
            </p>

            <div className="controls-badge-grid">
              <div className="control-badge-item">
                <img src="/chart.png" alt="Volatility Chart" className="badge-icon-img" />
                <div className="badge-content">
                  <strong>Volatility Indexes</strong>
                  <span>Trade Volatility 10 Index up to the Volatility 100 Index.</span>
                </div>
              </div>

              <div className="control-badge-item">
                <img src="/stake.png" alt="Volatility Chart" className="badge-icon-img" />
                <div className="badge-content">
                  <strong>Low Entry Stakes</strong>
                  <span>Start trading with low stakes starting as low as $1 per trade.</span>
                </div>
              </div>

              <div className="control-badge-item">
                <span className="badge-icon">🛡️</span>
                <div className="badge-content">
                  <strong>Smart Risk Control</strong>
                  <span>Automatic stop-loss and profit target limits keep your balance safe.</span>
                </div>
              </div>

              <div className="control-badge-item">
                <div className="badge-content">
                  <strong>Risk-Free Demo Sandbox</strong>
                  <span>Practice and test bot strategies on Demo before using Real money.</span>
                </div>
              </div>
            </div>

            <div className="section-caption-box highlight-box">
              <p className="quote-caption">
                "Your bot rules keep working even when you step away. Stop-loss, take-profit, and profit caps end the session on their own — so you stay in control."
              </p>
            </div>

            <div className="action-row center-actions">
              <Link to="/bots" className="primary-cta-btn">
                Check Out Our Bots &rarr;
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}