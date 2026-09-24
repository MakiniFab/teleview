import React, { useState, useRef } from "react";
import { useTrading } from "../context/TradingContext";
import "./BotsPage.css";

const API_BASE = "https://api.derivws.com";
const APP_ID = "34sztETpkcwjcAayV9upz";
const CURRENCY = "USD";

// Standard Volatility Markets Range
const VOLATILITY_MARKETS = [
  { id: "R_10", label: "Volatility 10 Index" },
  { id: "R_25", label: "Volatility 25 Index" },
  { id: "R_50", label: "Volatility 50 Index" },
  { id: "R_75", label: "Volatility 75 Index" },
  { id: "R_100", label: "Volatility 100 Index" },
];

// Bot Suite Menu Configuration
const BOT_SUITE = [
  { id: "aegis", name: "Aegis Matrix Engine", isAccessible: true, badge: "ACTIVE" },
  { id: "quantum", name: "Quantum Spike Pro", isAccessible: false, badge: "PREMIUM" },
  { id: "titan", name: "Titan High-Frequency", isAccessible: false, badge: "PREMIUM" },
  { id: "apex", name: "Apex Martingale V2", isAccessible: false, badge: "PREMIUM" },
  { id: "nexus", name: "Nexus Grid Trader", isAccessible: false, badge: "PREMIUM" },
];

export default function BotsPage() {
  const {
    patToken,
    isConnected,
    accountType,
    bot2State,
    setBot2State,
    wsRef2,
    engineRef2,
  } = useTrading();

  const [selectedSymbol, setSelectedSymbol] = useState("R_100");
  const [contractType, setContractType] = useState("PUT");
  const [autoMarketSelect, setAutoMarketSelect] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(2);
  const [minStake, setMinStake] = useState(1.0);
  const [targetProfit, setTargetProfit] = useState(45.0);
  const [activeBotTab, setActiveBotTab] = useState("aegis");

  // Track win counts for Banked Wins metric
  const [bankedWinsCount, setBankedWinsCount] = useState(0);
  const [totalSettledCount, setTotalSettledCount] = useState(0);

  const requestIdRef = useRef(300);
  const isExecutingRef = useRef(false);
  const activeStakeRef = useRef(minStake);
  const settledIdsRef = useRef(new Set());
  const isTradingRef = useRef(false);
  const executionTimeoutRef = useRef(null);
  const lossStreakRef = useRef(0);
  const totalSessionProfitRef = useRef(0);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setBot2State((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-99), `[Aegis Engine | ${time}] ${msg}`],
    }));
  };

  const clearExecutionTimeout = () => {
    if (executionTimeoutRef.current) {
      clearTimeout(executionTimeoutRef.current);
      executionTimeoutRef.current = null;
    }
  };

  const unlockAndRetry = (ws, delay = 2000, reason = "") => {
    if (!isTradingRef.current) return;
    if (reason) addLog(`Reset: ${reason}`);
    clearExecutionTimeout();
    isExecutingRef.current = false;

    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN && isTradingRef.current) {
        sendProposal(ws);
      }
    }, delay);
  };

  const readJsonResponse = async (response) => {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  // Synchronize base stake ($1.00) to target profit ratio ($45.00)
  const handleStakeChange = (e) => {
    const val = Math.max(1.0, parseFloat(e.target.value) || 1.0);
    setMinStake(val);
    setTargetProfit(val * 45.0);
  };

  const handleDurationChange = (e) => {
    const val = parseInt(e.target.value, 10) || 2;
    setDurationMinutes(Math.max(2, val));
  };

  /**
   * Randomly selects a Volatility Index from Volatility 10 to 100 Index.
   */
  const getRandomMarket = () => {
    const randomIndex = Math.floor(Math.random() * VOLATILITY_MARKETS.length);
    return VOLATILITY_MARKETS[randomIndex].id;
  };

  const sendProposal = (ws) => {
    if (
      isExecutingRef.current ||
      !isTradingRef.current ||
      !ws ||
      ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    isExecutingRef.current = true;
    const stake = engineRef2.current.getNextStake(Number(minStake));
    activeStakeRef.current = stake;

    const durationInMs = Number(durationMinutes) * 60 * 1000;

    clearExecutionTimeout();
    executionTimeoutRef.current = setTimeout(() => {
      unlockAndRetry(
        ws,
        1000,
        "Execution safety timeout reached (no settlement received)."
      );
    }, durationInMs + 15000);

    ws.send(
      JSON.stringify({
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type: contractType,
        currency: CURRENCY,
        duration: Number(durationMinutes),
        duration_unit: "m",
        underlying_symbol: selectedSymbol,
        req_id: ++requestIdRef.current,
      })
    );
    addLog(
      `Submitted Order: ${selectedSymbol} ${contractType} (${durationMinutes}m) @ $${stake.toFixed(
        2
      )}`
    );
  };

  const startBot = async () => {
    if (!isConnected || !patToken) {
      return alert("Please connect your PAT on the Dashboard first.");
    }

    if (Number(minStake) < 1.0) {
      return alert("Minimum base stake must be at least $1.00.");
    }
    if (Number(durationMinutes) < 2) {
      return alert("Minimum contract duration is 2 minutes.");
    }

    // Pick random market if auto market selection is enabled
    let activeMarket = selectedSymbol;
    if (autoMarketSelect) {
      activeMarket = getRandomMarket();
      setSelectedSymbol(activeMarket);
    }

    isTradingRef.current = true;
    isExecutingRef.current = false;
    lossStreakRef.current = 0;
    totalSessionProfitRef.current = 0;
    setBankedWinsCount(0);
    setTotalSettledCount(0);
    setBot2State((prev) => ({ ...prev, isTrading: true, logs: [] }));
    settledIdsRef.current.clear();
    engineRef2.current.MIN_STAKE = Number(minStake);

    try {
      addLog(`Connecting to ${accountType.toUpperCase()} Options Account...`);
      const accResponse = await fetch(
        `${API_BASE}/trading/v1/options/accounts`,
        {
          headers: {
            Authorization: `Bearer ${patToken}`,
            "Deriv-App-ID": APP_ID,
          },
        }
      );
      const accData = await readJsonResponse(accResponse);
      if (!accResponse.ok) {
        throw new Error(accData?.error?.message || "Failed to fetch account info.");
      }

      const accountsArray = Array.isArray(accData?.data?.data)
        ? accData.data.data
        : Array.isArray(accData?.data)
        ? accData.data
        : [];

      const targetAccount =
        accountsArray.find(
          (item) => String(item?.account_type).toLowerCase() === accountType
        ) || accountsArray[0];

      if (!targetAccount?.account_id) {
        throw new Error(`No ${accountType} Options account found.`);
      }

      addLog("Requesting WebSocket session OTP token...");
      const otpResponse = await fetch(
        `${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(
          targetAccount.account_id
        )}/otp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${patToken}`,
            "Deriv-App-ID": APP_ID,
          },
        }
      );
      const otpData = await readJsonResponse(otpResponse);
      if (!otpResponse.ok) {
        throw new Error(otpData?.error?.message || "OTP session authorization failed.");
      }

      const wsUrl = otpData?.data?.url;
      if (!wsUrl) {
        throw new Error("Deriv REST API did not return a valid WebSocket endpoint.");
      }

      addLog("Establishing secure WebSocket connection...");
      const ws = new WebSocket(wsUrl);
      wsRef2.current = ws;

      ws.onopen = () => {
        addLog(`WebSocket active. Market locked: ${activeMarket} (${contractType})`);
        sendProposal(ws);
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.error) {
          addLog(`Deriv API Error: ${data.error.message}`);
          unlockAndRetry(ws, 3000, "API Error encountered");
          return;
        }

        if (data.msg_type === "proposal") {
          if (data.proposal) {
            ws.send(
              JSON.stringify({
                buy: data.proposal.id,
                price: data.proposal.ask_price,
                req_id: ++requestIdRef.current,
              })
            );
          } else {
            unlockAndRetry(ws, 2000, "Received empty market proposal");
          }
        }

        if (data.msg_type === "buy") {
          const contractId = data.buy.contract_id;
          addLog(`Position Opened: ${contractType} Contract #${contractId}`);
          setBot2State((prev) => ({
            ...prev,
            contract: { contractId, profit: 0 },
          }));
          ws.send(
            JSON.stringify({
              proposal_open_contract: 1,
              contract_id: contractId,
              subscribe: 1,
              req_id: ++requestIdRef.current,
            })
          );
        }

        if (data.msg_type === "proposal_open_contract") {
          const poc = data.proposal_open_contract;
          if (!poc) return;

          const profit = Number(poc.profit || 0);
          setBot2State((prev) => ({
            ...prev,
            contract: { ...prev.contract, profit },
          }));

          const isSettled =
            poc.is_expired === 1 ||
            poc.is_expired === true ||
            poc.is_sold === 1 ||
            poc.is_sold === true ||
            poc.status === "won" ||
            poc.status === "lost" ||
            poc.status === "sold";

          if (isSettled && !settledIdsRef.current.has(poc.contract_id)) {
            settledIdsRef.current.add(poc.contract_id);
            clearExecutionTimeout();

            const row = engineRef2.current.processOutcome(
              profit,
              activeStakeRef.current,
              Number(minStake)
            );

            const isWin = row.outcome === "W" || profit > 0;
            totalSessionProfitRef.current += Number(row.profitLoss || 0);

            // Update win counters
            setTotalSettledCount((prev) => prev + 1);
            if (isWin) {
              setBankedWinsCount((prev) => prev + 1);
            }

            setBot2State((prev) => ({
              ...prev,
              history: [...prev.history, { bot: "Aegis Matrix", ...row }],
            }));

            addLog(
              `Settlement: [${
                row.outcome
              }] Net P/L: $${row.profitLoss.toFixed(
                2
              )} | Session Acc: $${totalSessionProfitRef.current.toFixed(2)}`
            );

            // STOP RULE 1: Stake > $7.00 Win Cap
            if (isWin && activeStakeRef.current > 7.0) {
              addLog(
                `[CAP TRIGGERED] Stake was $${activeStakeRef.current.toFixed(
                  2
                )} (> $7.00) and won. Block complete. Halting bot.`
              );
              stopBot();
              return;
            }

            // STOP RULE 2: Target profit goal
            if (totalSessionProfitRef.current >= Number(targetProfit)) {
              addLog(
                `[TARGET REACHED] Target profit goal of $${targetProfit.toFixed(
                  2
                )} achieved! Halting bot.`
              );
              stopBot();
              return;
            }

            // Track loss streak
            if (!isWin) {
              lossStreakRef.current += 1;
            } else {
              lossStreakRef.current = 0;
            }

            // STOP RULE 3: 50 loss safety limit
            if (lossStreakRef.current >= 50) {
              addLog(
                `[CIRCUIT BREAKER] Reached 50 trades without a win. Block complete. Halting bot.`
              );
              stopBot();
              return;
            }

            unlockAndRetry(ws, 1500);
          }
        }
      };

      ws.onerror = () => addLog("WebSocket network connection error.");

      ws.onclose = () => {
        addLog("WebSocket connection closed.");
        clearExecutionTimeout();
        isExecutingRef.current = false;

        if (isTradingRef.current) {
          addLog("Re-establishing connection in 3 seconds...");
          setTimeout(() => {
            if (isTradingRef.current) {
              startBot();
            }
          }, 3000);
        }
      };
    } catch (err) {
      addLog(`Initialization Error: ${err.message}`);
      isTradingRef.current = false;
      isExecutingRef.current = false;
      clearExecutionTimeout();
      setBot2State((prev) => ({ ...prev, isTrading: false }));
    }
  };

  const stopBot = () => {
    isTradingRef.current = false;
    isExecutingRef.current = false;
    clearExecutionTimeout();

    if (wsRef2.current) {
      wsRef2.current.close();
    }
    setBot2State((prev) => ({ ...prev, isTrading: false }));
    addLog("Aegis Matrix Engine stopped.");
  };

  const nextStakeVal = engineRef2.current.getNextStake(Number(minStake));

  return (
    <div className="bots-container">
      <div className="bots-page-header">
        <h1>Trading Control Center</h1>
        <p className="page-description">
          Aegis Matrix Engine • Metrics-Driven Bias Optimization and Risk Management System.
        </p>
      </div>

      <div className="bots-workspace">
        {/* Sidebar / Top Bot Navigation */}
        <aside className="bots-sidebar">
          <div className="sidebar-title">Automated Bot Suite</div>
          <nav className="bot-menu-list">
            {BOT_SUITE.map((bot) => (
              <button
                key={bot.id}
                className={`bot-menu-item ${
                  activeBotTab === bot.id ? "active" : ""
                } ${!bot.isAccessible ? "locked" : ""}`}
                onClick={() => {
                  if (bot.isAccessible) {
                    setActiveBotTab(bot.id);
                  }
                }}
              >
                <div className="menu-item-info">
                  <span className="bot-name">{bot.name}</span>
                  {!bot.isAccessible && (
                    <span className="lock-icon">🔒</span>
                  )}
                </div>
                <span className={`menu-badge ${bot.isAccessible ? "badge-active" : "badge-locked"}`}>
                  {bot.badge}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Bot Execution Console */}
        <main className="bot-main-content">
          <div
            className={`bot-card premium-card ${
              bot2State.isTrading ? "active-trading" : ""
            }`}
          >
            <div className="bot-header">
              <div className="bot-title-group">
                <div className="title-with-badge">
                  <h2>Aegis Matrix Engine</h2>
                  <span className="premium-badge">PREMIUM</span>
                </div>
                <span className="bot-subtitle">
                  Back-Analysis Endpoint Integration • 2-Min Expiration • Anti-Market Bias
                </span>
              </div>
              <span className="account-tag">{accountType.toUpperCase()}</span>
            </div>

            <div className="bot-explanation">
              <p>
                Enable <strong>Auto Market Selection</strong> and set your base stake. Target profit will automatically set itself based on your stake size.
              </p>
              <ul className="usage-list">
                <li>
                  <strong>Execution Note:</strong> Simply start the bot. The bot will run automatically and stop when the trading block ends.
                </li>
                <li>
                  <strong>Connection Requirement:</strong> Please ensure you maintain a stable Wi-Fi connection throughout execution.
                </li>
              </ul>
            </div>

            <div className="config-grid">
              <div className="form-field">
                <label>Market Selection Mode</label>
                <select
                  value={autoMarketSelect ? "auto" : "manual"}
                  onChange={(e) => setAutoMarketSelect(e.target.value === "auto")}
                  disabled={bot2State.isTrading}
                >
                  <option value="auto">Auto Market Selection (Random Volatility Index)</option>
                  <option value="manual">Manual Market Lock</option>
                </select>
              </div>

              <div className="form-field">
                <label>Active Market Index</label>
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  disabled={bot2State.isTrading || autoMarketSelect}
                >
                  {VOLATILITY_MARKETS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Contract Direction</label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  disabled={bot2State.isTrading}
                >
                  <option value="PUT">PUT (Fall)</option>
                  <option value="CALL">CALL (Rise)</option>
                </select>
              </div>

              <div className="form-field">
                <label>Contract Duration (Minutes, Min: 2m)</label>
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={durationMinutes}
                  onChange={handleDurationChange}
                  disabled={bot2State.isTrading}
                />
              </div>

              <div className="form-field">
                <label>Base Stake ($ Min: 1.00)</label>
                <input
                  type="number"
                  step="0.50"
                  min="1.00"
                  value={minStake}
                  onChange={handleStakeChange}
                  disabled={bot2State.isTrading}
                />
              </div>
            </div>

            <div className="metrics-ribbon">
              <div className="metric-item">
                <span className="metric-label">Engine Status</span>
                <span
                  className={`metric-value ${
                    bot2State.isTrading ? "status-on" : "status-off"
                  }`}
                >
                  {bot2State.isTrading ? "ONLINE" : "OFF"}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Next Stake</span>
                <span className="metric-value">${nextStakeVal.toFixed(2)}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Target Profit</span>
                <span className="metric-value">${targetProfit.toFixed(2)}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Banked Wins</span>
                <span className="metric-value highlight-win">
                  {bankedWinsCount} / {totalSettledCount}
                </span>
              </div>
            </div>

            <div className="controls">
              {!bot2State.isTrading ? (
                <button onClick={startBot} className="start-btn premium-btn">
                  Start Aegis Engine
                </button>
              ) : (
                <button onClick={stopBot} className="stop-btn">
                  Stop Aegis Engine
                </button>
              )}
            </div>

            <div className="console-wrapper">
              <div className="console-title">Engine Terminal Output</div>
              <pre className="logs-console">
                {bot2State.logs.join("\n") ||
                  "Aegis Engine standing by. Ready to launch trading session..."}
              </pre>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}