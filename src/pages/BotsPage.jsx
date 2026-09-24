import React, { useState, useRef } from "react";
import { useTrading } from "../context/TradingContext";
import "./BotsPage.css";

const API_BASE = "https://api.derivws.com";
const APP_ID = "34sztETpkcwjcAayV9upz";
const CURRENCY = "USD";

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

  const [symbol, setSymbol] = useState("R_100");
  const [duration, setDuration] = useState(2);
  const [durationUnit, setDurationUnit] = useState("m");
  const [minStake, setMinStake] = useState(1.0);
  const [targetProfit, setTargetProfit] = useState(45.0);

  const requestIdRef = useRef(200);
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
      logs: [...prev.logs.slice(-99), `[Bot 2 | ${time}] ${msg}`],
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
    if (reason) addLog(`Resetting execution state: ${reason}`);
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

  // Synchronize base stake and target profit ratio ($1 stake -> $45 profit)
  const handleStakeChange = (e) => {
    const val = Math.max(1.0, parseFloat(e.target.value) || 1.0);
    setMinStake(val);
    setTargetProfit(val * 45.0);
  };

  const handleDurationChange = (e) => {
    const val = parseInt(e.target.value, 10) || 2;
    if (durationUnit === "m") {
      setDuration(Math.max(2, val));
    } else {
      setDuration(Math.max(120, val));
    }
  };

  const handleUnitChange = (e) => {
    const unit = e.target.value;
    setDurationUnit(unit);
    if (unit === "m" && duration < 2) {
      setDuration(2);
    } else if (unit === "s" && duration < 120) {
      setDuration(120);
    }
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

    const durationInMs =
      durationUnit === "m"
        ? Number(duration) * 60 * 1000
        : Number(duration) * 1000;

    clearExecutionTimeout();
    executionTimeoutRef.current = setTimeout(() => {
      unlockAndRetry(
        ws,
        1000,
        "Safety timeout reached (no settlement received)."
      );
    }, durationInMs + 15000);

    ws.send(
      JSON.stringify({
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type: "PUT",
        currency: CURRENCY,
        duration: Number(duration),
        duration_unit: durationUnit,
        underlying_symbol: symbol,
        req_id: ++requestIdRef.current,
      })
    );
    addLog(
      `Requested ${symbol} Fall (${duration}${durationUnit}) @ $${stake.toFixed(
        2
      )}`
    );
  };

  const startBot = async () => {
    if (!isConnected || !patToken) {
      return alert("Please connect your PAT on the Dashboard first.");
    }

    // Input validations
    if (Number(minStake) < 1.0) {
      return alert("Minimum base stake must be at least $1.00.");
    }
    if (durationUnit === "m" && Number(duration) < 2) {
      return alert("Minimum duration is 2 minutes.");
    }
    if (durationUnit === "s" && Number(duration) < 120) {
      return alert("Minimum duration is 120 seconds (2 minutes).");
    }

    isTradingRef.current = true;
    isExecutingRef.current = false;
    lossStreakRef.current = 0;
    totalSessionProfitRef.current = 0;
    setBot2State((prev) => ({ ...prev, isTrading: true, logs: [] }));
    settledIdsRef.current.clear();
    engineRef2.current.MIN_STAKE = Number(minStake);

    try {
      addLog(`Fetching ${accountType.toUpperCase()} Options account...`);
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
        throw new Error(
          accData?.error?.message || "Failed to fetch accounts."
        );
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

      addLog("Requesting secure WebSocket OTP URL via REST...");
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
        throw new Error(otpData?.error?.message || "OTP request failed.");
      }

      const wsUrl = otpData?.data?.url;
      if (!wsUrl) {
        throw new Error("Deriv did not return a valid WebSocket OTP URL.");
      }

      addLog("Connecting to secure Deriv WebSocket...");
      const ws = new WebSocket(wsUrl);
      wsRef2.current = ws;

      ws.onopen = () => {
        addLog("WebSocket connected successfully. Executing immediately...");
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
          addLog(`API Error: ${data.error.message}`);
          unlockAndRetry(ws, 3000, "API returned error");
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
            unlockAndRetry(ws, 2000, "Empty proposal response");
          }
        }

        if (data.msg_type === "buy") {
          const contractId = data.buy.contract_id;
          addLog(`Bought FALL contract #${contractId}`);
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

            setBot2State((prev) => ({
              ...prev,
              history: [...prev.history, { bot: "Bot 2", ...row }],
            }));

            addLog(
              `Trade Settled: [${
                row.outcome
              }] P/L: $${row.profitLoss.toFixed(
                2
              )} | Session Total: $${totalSessionProfitRef.current.toFixed(2)}`
            );

            // STOP CONDITION 1: Win when stake was above $7.00
            if (isWin && activeStakeRef.current > 7.0) {
              addLog(
                `[TARGET REACHED] Stake was $${activeStakeRef.current.toFixed(
                  2
                )} (> $7.00) and won. Stopping bot.`
              );
              stopBot();
              return;
            }

            // STOP CONDITION 2: Target profit reached
            if (totalSessionProfitRef.current >= Number(targetProfit)) {
              addLog(
                `[TARGET REACHED] Target profit of $${targetProfit} achieved! Stopping bot.`
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

            // STOP CONDITION 3: 50 consecutive losses reached without a win
            if (lossStreakRef.current >= 50) {
              addLog(
                `[SAFETY STOP] Reached 50 consecutive losses without a win. Stopping bot.`
              );
              stopBot();
              return;
            }

            // Continue trading loop
            unlockAndRetry(ws, 1500);
          }
        }
      };

      ws.onerror = () => addLog("WebSocket connection error encountered.");

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
      addLog(`Setup Error: ${err.message}`);
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
    addLog("Bot 2 stopped.");
  };

  const nextStakeVal = engineRef2.current.getNextStake(Number(minStake));

  return (
    <div className="bots-container">
      <div className="bots-page-header">
        <h1>Trading Bot Control Center</h1>
        <p className="page-description">
          Automated Fall Advanced Engine operating with automated risk cap controls.
        </p>
      </div>

      <div
        className={`bot-card premium-card ${
          bot2State.isTrading ? "active-trading" : ""
        }`}
      >
        <div className="bot-header">
          <div className="bot-title-group">
            <div className="title-with-badge">
              <h2>Fall Advanced Engine</h2>
              <span className="premium-badge">PREMIUM</span>
            </div>
            <span className="bot-subtitle">2-Min High Yield • Bearish PUT Bias</span>
          </div>
          <span className="account-tag">{accountType.toUpperCase()}</span>
        </div>

        <div className="bot-explanation">
          <p>
            <strong>Overview:</strong> Executes automated <code>PUT</code> options.
          </p>
          <ul className="usage-list">
            <li><strong>Cap Rule:</strong> Stops automatically on WIN when stake exceeds $7.00.</li>
            <li><strong>Loss Ceiling:</strong> Stops if 50 trades pass without a win.</li>
            <li><strong>Target Profit:</strong> Stops upon reaching target profit.</li>
          </ul>
        </div>

        <div className="config-grid">
          <div className="form-field">
            <label>Target Market</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={bot2State.isTrading}
            >
              <option value="R_100">Volatility 100 Index</option>
              <option value="R_50">Volatility 50 Index</option>
            </select>
          </div>

          <div className="form-field">
            <label>Duration Value (Min: 2m)</label>
            <input
              type="number"
              min={durationUnit === "m" ? 2 : 120}
              value={duration}
              onChange={handleDurationChange}
              disabled={bot2State.isTrading}
            />
          </div>

          <div className="form-field">
            <label>Duration Unit</label>
            <select
              value={durationUnit}
              onChange={handleUnitChange}
              disabled={bot2State.isTrading}
            >
              <option value="m">Minutes</option>
              <option value="s">Seconds</option>
            </select>
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

          <div className="form-field">
            <label>Target Profit ($)</label>
            <input
              type="number"
              step="1.00"
              value={targetProfit}
              onChange={(e) => setTargetProfit(parseFloat(e.target.value) || 0)}
              disabled={bot2State.isTrading}
            />
          </div>
        </div>

        <div className="metrics-ribbon">
          <div className="metric-item">
            <span className="metric-label">Next Stake</span>
            <span className="metric-value">${nextStakeVal.toFixed(2)}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Target Profit</span>
            <span className="metric-value">${targetProfit.toFixed(2)}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Loss Streak</span>
            <span className="metric-value">{lossStreakRef.current} / 50</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Active Contract</span>
            <span className="metric-value">
              {bot2State.contract?.contractId
                ? `#${bot2State.contract.contractId}`
                : "None"}
            </span>
          </div>
        </div>

        <div className="controls">
          {!bot2State.isTrading ? (
            <button onClick={startBot} className="start-btn premium-btn">
              Start Bot 2 (2-Min Engine)
            </button>
          ) : (
            <button onClick={stopBot} className="stop-btn">
              Stop Bot 2
            </button>
          )}
        </div>

        <div className="console-wrapper">
          <div className="console-title">Live Execution Logs</div>
          <pre className="logs-console">
            {bot2State.logs.join("\n") ||
              "Bot 2 idle. Ready to start trading session..."}
          </pre>
        </div>
      </div>
    </div>
  );
}