import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { TradingProvider, useTrading } from "./context/TradingContext";

import HomePage from "./pages/HomePage";
import BotsPage from "./pages/BotsPage";
import MarketAnalysis from "./pages/MarketAnalysis";
import HistoryPage from "./pages/HistoryPage";
import ContactPage from "./pages/ContactPage";

import "./App.css";

function NavigationBar() {
  const { isConnected, accountType, switchAccount, accountData, handleDisconnect } = useTrading();

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-wrapper">
          <NavLink to="/" className="brand-logo-group">
            <span className="brand-name">Autom<span className="brand-accent">8</span></span>
          </NavLink>

          <nav className="nav-group">
            <NavLink to="/" end className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Dashboard</NavLink>
            <NavLink to="/bots" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Trading Bots</NavLink>
            <NavLink to="/signals" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Market Signals</NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Trade History</NavLink>
            <NavLink to="/contact" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Support</NavLink>
          </nav>
        </div>

        <div className="account-status-group">
          {isConnected ? (
            <div className="account-badge">
              <div className="badge-info">
                <span className="status-dot online"></span>
                <select
                  value={accountType}
                  onChange={(e) => switchAccount(e.target.value)}
                  className="account-select"
                >
                  <option value="demo">Demo ({accountData?.account || "Demo"})</option>
                  <option value="real">Real ({accountData?.account || "Real"})</option>
                </select>
              </div>
              <div className="badge-divider"></div>
              <div className="account-balance">
                ${(accountData?.balance ?? 0).toFixed(2)} {accountData?.currency || "USD"}
              </div>
              <button onClick={handleDisconnect} className="disconnect-btn">Disconnect</button>
            </div>
          ) : (
            <div className="account-badge">
              <span className="status-dot offline"></span>
              <span style={{ color: "var(--trade-muted)" }}>Not Connected</span>
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
              <Route path="/signals" element={<MarketAnalysis />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>
          </main>
          <footer className="app-footer">
            <div className="footer-inner">
              <p>© {new Date().getFullYear()} Deriv Autom8. A FAB Software Solutions web platform.</p>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </TradingProvider>
  );
}