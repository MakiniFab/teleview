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

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

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

  // Correctly map states and engine refs to their exact bot identities
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

  // Detect currently executing bot if activeBotId is not set
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

  // Persistent Selected Bot Filter State (preserves selection on refresh)
  const [selectedBotId, setSelectedBotId] = useState(() => {
    const saved = localStorage.getItem(SELECTED_BOT_STORAGE_KEY);
    return saved && BOT_CONFIGS.some((b) => b.id === saved)
      ? saved
      : detectedActiveBotId;
  });

  // Save selected bot ID whenever user changes the dropdown
  const handleBotChange = (e) => {
    const newId = e.target.value;
    setSelectedBotId(newId);
    localStorage.setItem(SELECTED_BOT_STORAGE_KEY, newId);
  };

  // Sync selection with running bot if no explicit local preference was stored
  useEffect(() => {
    const saved = localStorage.getItem(SELECTED_BOT_STORAGE_KEY);
    if (!saved && detectedActiveBotId) {
      setSelectedBotId(detectedActiveBotId);
    }
  }, [detectedActiveBotId]);

  // Active bot context references
  const currentBot = botMap[selectedBotId] || botMap["aegis"];
  const historyData = currentBot.state?.history || [];
  const engineData = currentBot.engine?.current;

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

  // CSV Export Functionality
  const exportToCSV = () => {
    if (historyData.length === 0) return;

    const headers = [
      "#",
      "Block/Row",
      "Outcome",
      "Stake ($)",
      "Profit/Loss ($)",
      "Running Balance ($)",
      "Expected Profit ($)",
      "Status",
      "Next Stake ($)",
    ];

    const csvRows = [
      headers.join(","),
      ...historyData.map((row, index) =>
        [
          row.totalTrade || index + 1,
          `"${row.blockNum ? `Block ${row.blockNum} (${row.blockRow})` : row.blockRow || "-"}"`,
          row.outcome || "-",
          Number(row.stakeUsed || 0).toFixed(2),
          Number(row.profitLoss || 0).toFixed(2),
          Number(row.runningBalance || 0).toFixed(2),
          Number(row.expectedProfit || 0).toFixed(2),
          `"${row.blockStatus || "Active"}"`,
          Number(row.nextStake || 0).toFixed(2),
        ].join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedBotId}_trading_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="history-container">
      {/* Page Header & Selector */}
      <div className="history-header">
        <div>
          <h1 className="history-title">Trade History & Staking Ledger</h1>
          <p className="history-subtitle">
            Real-time execution log and block status metrics for active and past bot operations.
          </p>
        </div>

        {/* Bot Selector Dropdown */}
        <div className="history-controls">
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

      {/* Summary KPI Cards */}
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
            Engine Balance: ${Number(engineData?.cycleRunningBalance || 0).toFixed(2)}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-title">Pending Win Debt</span>
          <span className="metric-value warning-yellow">
            {engineData?.pendingWinDebt || 0} Wins
          </span>
          <span className="metric-subtext">
            Current Block: #{engineData?.blockNum || 1} (Row {engineData?.posInBlock || 1}/50)
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
                <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Expected Profit</th>
                <th className="p-3 font-semibold text-gray-700">Status</th>
                <th className="p-3 font-semibold text-gray-700">Next Stake</th>
              </tr>
            </thead>

            <tbody>
              {historyData.length > 0 ? (
                historyData
                  .slice()
                  .reverse() // Display latest trades at the top
                  .map((row, index) => {
                    const isWin = row.outcome === "W" || Number(row.profitLoss) > 0;
                    const formattedStake = Number(row.stakeUsed || 0).toFixed(2);
                    const formattedProfit = Number(row.profitLoss || 0).toFixed(2);
                    const formattedRunningBal = Number(row.runningBalance || 0).toFixed(2);
                    const formattedExpectedProfit = Number(row.expectedProfit || 0).toFixed(2);
                    const formattedNextStake = Number(row.nextStake || 0).toFixed(2);

                    return (
                      <tr key={index} className="table-body-row">
                        {/* 1. # (Trade Number) */}
                        <td className="p-3 font-medium text-gray-800">
                          {row.totalTrade || historyData.length - index}
                        </td>

                        {/* 2. Block/Row */}
                        <td className="p-3 text-gray-600">
                          <span className="block-tag">
                            B{row.blockNum || 1}
                          </span>{" "}
                          <span className="row-tag">{row.blockRow || "1/50"}</span>
                        </td>

                        {/* 3. Outcome */}
                        <td className="p-3">
                          <span
                            className={`outcome-badge ${
                              isWin ? "badge-win" : "badge-loss"
                            }`}
                          >
                            {row.outcome || (isWin ? "W" : "L")}
                          </span>
                        </td>

                        {/* 4. Stake */}
                        <td className="p-3 font-mono text-gray-800">
                          ${formattedStake}
                        </td>

                        {/* 5. P/L */}
                        <td
                          className={`p-3 font-mono font-semibold ${
                            isWin ? "text-win" : "text-loss"
                          }`}
                        >
                          {isWin ? "+" : ""}${formattedProfit}
                        </td>

                        {/* 6. Running Bal */}
                        <td className="p-3 font-mono text-gray-700 whitespace-nowrap">
                          ${formattedRunningBal}
                        </td>

                        {/* 7. Expected Profit */}
                        <td className="p-3 font-mono text-gray-700 whitespace-nowrap">
                          ${formattedExpectedProfit}
                        </td>

                        {/* 8. Status */}
                        <td className="p-3">
                          <span
                            className={`status-badge ${
                              String(row.blockStatus).includes("WIN")
                                ? "status-block-win"
                                : String(row.blockStatus).includes("LOSS")
                                ? "status-block-loss"
                                : "status-block-active"
                            }`}
                          >
                            {row.blockStatus || "Active"}
                          </span>
                        </td>

                        {/* 9. Next Stake */}
                        <td className="p-3 font-mono font-bold text-accent">
                          ${formattedNextStake}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan="9" className="empty-table-cell">
                    <div className="empty-state">
                      <span className="empty-icon">📊</span>
                      <p className="empty-title">No Trade History Logged</p>
                      <p className="empty-description">
                        Start trading with {currentBot.name} to see real-time block progressions and dynamic stake adjustments here.
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