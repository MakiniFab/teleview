import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { TradingProvider, useTrading } from "./context/TradingContext";

import HomePage from "./pages/HomePage";
import BotsPage from "./pages/BotsPage";
import HistoryPage from "./pages/HistoryPage";
import ContactPage from "./pages/ContactPage";
import Footer from "./pages/Footer";

import "./App.css";

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
                  <option value="real">Real ({accountData?.account || "Real"})</option>
                </select>
              </div>
              <div className="badge-divider"></div>
              <div className="account-balance">
                ${(accountData?.balance ?? 0).toFixed(2)} {accountData?.currency || "USD"}
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
          <NavigationBar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/bots" element={<BotsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>
          </main>
          
          {/* Floating Chat Widget */}
          <FloatingChatWidget />

          < Footer />
        </div>
      </BrowserRouter>
    </TradingProvider>
  );
}