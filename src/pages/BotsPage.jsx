import React, { useState, useEffect } from "react";
import { useTrading } from "../context/TradingContext";
import AegisEngine from "../components/AegisEngine";
import NexusEngine from "../components/NexusEngine";
import QuantumSpikePro from "../components/QuantumSpikePro";
import TitanEngine from "../components/TitanEngine";
// import TroyEngine from "../components/TroyEngine"; // Fifth Bot
import "./BotsPage.css";

const BOT_SUITE = [
  { id: "aegis", name: "Aegis Matrix", isAccessible: true, badge: "ACTIVE (0.45)" },
  { id: "nexus", name: "Nexus Pivot Engine", isAccessible: true, badge: "PREMIUM" },
  { id: "quantum", name: "Quantum Spike Pro", isAccessible: true, badge: "PREMIUM" },
  { id: "titan", name: "Quantum High-Frequency", isAccessible: true, badge: "PREMIUM" },
  // { id: "troy", name: "The Troy Engine", isAccessible: true, badge: "ACTIVE (HYBRID)" },
];

export default function BotsPage() {
  const { bot1State, bot2State, bot3State, bot4State, bot5State, activeBotId } = useTrading();

  // Correct 1-to-1 mapping based on your context:
  // bot1State -> aegis
  // bot2State -> nexus
  // bot3State -> quantum
  // bot4State -> titan
  // bot5State -> troy
  const detectedActiveBotId = activeBotId || (
    bot1State?.isTrading ? "aegis" :
    bot2State?.isTrading ? "nexus" :
    bot3State?.isTrading ? "quantum" :
    bot4State?.isTrading ? "titan" :
    bot5State?.isTrading ? "troy" : null
  );

  const isAnyBotRunning = Boolean(detectedActiveBotId);

  // Tab persistence with localStorage fallback
  const [activeBotTab, setActiveBotTab] = useState(() => {
    const savedTab = localStorage.getItem("last_active_bot_tab");
    return detectedActiveBotId || savedTab || "aegis";
  });
  

  // Keep active tab in sync and persist changes
  useEffect(() => {
    if (detectedActiveBotId) {
      setActiveBotTab(detectedActiveBotId);
      localStorage.setItem("last_active_bot_tab", detectedActiveBotId);
    }
  }, [detectedActiveBotId]);

  const handleTabChange = (botId) => {
    setActiveBotTab(botId);
    localStorage.setItem("last_active_bot_tab", botId);
  };

  return (
    <div className="bots-container">
      <div className="bots-page-header">
        <h1>Autom8 Bots Guide Center</h1>
        <p className="page-description">
          Our automated bots are engineered specifically for short-interval contract execution across Deriv synthetic indices (ranging from <strong>Volatility 10 Index</strong> to <strong>Volatility 100 Index</strong>) operating on <strong>2-minute trade intervals</strong> over <strong>2-hour execution cycles</strong>. Select your preferred bot below to customize staking methods, risk boundaries, and execution strategies. Each bot connects directly via official WebSocket endpoints to execute CALL and PUT trades seamlessly.
        </p>
        <p className="page-disclaimer">
          ⚠️ <strong>Notice:</strong> Running automated trading algorithms on synthetic indices carries market risk and does not guarantee profits. We strongly advise testing all bot configurations on a <strong>Deriv Demo account</strong> first to understand execution behavior and strategy dynamics before deploying real funds.
        </p>
      </div>

      <div className="bots-workspace">
        {/* Sidebar Menu */}
        <aside className="bots-sidebar">
          <div className="sidebar-title">Automated Bot Suite</div>
          <nav className="bot-menu-list">
            {BOT_SUITE.map((bot) => {
              const isCurrentActiveSession = detectedActiveBotId === bot.id;
              // Only lock tabs if a DIFFERENT bot is actively running
              const isLockedByOther = isAnyBotRunning && !isCurrentActiveSession;
              const isClickable = bot.isAccessible && !isLockedByOther;

              return (
                <button
                  key={bot.id}
                  className={`bot-menu-item ${
                    activeBotTab === bot.id ? "active" : ""
                  } ${!bot.isAccessible ? "locked" : ""} ${
                    isLockedByOther ? "disabled-running" : ""
                  }`}
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      handleTabChange(bot.id);
                    }
                  }}
                >
                  <div className="menu-item-info">
                    <span className="bot-name">{bot.name}</span>
                    {!bot.isAccessible && <span className="lock-icon">🔒</span>}
                  </div>
                  <span
                    className={`menu-badge ${
                      bot.isAccessible ? "badge-active" : "badge-locked"
                    }`}
                  >
                    {bot.badge}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Dynamic View Panel */}
        <main className="bot-main-content">
          {activeBotTab === "aegis" && (
            <AegisEngine disabled={Boolean(detectedActiveBotId && detectedActiveBotId !== "aegis")} />
          )}
          {activeBotTab === "nexus" && (
            <NexusEngine disabled={Boolean(detectedActiveBotId && detectedActiveBotId !== "nexus")} />
          )}
          {activeBotTab === "quantum" && (
            <QuantumSpikePro disabled={Boolean(detectedActiveBotId && detectedActiveBotId !== "quantum")} />
          )}
          {activeBotTab === "titan" && (
            <TitanEngine disabled={Boolean(detectedActiveBotId && detectedActiveBotId !== "titan")} />
          )}
          {/* {activeBotTab === "troy" && (
            <TroyEngine disabled={Boolean(detectedActiveBotId && detectedActiveBotId !== "troy")} />
          )} */}

          {/* Fallback for locked modules */}
          {!BOT_SUITE.find((b) => b.id === activeBotTab)?.isAccessible && (
            <div className="bot-card premium-card locked-placeholder">
              <h2>Module Restricted</h2>
              <p>This automated strategy requires an elevated subscription tier.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}