import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { TradingProvider, useTrading } from "./context/TradingContext";

import HomePage from "./pages/HomePage";
import BotsPage from "./pages/BotsPage";
import HistoryPage from "./pages/HistoryPage";
import ContactPage from "./pages/ContactPage";
import Footer from "./pages/Footer";
import MarketAnalysis from "./pages/MarketAnalysis";

import "./App.css";

// Floating TikTok Button (Top Left)
function FloatingTikTokButton() {
  return (
    <a
      href="https://www.tiktok.com/@olinoh?lang=en"
      target="_blank"
      rel="noopener noreferrer"
      className="floating-tiktok-btn"
      aria-label="Learn how to use the site on TikTok"
      title="Watch Tutorials & Info on TikTok"
    >
      <svg
        className="tiktok-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        width="20"
        height="20"
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.06-2.77V9.32a6.34 6.34 0 1 0 5.51 6.22V8.92a8.28 8.28 0 0 0 4.77 1.47V6.94a4.8 4.8 0 0 1-1.00-.25z" />
      </svg>
      <span className="tiktok-btn-text">How to Use</span>
    </a>
  );
}

function FloatingChatWidget() {
  const navigate = useNavigate();

  return (
    <button
      className="floating-chat-btn"
      onClick={() => navigate("/contact")}
      aria-label="Chat with Support"
      title="Chat with Us"
    >
      <span className="chat-btn-icon">💬</span>
      <span className="chat-btn-text">Chat with Us</span>
    </button>
  );
}

function NavigationBar() {
  const { isConnected, accountType, switchAccount, accountData, handleDisconnect } = useTrading();

  useEffect(() => {
    const savedTheme = localStorage.getItem("app_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-wrapper">
          <NavLink to="/" className="brand-logo-group">
            <span className="brand-name">
              Autom<span className="brand-accent">8</span>
            </span>
          </NavLink>
          <nav className="nav-group">
            <NavLink to="/" end className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>
              Dashboard
            </NavLink>
            <NavLink to="/bots" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>
              Trading Bots
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>
              Trade History
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>
              Support
            </NavLink>
          </nav>
        </div>

        <div className="account-status-group">
          {isConnected ? (
            <div className="account-badge connected">
              <div className="badge-info">
                <span className="status-dot online"></span>
                <select
                  value={accountType}
                  onChange={(e) => switchAccount(e.target.value)}
                  className={`account-select ${accountType === "real" ? "select-real" : "select-demo"}`}
                >
                  <option value="demo">Demo ({accountData?.account || "Demo"})</option>
                  <option value="real">Real (ROT92613117)</option>
                </select>
              </div>

              <div className="badge-divider"></div>

              <div className="balances-container">
                {accountType === "demo" ? (
                  <div className="account-balance demo-balance-container">
                    <span className="balance-label"></span> ${(accountData?.demoBalance ?? accountData?.balance ?? 0).toFixed(2)} {accountData?.currency || "USD"}
                  </div>
                ) : (
                  <div className="account-balance real-balance-container">
                    <span className="balance-label"></span> ${(accountData?.realBalance ?? accountData?.balance ?? 0).toFixed(2)} {accountData?.currency || "USD"}
                  </div>
                ) }
              </div>

              <button onClick={handleDisconnect} className="disconnect-btn">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="account-badge disconnected">
              <span className="status-dot offline"></span>
              <span className="status-text-offline">Not Connected</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <TradingProvider>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <div className="app-container">
          {/* Floating TikTok Button at Top Left */}
          <FloatingTikTokButton />

          <NavigationBar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/bots" element={<BotsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/co" element={<MarketAnalysis />} />
            </Routes>
          </main>
          
          {/* Floating Chat Widget */}
          <FloatingChatWidget />

          <Footer />
        </div>
      </BrowserRouter>
    </TradingProvider>
  );
}