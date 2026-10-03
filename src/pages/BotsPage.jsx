import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTrading } from "../context/TradingContext";
import AegisEngine from "../components/AegisEngine";
import NexusEngine from "../components/NexusEngine";
import QuantumSpikePro from "../components/QuantumSpikePro";
import "./BotsPage.css";

const BOT_SUITE = [
  { id: "aegis", name: "Aegis Matrix", isAccessible: true, badge: "PREMIUM", icon: "🛡️" },
  { id: "nexus", name: "Nexus Pivot Engine", isAccessible: true, badge: "PREMIUM", icon: "🛡️" },
  { id: "quantum", name: "Quantum Spike Pro", isAccessible: true, badge: "PREMIUM", icon: "🛡️" },
];

const BOT_ENGINES = {
  aegis: AegisEngine,
  nexus: NexusEngine,
  quantum: QuantumSpikePro,
};

const STORAGE_KEY = "last_active_bot_tab";

export default function BotsPage() {
  const { bot1State, bot2State, bot3State, activeBotId } = useTrading();

  // Determine active bot session across context & individual state triggers
  const detectedActiveBotId = useMemo(() => {
    if (activeBotId) return activeBotId;
    if (bot1State?.isTrading) return "aegis";
    if (bot2State?.isTrading) return "nexus";
    if (bot3State?.isTrading) return "quantum";
    return null;
  }, [activeBotId, bot1State?.isTrading, bot2State?.isTrading, bot3State?.isTrading]);

  const isAnyBotRunning = Boolean(detectedActiveBotId);

  // Tab persistence with localStorage fallback
  const [activeBotTab, setActiveBotTab] = useState(() => {
    const savedTab = localStorage.getItem(STORAGE_KEY);
    return detectedActiveBotId || savedTab || "aegis";
  });

  // Keep active tab in sync when an active session starts
  useEffect(() => {
    if (detectedActiveBotId) {
      setActiveBotTab(detectedActiveBotId);
      localStorage.setItem(STORAGE_KEY, detectedActiveBotId);
    }
  }, [detectedActiveBotId]);

  const handleTabChange = useCallback((botId) => {
    setActiveBotTab(botId);
    localStorage.setItem(STORAGE_KEY, botId);
  }, []);

  const currentBotObj = BOT_SUITE.find((bot) => bot.id === activeBotTab);
  const ActiveEngineComponent = BOT_ENGINES[activeBotTab];

  return (
    <div className="bots-container">
      {/* Header Section */}
      <header className="bots-page-header">
        <div className="header-title-row">
          <h1>Autom8 Trading Bots Hub</h1>
        </div>
        <p className="page-description">
          Our trading bots are built to run automated strategies across Deriv synthetic indices, from the{" "}
          <strong>Volatility 10 Index</strong> up to the <strong>Volatility 100 Index</strong>. Select a bot below, set your preferred stake, profit targets, and stop-loss parameters, and let the bot handle automated order execution.
        </p>
        <div className="page-disclaimer">
          <span className="disclaimer-icon">⚠️</span>
          <span>
            <strong>Notice:</strong> Automated trading on synthetic indices involves risk. We strongly recommend testing your bot settings on a <strong>Deriv Demo account</strong> first before using real funds.
          </span>
        </div>
      </header>

      {/* Bot Selection Cards Grid */}
      <div className="bot-cards-grid" role="tablist" aria-label="Trading Bots">
        {BOT_SUITE.map((bot) => {
          const isCurrentActiveSession = detectedActiveBotId === bot.id;
          const isLockedByOther = isAnyBotRunning && !isCurrentActiveSession;
          const isClickable = bot.isAccessible && !isLockedByOther;
          const isSelected = activeBotTab === bot.id;

          return (
            <div
              key={bot.id}
              role="tab"
              aria-selected={isSelected}
              aria-disabled={!isClickable}
              tabIndex={isClickable ? 0 : -1}
              className={`bot-selection-card ${isSelected ? "selected-card" : ""} ${
                isLockedByOther ? "card-disabled" : ""
              }`}
              onClick={() => isClickable && handleTabChange(bot.id)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && isClickable) {
                  e.preventDefault();
                  handleTabChange(bot.id);
                }
              }}
            >
              <div className="card-top-bar">
                <span className="card-bot-icon">{bot.icon}</span>
                <span
                  className={`card-badge ${
                    isCurrentActiveSession
                      ? "badge-running"
                      : bot.isAccessible
                      ? "badge-active"
                      : "badge-locked"
                  }`}
                >
                  {isCurrentActiveSession ? "🟢 RUNNING" : bot.badge}
                </span>
              </div>

              <h3 className="card-bot-title">{bot.name}</h3>

              <div className="card-action-bar">
                <button
                  type="button"
                  className={`card-select-btn ${
                    isCurrentActiveSession ? "btn-running" : isSelected ? "btn-active" : ""
                  }`}
                  disabled={!isClickable}
                >
                  {isCurrentActiveSession
                    ? "Active Session"
                    : isSelected
                    ? "Selected Bot"
                    : "Select Bot"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Workspace Area */}
      <div className="bots-workspace">
        <main className="bot-main-content">
          {currentBotObj?.isAccessible && ActiveEngineComponent ? (
            <ActiveEngineComponent
              disabled={Boolean(detectedActiveBotId && detectedActiveBotId !== activeBotTab)}
            />
          ) : (
            <div className="bot-card premium-card locked-placeholder">
              <h2>🔒 Module Restricted</h2>
              <p>This automated strategy requires an elevated subscription tier.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}