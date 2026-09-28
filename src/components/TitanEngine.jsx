import React, { useState, useEffect, useRef } from "react";
import { useTrading } from "../context/TradingContext";
import "./TitanEngine.css";

const API_BASE = "https://api.derivws.com";
const APP_ID = "34sztETpkcwjcAayV9upz";
const CURRENCY = "USD";
const STORAGE_KEY = "titan_engine_session_v1";

const VOLATILITY_MARKETS = [
  { id: "R_10", label: "Volatility 10 Index" },
  { id: "R_25", label: "Volatility 25 Index" },
  { id: "R_50", label: "Volatility 50 Index" },
  { id: "R_75", label: "Volatility 75 Index" },
  { id: "R_100", label: "Volatility 100 Index" },
];

export default function TitanEngine({ disabled = false }) {
  const {
    patToken,
    isConnected,
    accountType,
    bot4State,
    setBot4State,
    wsRef4,
    engineRef4,
  } = useTrading();

  // Base Stake (Default: $1.00)
  const [minStake, setMinStake] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).minStake || 1.0 : 1.0;
  });

  // Profit Ratio (Range: 0.25 to 0.75, Default: 0.25)
  const [profitRatio, setProfitRatio] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).profitRatio || 0.25 : 0.25;
  });

  // UI Counters directly from local storage if available
  const [bankedWinsCount, setBankedWinsCount] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).bankedWinsCount || 0 : 0;
  });

  const [totalSettledCount, setTotalSettledCount] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).totalSettledCount || 0 : 0;
  });

  const [hasSavedSession, setHasSavedSession] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    const data = JSON.parse(saved);
    return (data.totalSettledCount || 0) > 0 || (data.bankedWinsCount || 0) > 0;
  });

  const requestIdRef = useRef(400);
  const isExecutingRef = useRef(false);
  const activeStakeRef = useRef(1.0);
  const settledIdsRef = useRef(new Set());
  const isTradingRef = useRef(false);
  const executionTimeoutRef = useRef(null);
  const lossStreakRef = useRef(0);
  const totalSessionProfitRef = useRef(0);

  // Titan Rule 1: Starts at PUT; Stays on Win, Switches on Loss
  const nextContractTypeRef = useRef("PUT");

  // Titan Rule 2: Switch to a different market on EVERY trade
  const activeSymbolRef = useRef(null);

  // Selects a new market index, ensuring it strictly differs from the previous market
  const selectNextMarket = () => {
    const currentSymbol = activeSymbolRef.current;
    const available = VOLATILITY_MARKETS.filter((m) => m.id !== currentSymbol);
    const randomIndex = Math.floor(Math.random() * available.length);
    const selected = available[randomIndex].id;
    activeSymbolRef.current = selected;
    return selected;
  };

  // Restore session data and engine internal state on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.settledIds)) {
          settledIdsRef.current = new Set(parsed.settledIds);
        }
        lossStreakRef.current = parsed.lossStreak || 0;
        totalSessionProfitRef.current = parsed.totalSessionProfit || 0;
        if (parsed.activeSymbol) {
          activeSymbolRef.current = parsed.activeSymbol;
        }
        if (parsed.nextContractType) {
          nextContractTypeRef.current = parsed.nextContractType;
        }

        if (parsed.engineState && engineRef4?.current?.restoreState) {
          engineRef4.current.restoreState(parsed.engineState);
        }
      } catch (err) {
        console.error("Failed to restore Titan Engine session from storage:", err);
      }
    }
  }, [engineRef4]);

  // Calculated target values
  const unitProfit = Number(minStake) * Number(profitRatio);
  const blockTargetProfit = 25 * unitProfit;

  const saveSessionToStorage = (updatedWins, updatedSettled, updatedProfit) => {
    const payload = {
      minStake: Number(minStake),
      profitRatio: Number(profitRatio),
      bankedWinsCount: updatedWins,
      totalSettledCount: updatedSettled,
      settledIds: Array.from(settledIdsRef.current),
      lossStreak: lossStreakRef.current,
      totalSessionProfit: updatedProfit,
      activeSymbol: activeSymbolRef.current,
      nextContractType: nextContractTypeRef.current,
      engineState: engineRef4?.current?.exportState
        ? engineRef4.current.exportState()
        : null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setHasSavedSession(updatedSettled > 0 || updatedWins > 0);
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setBot4State((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-99), `[Titan Engine | ${time}] ${msg}`],
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

  const handleStakeChange = (e) => {
    const val = Math.max(1.0, parseFloat(e.target.value) || 1.0);
    setMinStake(val);
  };

  const handleRatioChange = (e) => {
    let val = parseFloat(e.target.value) || 0.25;
    if (val < 0.25) val = 0.25;
    if (val > 0.75) val = 0.75;
    setProfitRatio(val);
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

    // Ensure engine parameters match dynamic settings
    if (engineRef4?.current) {
      engineRef4.current.MIN_STAKE = Number(minStake);
      engineRef4.current.UNIT_TARGET_PROFIT = unitProfit;
    }

    // Safely calculate dynamic next stake with floating precision clamping
    const rawStake = engineRef4?.current?.getNextStake
      ? engineRef4.current.getNextStake(Number(minStake))
      : Number(minStake);

    // Enforce 2 decimal place precision limit to prevent Deriv InvalidAmount errors
    const stake = Number(Math.max(1.0, rawStake).toFixed(2));

    activeStakeRef.current = stake;
    const durationInMs = 2 * 60 * 1000;

    clearExecutionTimeout();
    executionTimeoutRef.current = setTimeout(() => {
      unlockAndRetry(
        ws,
        1000,
        "Execution safety timeout reached (no settlement received)."
      );
    }, durationInMs + 15000);

    // Ensure an active market is selected
    if (!activeSymbolRef.current) {
      selectNextMarket();
    }

    const currentSymbol = activeSymbolRef.current;
    const contractType = nextContractTypeRef.current;

    try {
      ws.send(
        JSON.stringify({
          proposal: 1,
          amount: stake,
          basis: "stake",
          contract_type: contractType,
          currency: CURRENCY,
          duration: 2,
          duration_unit: "m",
          underlying_symbol: currentSymbol,
          req_id: ++requestIdRef.current,
        })
      );
      addLog(
        `Submitted Order: ${currentSymbol} ${contractType} (2m) @ $${stake.toFixed(2)}`
      );
    } catch (err) {
      addLog(`Failed to send proposal frame: ${err.message}`);
      unlockAndRetry(ws, 2000, "Send error");
    }
  };

  const resetSessionData = () => {
    lossStreakRef.current = 0;
    totalSessionProfitRef.current = 0;
    activeSymbolRef.current = null;
    nextContractTypeRef.current = "PUT";
    setBankedWinsCount(0);
    setTotalSettledCount(0);
    settledIdsRef.current.clear();
    localStorage.removeItem(STORAGE_KEY);
    setHasSavedSession(false);

    setBot4State((prev) => ({ ...prev, logs: [], history: [], contract: null }));
    if (engineRef4?.current?.reset) {
      engineRef4.current.reset();
    }
  };

  const handleStartNewCycle = () => {
    if (!isConnected || !patToken) {
      return alert("Please connect your PAT on the Dashboard first.");
    }
    if (Number(minStake) < 1.0) {
      return alert("Minimum base stake must be at least $1.00.");
    }

    resetSessionData();
    const initialMarket = selectNextMarket();
    addLog(`Session reset. Initial Market Selected: ${initialMarket}`);
    executeStart();
  };

  const handleResumeTrades = () => {
    if (!isConnected || !patToken) {
      return alert("Please connect your PAT on the Dashboard first.");
    }
    if (Number(minStake) < 1.0) {
      return alert("Minimum base stake must be at least $1.00.");
    }

    if (!activeSymbolRef.current) {
      selectNextMarket();
    }

    addLog(
      `Resuming session on ${activeSymbolRef.current} (${bankedWinsCount} wins banked, Next Direction: ${nextContractTypeRef.current})...`
    );
    executeStart();
  };

  const stopBot = () => {
    isTradingRef.current = false;
    isExecutingRef.current = false;

    clearExecutionTimeout();

    if (wsRef4.current) {
      wsRef4.current.onclose = null;
      wsRef4.current.onerror = null;
      wsRef4.current.onmessage = null;
      wsRef4.current.onopen = null;
      wsRef4.current.close();
      wsRef4.current = null;
    }

    setBot4State((prev) => ({ ...prev, isTrading: false }));
    addLog("Titan Engine stopped permanently.");
  };

  const autoRestartFreshBlock = (reasonMsg) => {
    isTradingRef.current = true;
    addLog(`${reasonMsg} Restarting fresh block in 3 seconds...`);

    clearExecutionTimeout();
    if (wsRef4.current) {
      wsRef4.current.onclose = null;
      wsRef4.current.onerror = null;
      wsRef4.current.onmessage = null;
      wsRef4.current.onopen = null;
      wsRef4.current.close();
      wsRef4.current = null;
    }

    setTimeout(() => {
      if (!isTradingRef.current) {
        addLog("Auto-restart cancelled by user stop action.");
        return;
      }

      resetSessionData();
      const freshMarket = selectNextMarket();
      addLog(`Initializing fresh block automatically starting on ${freshMarket}...`);
      executeStart();
    }, 3000);
  };

  const executeStart = async () => {
    // Guard against duplicate concurrent startup calls
    if (
      isExecutingRef.current ||
      (wsRef4.current && wsRef4.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    isTradingRef.current = true;
    isExecutingRef.current = true;
    setBot4State((prev) => ({ ...prev, isTrading: true }));

    // Safely unbind and close pre-existing WebSockets before initializing a new one
    if (wsRef4.current) {
      wsRef4.current.onclose = null;
      wsRef4.current.onerror = null;
      wsRef4.current.onmessage = null;
      wsRef4.current.onopen = null;
      wsRef4.current.close();
      wsRef4.current = null;
    }

    if (engineRef4?.current) {
      engineRef4.current.MIN_STAKE = Number(minStake);
      engineRef4.current.UNIT_TARGET_PROFIT = unitProfit;
    }

    try {
      addLog(`Connecting to ${accountType.toUpperCase()} Options Account...`);
      const accResponse = await fetch(`${API_BASE}/trading/v1/options/accounts`, {
        headers: {
          Authorization: `Bearer ${patToken}`,
          "Deriv-App-ID": APP_ID,
        },
      });
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
        throw new Error(
          otpData?.error?.message || "OTP session authorization failed."
        );
      }

      const wsUrl = otpData?.data?.url;
      if (!wsUrl) {
        throw new Error(
          "Deriv REST API did not return a valid WebSocket endpoint."
        );
      }

      addLog("Establishing secure WebSocket connection...");
      const ws = new WebSocket(wsUrl);
      wsRef4.current = ws;

      ws.onopen = () => {
        // Clear orphaned execution locks on fresh connection start
        isExecutingRef.current = false;

        addLog(
          `Engine active | Multi-Market Switching Active | Direction: Win-Stay / Loss-Switch (Initial: PUT) | Base Stake: $${Number(minStake).toFixed(2)} | Target Profit/Win: $${unitProfit.toFixed(2)} (${(profitRatio * 100).toFixed(1)}%).`
        );

        // Query open contracts first on reconnect to avoid purchasing duplicates
        ws.send(
          JSON.stringify({
            portfolio: 1,
            req_id: ++requestIdRef.current,
          })
        );
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

        // Handle portfolio check for existing unexpired trades
        if (data.msg_type === "portfolio") {
          const openContracts = data.portfolio?.contracts || [];
          const activeContract = openContracts.find(
            (c) =>
              c.symbol === activeSymbolRef.current &&
              !settledIdsRef.current.has(c.contract_id)
          );

          if (activeContract) {
            addLog(`Re-subscribed to running contract #${activeContract.contract_id}`);
            ws.send(
              JSON.stringify({
                proposal_open_contract: 1,
                contract_id: activeContract.contract_id,
                subscribe: 1,
                req_id: ++requestIdRef.current,
              })
            );
          } else {
            // Safe to release execution lock and request standard proposal
            isExecutingRef.current = false;
            sendProposal(ws);
          }
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
          addLog(
            `Position Opened: Contract #${contractId} [${activeSymbolRef.current} ${nextContractTypeRef.current}]`
          );
          setBot4State((prev) => ({
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
          setBot4State((prev) => ({
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

            const row = engineRef4?.current?.processOutcome
              ? engineRef4.current.processOutcome(
                  profit,
                  activeStakeRef.current,
                  Number(minStake)
                )
              : { outcome: profit > 0 ? "W" : "L", profitLoss: profit, blockWins: bankedWinsCount };

            const isWin =
              profit > 0 || poc.status === "won" || row.outcome === "W";
            totalSessionProfitRef.current += Number(row.profitLoss || 0);

            const tradedSymbol = activeSymbolRef.current;
            const currentType = nextContractTypeRef.current;

            // TITAN RULE 1 (Direction Logic):
            // Win -> Keep current contract type
            // Loss -> Switch contract type (PUT -> CALL or CALL -> PUT)
            if (isWin) {
              nextContractTypeRef.current = currentType;
            } else {
              nextContractTypeRef.current = currentType === "PUT" ? "CALL" : "PUT";
            }

            // TITAN RULE 2 (Market Switching Logic):
            // Switch to a new random market out of the 5 Volatility Indices
            const nextSymbol = selectNextMarket();

            const updatedWinsCount = row.blockWins;
            const updatedSettledCount = settledIdsRef.current.size;

            setBankedWinsCount(updatedWinsCount);
            setTotalSettledCount(updatedSettledCount);

            saveSessionToStorage(
              updatedWinsCount,
              updatedSettledCount,
              totalSessionProfitRef.current
            );

            setBot4State((prev) => ({
              ...prev,
              history: [...prev.history, { bot: "Titan Engine", ...row }],
            }));

            addLog(
              `Trade ${updatedSettledCount}/50 [${tradedSymbol} | ${currentType} ${
                isWin ? "WIN" : "LOST"
              }] P/L: $${Number(row.profitLoss || 0).toFixed(
                2
              )} | Next Market: ${nextSymbol} | Next Dir: ${nextContractTypeRef.current} | Balance: $${(
                engineRef4?.current?.cycleRunningBalance || 0
              ).toFixed(2)} | Session Acc: $${totalSessionProfitRef.current.toFixed(2)}`
            );

            // Explicit hard drawdown check using direct session tracking ref
            const maxDrawdownLimit = -1 * Number(minStake) * 50;
            if (totalSessionProfitRef.current < maxDrawdownLimit) {
              addLog(
                `[SAFETY TRIGGERED] Session loss ($${totalSessionProfitRef.current.toFixed(
                  2
                )}) reached drawdown limit ($${maxDrawdownLimit.toFixed(
                  2
                )}). Stopping engine!`
              );
              stopBot();
              return;
            }

            // RULE: STAKE > $7.00 AND IS WIN
            if (isWin && activeStakeRef.current > 7.0) {
              autoRestartFreshBlock(
                `[CAP TRIGGERED] Win achieved at stake $${activeStakeRef.current.toFixed(
                  2
                )} (> $7.00). Block complete.`
              );
              return;
            }

            // RULE: WINS > 15 AND RECOVERY TARGET ACHIEVED
            const totalLosses = engineRef4?.current?.totalLosses || 0;
            const ratio = engineRef4?.current?.RATIO || 1.5;
            const stakingModifier = engineRef4?.current?.stakingModifier || 0;
            const rawExpected = totalLosses > 0 ? totalLosses / ratio : 1.0;
            const expectedWinsRequired = Math.ceil(rawExpected) + stakingModifier;

            if (
              updatedWinsCount >= 15 &&
              updatedWinsCount >= expectedWinsRequired
            ) {
              autoRestartFreshBlock(
                `[EARLY EXIT TRIGGERED] Achieved ${updatedWinsCount} wins (>15) meeting recovery threshold (${expectedWinsRequired} required). Block complete.`
              );
              return;
            }

            // RULE: STANDARD TARGET OR 25 BANKED WINS REACHED
            if (
              updatedWinsCount >= 25 ||
              totalSessionProfitRef.current >= blockTargetProfit
            ) {
              autoRestartFreshBlock(
                `[TARGET REACHED] Achieved ${updatedWinsCount} banked wins ($${totalSessionProfitRef.current.toFixed(
                  2
                )} net profit). Block complete.`
              );
              return;
            }

            if (!isWin) {
              lossStreakRef.current += 1;
            } else {
              lossStreakRef.current = 0;
            }

            // RULE: MAXIMUM BLOCK ROW CAP REACHED (50 TRADES)
            if (updatedSettledCount >= 50) {
              autoRestartFreshBlock(
                `[BLOCK COMPLETE] Reached 50 trades max block limit.`
              );
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

        if (!isTradingRef.current) {
          return;
        }

        addLog("Connection interrupted. Re-establishing in 3 seconds...");
        setTimeout(() => {
          if (isTradingRef.current) {
            executeStart();
          }
        }, 3000);
      };
    } catch (err) {
      addLog(`Initialization Error: ${err.message}`);
      clearExecutionTimeout();
      isExecutingRef.current = false;

      if (isTradingRef.current) {
        addLog("Retrying connection in 5 seconds...");
        setTimeout(() => {
          if (isTradingRef.current) {
            executeStart();
          }
        }, 5000);
      } else {
        setBot4State((prev) => ({ ...prev, isTrading: false }));
      }
    }
  };

  const nextStakeVal = engineRef4?.current?.getNextStake
    ? engineRef4.current.getNextStake(Number(minStake))
    : Number(minStake);

  const activeMarketLabel =
    VOLATILITY_MARKETS.find((m) => m.id === activeSymbolRef.current)?.label ||
    activeSymbolRef.current ||
    "Pending Selection";

  return (
    <div
      className={`bot-card premium-card titan-theme ${
        bot4State.isTrading ? "active-trading" : ""
      }`}
    >
      <div className="bot-header">
        <div className="bot-title-group">
          <div className="title-with-badge">
            <h2>Titan Engine</h2>
            <span className="premium-badge titan-badge">MULTI-MARKET SWITCH</span>
          </div>
          <span className="bot-subtitle">
            Dynamic Market Hopping • Smart Win-Stay / Loss-Switch Direction Logic
          </span>
        </div>
        <span className="account-tag">{accountType.toUpperCase()}</span>
      </div>

      <div className="bot-explanation">
        <p className="notice-highlight">
          🔄 Dynamic Market: <strong>{activeMarketLabel}</strong> | Next Direction:{" "}
          <strong>{nextContractTypeRef.current}</strong> (Switches market after every trade).
        </p>
        {profitRatio > 0.35 && (
          <p className="risk-warning-banner" style={{ color: "#ff9800", fontWeight: "bold" }}>
            💡 High Target Profit Ratio ({(profitRatio * 100).toFixed(1)}%): Ensure your account balance supports higher stake progression during recovery phases.
          </p>
        )}
      </div>

      <div className="config-grid dual-field">
        <div className="form-field">
          <label>Base Stake ($ Min: 1.00)</label>
          <input
            type="number"
            step="0.50"
            min="1.00"
            value={minStake}
            onChange={handleStakeChange}
            disabled={bot4State.isTrading || disabled}
          />
        </div>

        <div className="form-field">
          <label>Profit Ratio ({(profitRatio * 100).toFixed(1)}% of Stake)</label>
          <input
            type="number"
            step="0.05"
            min="0.25"
            max="0.75"
            value={profitRatio}
            onChange={handleRatioChange}
            disabled={bot4State.isTrading || disabled}
          />
        </div>
      </div>

      <div className="metrics-ribbon">
        <div className="metric-item">
          <span className="metric-label">Next Market</span>
          <span className="metric-value">{activeMarketLabel}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Next Direction</span>
          <span className="metric-value highlight-direction">
            {nextContractTypeRef.current}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Next Stake</span>
          <span className="metric-value">${nextStakeVal.toFixed(2)}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Target Profit / Win</span>
          <span className="metric-value">${unitProfit.toFixed(2)}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Banked Wins</span>
          <span className="metric-value highlight-win">
            {bankedWinsCount} / {totalSettledCount}
          </span>
        </div>
      </div>

      <div className="controls">
        {!bot4State.isTrading ? (
          hasSavedSession ? (
            <div className="dual-controls">
              <button
                onClick={handleResumeTrades}
                className="start-btn premium-btn resume-btn"
                disabled={disabled}
              >
                Resume Trades ({bankedWinsCount} Wins)
              </button>
              <button
                onClick={handleStartNewCycle}
                className="start-btn new-cycle-btn"
                disabled={disabled}
              >
                Start New Cycle (From 0)
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartNewCycle}
              className="start-btn premium-btn titan-btn"
              disabled={disabled}
            >
              Start Titan Engine
            </button>
          )
        ) : (
          <button onClick={stopBot} className="stop-btn">
            Stop Titan Engine
          </button>
        )}
      </div>

      <div className="console-wrapper">
        <div className="console-title">Engine Terminal Output</div>
        <pre className="logs-console">
          {bot4State.logs.join("\n") ||
            "Titan Engine standing by. Ready to launch trading session..."}
        </pre>
      </div>
    </div>
  );
}