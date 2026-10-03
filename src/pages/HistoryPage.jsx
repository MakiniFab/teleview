import React, { useState, useEffect, useMemo } from "react";
import { useTrading } from "../context/TradingContext";
import "./HistoryPage.css";

const SELECTED_BOT_STORAGE_KEY = "history_selected_bot_id";

const BOT_CONFIGS = [
  { id: "aegis", name: "Aegis Matrix Engine", key: 1 },
  { id: "nexus", name: "Nexus Pivot Engine", key: 2 },
  { id: "quantum", name: "Quantum Spike Pro", key: 3 },
  { id: "titan", name: "Titan Multi-Market Engine", key: 4 },
  { id: "troy", name: "The Troy Engine", key: 5 },
];

export default function HistoryPage() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  const {
    activeBotId,
    bot1State,
    bot2State,
    bot3State,
    bot4State,
    bot5State,
    engineRef1,
    engineRef2,
    engineRef3,
    engineRef4,
    engineRef5,
  } = useTrading();

  const botMap = useMemo(
    () => ({
      aegis: { state: bot1State, engine: engineRef1, name: "Aegis Matrix Engine" },
      nexus: { state: bot2State, engine: engineRef2, name: "Nexus Pivot Engine" },
      quantum: { state: bot3State, engine: engineRef3, name: "Quantum Spike Pro" },
      titan: { state: bot4State, engine: engineRef4, name: "Titan Multi-Market Engine" },
      troy: { state: bot5State, engine: engineRef5, name: "The Troy Engine" },
    }),
    [
      bot1State,
      bot2State,
      bot3State,
      bot4State,
      bot5State,
      engineRef1,
      engineRef2,
      engineRef3,
      engineRef4,
      engineRef5,
    ]
  );

  const detectedActiveBotId = useMemo(() => {
    if (activeBotId) return activeBotId;
    if (bot1State?.isTrading) return "aegis";
    if (bot2State?.isTrading) return "nexus";
    if (bot3State?.isTrading) return "quantum";
    if (bot4State?.isTrading) return "titan";
    if (bot5State?.isTrading) return "troy";
    return "aegis";
  }, [
    activeBotId,
    bot1State?.isTrading,
    bot2State?.isTrading,
    bot3State?.isTrading,
    bot4State?.isTrading,
    bot5State?.isTrading,
  ]);

  const [selectedBotId, setSelectedBotId] = useState(() => {
    const saved = localStorage.getItem(SELECTED_BOT_STORAGE_KEY);
    return saved && BOT_CONFIGS.some((b) => b.id === saved)
      ? saved
      : detectedActiveBotId;
  });

  const handleBotChange = (e) => {
    const newId = e.target.value;
    setSelectedBotId(newId);
    localStorage.setItem(SELECTED_BOT_STORAGE_KEY, newId);
  };

  const currentBot = botMap[selectedBotId] || botMap["aegis"];
  const liveHistory = currentBot.state?.history || [];
  const engineInstance = currentBot.engine?.current;

  // -------------------------------------------------------------
  // PERSISTENT HISTORY ARCHIVE
  // Keeps accumulated trade logs across block restarts/resets
  // -------------------------------------------------------------
  const [persistentHistory, setPersistentHistory] = useState(() => {
    const saved = localStorage.getItem(`persistent_history_${selectedBotId}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Re-load stored history whenever selected bot changes
  useEffect(() => {
    const saved = localStorage.getItem(`persistent_history_${selectedBotId}`);
    setPersistentHistory(saved ? JSON.parse(saved) : []);
  }, [selectedBotId]);

  // Sync incoming live trades to persistent storage without duplicate entries
  useEffect(() => {
    if (!liveHistory || liveHistory.length === 0) return;

    setPersistentHistory(() => {
      const mergedMap = new Map();

      // Helper function to create a truly unique signature for a trade row
      const getTradeKey = (item, idx) => {
        if (item.id) return String(item.id);
        if (item.contractId) return String(item.contractId);
        // Fallback signature combining trade number, block, row, and stake/timestamp
        return `${item.totalTrade || idx}_B${item.blockNum || 1}_R${item.blockRow || ""}_${item.stakeUsed || 0}_${item.profitLoss || 0}_${item.timestamp || ""}`;
      };

      // 1. Load currently existing stored history
      const storedRaw = localStorage.getItem(`persistent_history_${selectedBotId}`);
      const existingStored = storedRaw ? JSON.parse(storedRaw) : [];

      // 2. Add existing items first
      existingStored.forEach((item, idx) => {
        mergedMap.set(getTradeKey(item, idx), item);
      });

      // 3. Add/overwrite with live items from context
      liveHistory.forEach((item, idx) => {
        mergedMap.set(getTradeKey(item, idx), item);
      });

      const updated = Array.from(mergedMap.values());
      localStorage.setItem(`persistent_history_${selectedBotId}`, JSON.stringify(updated));
      return updated;
    });
  }, [liveHistory, selectedBotId]);

  // Use persistentHistory as the source for rendered trade data
  const historyData = persistentHistory;

  // Key Aggregation Metrics
  const totalTrades = historyData.length;
  const totalWins = historyData.filter(
    (row) => row.outcome === "W" || Number(row.profitLoss) > 0
  ).length;
  const totalLosses = historyData.filter(
    (row) => row.outcome === "L" || Number(row.profitLoss) < 0
  ).length;
  const netProfit = historyData.reduce(
    (acc, row) => acc + (Number(row.profitLoss) || 0),
    0
  );
  const winRate =
    totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : "0.0";

  const unitProfit = engineInstance?.UNIT_TARGET_PROFIT || 0.45;
  const activeExpectedWins =
    engineInstance?.expectedWins ??
    engineInstance?.expectedWinsRequired ??
    engineInstance?.pendingWinDebt ??
    0;

  const activeBankedWins = engineInstance?.bankedWins ?? 0;
  const activeModifier = engineInstance?.stakingModifier ?? 0;
  const remWins = Math.max(1, activeExpectedWins - activeBankedWins);
  const liveDivisor =
    activeBankedWins < activeExpectedWins
      ? remWins + activeModifier
      : activeModifier > 0
      ? activeModifier
      : 1;

  // Clear History only when explicitly triggered by the user button
  const handleClearHistory = () => {
    if (window.confirm(`Are you sure you want to clear history for ${currentBot.name}?`)) {
      if (currentBot.engine?.current?.clearHistory) {
        currentBot.engine.current.clearHistory();
      }
      // Wipes persistent storage key explicitly
      localStorage.removeItem(`persistent_history_${selectedBotId}`);
      localStorage.removeItem(`${selectedBotId}_session_data`);
      setPersistentHistory([]);
    }
  };

  return (
    <div className="history-container">
      {/* Header Controls */}
      <div className="history-header">
        <div>
          <h1 className="history-title">Trade History & Staking Ledger</h1>
          <p className="history-subtitle">
            Real-time execution log with persistent trade archival.
          </p>
        </div>

        <div className="history-controls">
          <button onClick={handleClearHistory} className="clear-btn" disabled={historyData.length === 0}>
            🗑️ Clear History
          </button>
          <div className="bot-selector-wrapper">
            <label htmlFor="bot-select" className="selector-label">
              Select Engine:
            </label>
            <select
              id="bot-select"
              value={selectedBotId}
              onChange={handleBotChange}
              className="bot-select-dropdown"
            >
              {BOT_CONFIGS.map((bot) => {
                const isRunning =
                  (bot.id === "aegis" && bot1State?.isTrading) ||
                  (bot.id === "nexus" && bot2State?.isTrading) ||
                  (bot.id === "quantum" && bot3State?.isTrading) ||
                  (bot.id === "titan" && bot4State?.isTrading) ||
                  (bot.id === "troy" && bot5State?.isTrading);

                return (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} {isRunning ? "• [LIVE RUNNING]" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-title">Active Bot Status</span>
          <div className="metric-status-row">
            <span
              className={`status-dot ${
                currentBot.state?.isTrading ? "online" : "offline"
              }`}
            ></span>
            <span className="metric-value-text">
              {currentBot.state?.isTrading ? "EXECUTING" : "IDLE / STOPPED"}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-title">Total Trades</span>
          <span className="metric-value">{totalTrades}</span>
          <span className="metric-subtext">
            {totalWins} Wins / {totalLosses} Losses ({winRate}% Winrate)
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-title">Cycle Running P/L</span>
          <span
            className={`metric-value ${
              netProfit >= 0 ? "profit-green" : "loss-red"
            }`}
          >
            {netProfit >= 0 ? "+" : ""}${netProfit.toFixed(2)}
          </span>
          <span className="metric-subtext">
            Engine Balance: ${Number(engineInstance?.cycleRunningBalance || 0).toFixed(2)}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-title">Target Expected Wins</span>
          <span className="metric-value warning-yellow">
            {activeExpectedWins} Wins
          </span>
          <span className="metric-subtext">
            Current Block: #{engineInstance?.blockNum || 1} (Row {engineInstance?.posInBlock || 1}/50)
          </span>
        </div>

        <div className="metric-card highlight-card">
          <span className="metric-title">Live Staking Parameters</span>
          <span className="metric-value text-accent">
            Divisor: {liveDivisor} | Mod: +{activeModifier}
          </span>
          <span className="metric-subtext">
            Unit Profit Target: ${unitProfit.toFixed(2)}
          </span>
        </div>
      </div>

      {/* History Data Table */}
      <div className="history-table-card">
        <div className="table-wrapper">
          <table className="history-table">
            <thead>
              <tr className="table-header-row">
                <th className="p-3 font-semibold text-gray-700">#</th>
                <th className="p-3 font-semibold text-gray-700">Block/Row</th>
                <th className="p-3 font-semibold text-gray-700">Outcome</th>
                <th className="p-3 font-semibold text-gray-700">Stake</th>
                <th className="p-3 font-semibold text-gray-700">P/L</th>
                <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Running Bal</th>
                <th className="p-3 font-semibold text-gray-700">Next Stake</th>
              </tr>
            </thead>

            <tbody>
              {historyData.length > 0 ? (
                historyData
                  .slice()
                  .reverse()
                  .map((row, index) => {
                    const isWin = row.outcome === "W" || Number(row.profitLoss) > 0;
                    const formattedStake = Number(row.stakeUsed || 0).toFixed(2);
                    const formattedProfit = Number(row.profitLoss || 0).toFixed(2);
                    const formattedRunningBal = Number(row.runningBalance || 0).toFixed(2);
                    const formattedNextStake = Number(row.nextStake || 0).toFixed(2);

                    return (
                      <tr key={index} className="table-body-row">
                        <td className="p-3 font-medium text-gray-800">
                          {row.totalTrade || historyData.length - index}
                        </td>
                        <td className="p-3 text-gray-600">
                          <span className="block-tag">
                            B{row.blockNum || 1}
                          </span>{" "}
                          <span className="row-tag">{row.blockRow || "1/50"}</span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`outcome-badge ${
                              isWin ? "badge-win" : "badge-loss"
                            }`}
                          >
                            {row.outcome || (isWin ? "W" : "L")}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-gray-800">
                          ${formattedStake}
                        </td>
                        <td
                          className={`p-3 font-mono font-semibold ${
                            isWin ? "text-win" : "text-loss"
                          }`}
                        >
                          {isWin ? "+" : ""}${formattedProfit}
                        </td>
                        <td className="p-3 font-mono text-gray-700 whitespace-nowrap">
                          ${formattedRunningBal}
                        </td>
                        <td className="p-3 font-mono font-bold text-accent">
                          ${formattedNextStake}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan="7" className="empty-table-cell">
                    <div className="empty-state">
                      <span className="empty-icon">📊</span>
                      <p className="empty-title">No Trade History Logged</p>
                      <p className="empty-description">
                        Start trading with {currentBot.name} to view continuous trade logs. History remains preserved across block resets until manually cleared.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}