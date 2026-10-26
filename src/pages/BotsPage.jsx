import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTrading } from "../context/TradingContext";
import AegisEngine from "../components/AegisEngine";
import NexusEngine from "../components/NexusEngine";
import QuantumSpikePro from "../components/QuantumSpikePro";
import TitanMultiMarketEngine from "../components/TitanMultiMarketEngine";
import TroyEngine from "../components/TroyEngine";
import "./BotsPage.css";

const BOT_SUITE = [
  { id: "aegis", name: "Aegis Matrix", isAccessible: true, badge: "PREMIUM", icon: "🛡️" },
  { id: "nexus", name: "Nexus Pivot Engine", isAccessible: true, badge: "PREMIUM", icon: "🛡️" },
  { id: "quantum", name: "Quantum Spike Pro", isAccessible: true, badge: "PREMIUM", icon: "🛡️" },
  { id: "titan", name: "Titan Multi-Market", isAccessible: true, badge: "PRO", icon: "🏛️" },
  { id: "troy", name: "Troy Engine", isAccessible: true, badge: "PRO", icon: "⚔️" },
];

const BOT_ENGINES = {
  aegis: AegisEngine,
  nexus: NexusEngine,
  quantum: QuantumSpikePro,
  titan: TitanMultiMarketEngine,
  troy: TroyEngine,
};

const STORAGE_KEY = "last_active_bot_tab";
const GUIDE_DISMISSED_KEY = "autom8_strategy_guide_dismissed";

export default function BotsPage() {
  const { bot1State, bot2State, bot3State, bot4State, bot5State, activeBotId } = useTrading();

  // Dismissible Guide State
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem(GUIDE_DISMISSED_KEY) !== "true";
  });

  const dismissGuide = () => {
    setShowGuide(false);
    localStorage.setItem(GUIDE_DISMISSED_KEY, "true");
  };

  // Detect active session across all 5 bots
  const detectedActiveBotId = useMemo(() => {
    if (activeBotId) return activeBotId;
    if (bot1State?.isTrading) return "aegis";
    if (bot2State?.isTrading) return "nexus";
    if (bot3State?.isTrading) return "quantum";
    if (bot4State?.isTrading) return "titan";
    if (bot5State?.isTrading) return "troy";
    return null;
  }, [
    activeBotId,
    bot1State?.isTrading,
    bot2State?.isTrading,
    bot3State?.isTrading,
    bot4State?.isTrading,
    bot5State?.isTrading,
  ]);

  const isAnyBotRunning = Boolean(detectedActiveBotId);

  const [activeBotTab, setActiveBotTab] = useState(() => {
    const savedTab = localStorage.getItem(STORAGE_KEY);
    return detectedActiveBotId || savedTab || "aegis";
  });

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

      {/* Pro Strategy & Risk Guide Popup/Banner */}
      {showGuide && (
        <div className="strategy-guide-banner">
          <div className="guide-header">
            <div className="guide-title-wrap">
              <span className="guide-icon">💡</span>
              <h3>Pro Strategy & Configuration Guide</h3>
            </div>
          </div>
          <div className="guide-content-grid">
            <div className="guide-item">
              <span className="guide-label">Profit Ratio (Optimum: 45%)</span>
              <p>Setting this too high risks escalating stakes too fast; setting it too low delays your target profits.</p>
            </div>
            <div className="guide-item">
              <span className="guide-label">Duration & Risk (Minutes/Hours Preferred)</span>
              <p>Shorter durations like 1-10 ticks carry higher volatility risks compared to minutes or hours.</p>
            </div>
            <div className="guide-item">
              <span className="guide-label">Take Profit & Stop Loss (Recommended: 5x & 30x)</span>
              <p>Default <strong>5x Stake</strong> for Take Profit and <strong>30x Stake</strong> for Stop Loss provide the best balance.</p>
            </div>
            <div className="guide-item">
              <span className="guide-label">Execution Rule & Network Stability</span>
              <p>Bots typically hit targets within ~30 trades. Keep targets short, avoid over-extension, and ensure a stable network connection.</p>
            </div>
          </div>
        </div>
      )}

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