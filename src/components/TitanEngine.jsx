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

const CONTRACT_TYPES = [
  { id: "PUT", label: "Fall (PUT)" },
  { id: "CALL", label: "Rise (CALL)" },
  { id: "DIGITEVEN", label: "Digit Even" },
  { id: "DIGITODD", label: "Digit Odd" },
];

const DURATION_UNITS = [
  { id: "t", label: "Ticks", min: 1, max: 10 },
  { id: "s", label: "Seconds", min: 15, max: 86400 },
  { id: "m", label: "Minutes", min: 1, max: 1440 },
  { id: "h", label: "Hours", min: 1, max: 24 },
  { id: "d", label: "Days", min: 1, max: 365 },
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

  // Profit Ratio (Range: 0.25 to 0.75, Default: 0.45)
  const [profitRatio, setProfitRatio] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).profitRatio || 0.45 : 0.45;
  });

  // Contract Duration Settings
  const [durationValue, setDurationValue] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).durationValue || 2 : 2;
  });

  const [durationUnit, setDurationUnit] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).durationUnit || "m" : "m";
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

  // Dynamic Market and Contract Type Rotation Indexes
  const marketIndexRef = useRef(0);
  const contractIndexRef = useRef(0);

  // Active Symbol & Contract Type calculation helpers
  const getCurrentMarket = () => VOLATILITY_MARKETS[marketIndexRef.current].id;
  const getCurrentContractType = () => CONTRACT_TYPES[contractIndexRef.current].id;

  // Rotate both market and contract type to next item in sequence
  const rotateMarketAndContract = () => {
    const prevMarket = getCurrentMarket();
    const prevContract = getCurrentContractType();

    marketIndexRef.current = (marketIndexRef.current + 1) % VOLATILITY_MARKETS.length;
    contractIndexRef.current = (contractIndexRef.current + 1) % CONTRACT_TYPES.length;

    addLog(
      `🔄 ROTATION TRIGGERED: Market [${prevMarket} ➔ ${getCurrentMarket()}] | Contract [${prevContract} ➔ ${getCurrentContractType()}]`
    );
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
        
        if (typeof parsed.marketIndex === "number") {
          marketIndexRef.current = parsed.marketIndex;
        }
        if (typeof parsed.contractIndex === "number") {
          contractIndexRef.current = parsed.contractIndex;
        }

        if (parsed.engineState && engineRef4?.current?.restoreState) {
          engineRef4.current.restoreState(parsed.engineState);
        }
      } catch (err) {
        console.error("Failed to restore Titan session from storage:", err);
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
      durationValue: Number(durationValue),
      durationUnit,
      bankedWinsCount: updatedWins,
      totalSettledCount: updatedSettled,
      settledIds: Array.from(settledIdsRef.current),
      lossStreak: lossStreakRef.current,
      totalSessionProfit: updatedProfit,
      marketIndex: marketIndexRef.current,
      contractIndex: contractIndexRef.current,
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
      logs: [...(prev?.logs || []).slice(-99), `[TITAN-BOT | ${time}] ${msg}`],
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
    if (reason) addLog(`⚙️ RECOVERY EVENT: ${reason}`);
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
    let val = parseFloat(e.target.value) || 0.45;
    if (val < 0.25) val = 0.25;
    if (val > 0.75) val = 0.75;
    setProfitRatio(val);
  };

  const handleDurationUnitChange = (e) => {
    const unit = e.target.value;
    setDurationUnit(unit);
    const unitConfig = DURATION_UNITS.find((u) => u.id === unit);
    if (unitConfig) {
      if (durationValue < unitConfig.min) setDurationValue(unitConfig.min);
      if (unitConfig.max && durationValue > unitConfig.max) setDurationValue(unitConfig.max);
    }
  };

  const handleDurationValueChange = (e) => {
    const val = parseInt(e.target.value, 10) || 1;
    const unitConfig = DURATION_UNITS.find((u) => u.id === durationUnit);
    if (unitConfig) {
      if (val < unitConfig.min) return setDurationValue(unitConfig.min);
      if (unitConfig.max && val > unitConfig.max) return setDurationValue(unitConfig.max);
    }
    setDurationValue(val);
  };

  // Convert contract duration into estimated timeout milliseconds
  const getTimeoutDurationMs = () => {
    const val = Number(durationValue);
    switch (durationUnit) {
      case "t":
        return val * 2000;
      case "s":
        return val * 1000;
      case "m":
        return val * 60 * 1000;
      case "h":
        return val * 60 * 60 * 1000;
      case "d":
        return val * 24 * 60 * 60 * 1000;
      default:
        return 120000;
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

    // Synchronize engine variables with active UI parameters
    if (engineRef4?.current) {
      engineRef4.current.MIN_STAKE = Number(minStake);
      engineRef4.current.UNIT_TARGET_PROFIT = unitProfit;
    }

    const rawStake = engineRef4?.current?.getNextStake
      ? engineRef4.current.getNextStake(Number(minStake))
      : Number(minStake);

    const stake = Number(Math.max(1.0, rawStake).toFixed(2));
    activeStakeRef.current = stake;

    const safetyBufferMs = 15000;
    const durationMs = getTimeoutDurationMs();

    clearExecutionTimeout();
    executionTimeoutRef.current = setTimeout(() => {
      unlockAndRetry(
        ws,
        1000,
        "Execution safety timeout elapsed without contract settlement confirmation."
      );
    }, durationMs + safetyBufferMs);

    const activeSymbol = getCurrentMarket();
    const activeContractType = getCurrentContractType();

    try {
      ws.send(
        JSON.stringify({
          proposal: 1,
          amount: stake,
          basis: "stake",
          contract_type: activeContractType,
          currency: CURRENCY,
          duration: Number(durationValue),
          duration_unit: durationUnit,
          underlying_symbol: activeSymbol,
          req_id: ++requestIdRef.current,
        })
      );
      addLog(
        `📈 PROPOSAL REQUEST: Market=${activeSymbol} | Type=${activeContractType} | Duration=${durationValue}${durationUnit} | Calculated Stake=$${stake.toFixed(2)}`
      );
    } catch (err) {
      addLog(`❌ PROPOSAL FAILED: ${err.message}`);
      unlockAndRetry(ws, 2000, "Websocket frame transmission failure.");
    }
  };

  const resetSessionData = () => {
    lossStreakRef.current = 0;
    totalSessionProfitRef.current = 0;
    marketIndexRef.current = 0;
    contractIndexRef.current = 0;
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
    addLog(`🚀 INITIALIZING FRESH TRADE BLOCK: Active Market=${getCurrentMarket()} | Type=${getCurrentContractType()}`);
    executeStart();
  };

  const handleResumeTrades = () => {
    if (!isConnected || !patToken) {
      return alert("Please connect your PAT on the Dashboard first.");
    }
    if (Number(minStake) < 1.0) {
      return alert("Minimum base stake must be at least $1.00.");
    }

    addLog(
      `▶️ RESUMING SESSION: Market=${getCurrentMarket()} | Type=${getCurrentContractType()} | Saved Wins=${bankedWinsCount} | Settled Trades=${totalSettledCount}`
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
    addLog("⏸️ ENGINE PAUSED: Trading system stopped successfully by user action.");
  };

  const autoRestartFreshBlock = (reasonMsg) => {
    isTradingRef.current = true;
    addLog(`🏁 BLOCK COMPLETED: ${reasonMsg}`);
    addLog("🔄 CYCLE RESTART: Initiating fresh block in 3 seconds...");

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
        addLog("⛔ AUTO-RESTART CANCELLED: Engine manually stopped prior to cycle launch.");
        return;
      }

      resetSessionData();
      addLog(`✨ NEW BLOCK ACTIVE: Market reset to ${getCurrentMarket()} | Type reset to ${getCurrentContractType()}`);
      executeStart();
    }, 3000);
  };

  const executeStart = async () => {
    if (
      isExecutingRef.current ||
      (wsRef4.current && wsRef4.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    isTradingRef.current = true;
    isExecutingRef.current = true;
    setBot4State((prev) => ({ ...prev, isTrading: true }));

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
      addLog(`🌐 CONNECTING: Fetching ${accountType.toUpperCase()} Options sub-account metadata...`);
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

      addLog(`🔑 AUTHORIZING: Requesting session OTP token for Account ${targetAccount.account_id}...`);
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

      addLog("⚡ SOCKET CONNECTING: Establishing real-time feed with Deriv API...");
      const ws = new WebSocket(wsUrl);
      wsRef4.current = ws;

      ws.onopen = () => {
        isExecutingRef.current = false;
        addLog(
          `✅ CONNECTED: Market=${getCurrentMarket()} | Type=${getCurrentContractType()} | Base Stake=$${Number(minStake).toFixed(2)} | Target/Win=$${unitProfit.toFixed(2)} (${(profitRatio * 100).toFixed(1)}%) | Duration=${durationValue}${durationUnit}`
        );

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
          addLog(`❌ API ERROR ENCOUNTERED: ${data.error.message}`);
          unlockAndRetry(ws, 3000, `Deriv API rejection (${data.error.code || "ERR"})`);
          return;
        }

        if (data.msg_type === "portfolio") {
          const openContracts = data.portfolio?.contracts || [];
          const activeContract = openContracts.find(
            (c) =>
              c.symbol === getCurrentMarket() &&
              !settledIdsRef.current.has(c.contract_id)
          );

          if (activeContract) {
            addLog(`🔄 RESUBSCRIBING: Monitored contract #${activeContract.contract_id} detected in portfolio.`);
            ws.send(
              JSON.stringify({
                proposal_open_contract: 1,
                contract_id: activeContract.contract_id,
                subscribe: 1,
                req_id: ++requestIdRef.current,
              })
            );
          } else {
            isExecutingRef.current = false;
            sendProposal(ws);
          }
          return;
        }

        if (data.msg_type === "proposal") {
          if (data.proposal) {
            addLog(`📥 PROPOSAL ACCEPTED: ID=${data.proposal.id} | Ask Price=$${data.proposal.ask_price}`);
            ws.send(
              JSON.stringify({
                buy: data.proposal.id,
                price: data.proposal.ask_price,
                req_id: ++requestIdRef.current,
              })
            );
          } else {
            unlockAndRetry(ws, 2000, "Received empty proposal payload from broker.");
          }
        }

        if (data.msg_type === "buy") {
          const contractId = data.buy.contract_id;
          addLog(`🛒 POSITION PURCHASED: Contract #${contractId} confirmed active.`);
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

            const updatedWinsCount = row.blockWins;
            const updatedSettledCount = settledIdsRef.current.size;

            setBankedWinsCount(updatedWinsCount);
            setTotalSettledCount(updatedSettledCount);

            // Cycle market and contract type after every completed trade
            rotateMarketAndContract();

            saveSessionToStorage(
              updatedWinsCount,
              updatedSettledCount,
              totalSessionProfitRef.current
            );

            setBot4State((prev) => ({
              ...prev,
              history: [...(prev?.history || []), { bot: "Titan Engine", ...row }],
            }));

            addLog(
              `📊 TRADE SETTLED (${updatedSettledCount}/50): Result=${
                isWin ? "WIN 🟢" : "LOSS 🔴"
              } | P/L=$${Number(row.profitLoss || 0).toFixed(
                2
              )} | Cycle P/L=$${(engineRef4?.current?.cycleRunningBalance || 0).toFixed(
                2
              )} | Net Acc=$${totalSessionProfitRef.current.toFixed(2)}`
            );

            // 1. HARD DRAWDOWN CHECK: Limit set to -25 * base stake
            const maxDrawdownLimit = -1 * Number(minStake) * 25;
            if (totalSessionProfitRef.current < maxDrawdownLimit) {
              addLog(
                `🚨 [DRAWDOWN TRIGGERED] Session deficit ($${totalSessionProfitRef.current.toFixed(
                  2
                )}) crossed threshold limit ($${maxDrawdownLimit.toFixed(
                  2
                )}).`
              );
              autoRestartFreshBlock(`Maximum Session Drawdown Exceeded ($${maxDrawdownLimit.toFixed(2)})`);
              return;
            }

            // 2. HIGH-STAKE WIN CAP: Stake > $7.00
            if (isWin && activeStakeRef.current > 7.0) {
              autoRestartFreshBlock(
                `[CAP TRIGGERED] Target win achieved at high stake level ($${activeStakeRef.current.toFixed(
                  2
                )} > $7.00).`
              );
              return;
            }

            // 3. RECOVERY THRESHOLD ACHIEVED: Wins >= 10
            const totalLosses = engineRef4?.current?.totalLosses || 0;
            const ratio = engineRef4?.current?.RATIO || 1.5;
            const stakingModifier = engineRef4?.current?.stakingModifier || 0;
            const rawExpected = totalLosses > 0 ? totalLosses / ratio : 1.0;
            const expectedWinsRequired = Math.ceil(rawExpected) + stakingModifier;

            if (
              updatedWinsCount >= 10 &&
              updatedWinsCount >= expectedWinsRequired
            ) {
              autoRestartFreshBlock(
                `[EARLY EXIT TRIGGERED] Banked ${updatedWinsCount} wins (>=10) fulfilling calculated recovery threshold (${expectedWinsRequired} req).`
              );
              return;
            }

            // 4. STANDARD TARGET OR 25 BANKED WINS REACHED
            if (
              updatedWinsCount >= 25 ||
              totalSessionProfitRef.current >= blockTargetProfit
            ) {
              autoRestartFreshBlock(
                `[TARGET REACHED] Reached ${updatedWinsCount} banked wins ($${totalSessionProfitRef.current.toFixed(
                  2
                )} net profit).`
              );
              return;
            }

            if (!isWin) {
              lossStreakRef.current += 1;
            } else {
              lossStreakRef.current = 0;
            }

            // 5. MAXIMUM BLOCK LIMIT REACHED (50 TRADES)
            if (updatedSettledCount >= 50) {
              autoRestartFreshBlock(
                `[BLOCK ROW LIMIT REACHED] Reached maximum block capacity of 50 settled trades.`
              );
              return;
            }

            addLog("⏳ READY: Queueing next proposal in 1.5s...");
            unlockAndRetry(ws, 1500);
          }
        }
      };

      ws.onerror = () => addLog("⚠️ SOCKET ERROR: Network transport failure detected.");

      ws.onclose = () => {
        addLog("🔌 CONNECTION CLOSED: WebSocket session terminated.");
        clearExecutionTimeout();
        isExecutingRef.current = false;

        if (!isTradingRef.current) {
          return;
        }

        addLog("🔄 RECONNECTING: Connection lost. Re-establishing link in 3 seconds...");
        setTimeout(() => {
          if (isTradingRef.current) {
            executeStart();
          }
        }, 3000);
      };
    } catch (err) {
      addLog(`❌ INITIALIZATION FAILURE: ${err.message}`);
      clearExecutionTimeout();
      isExecutingRef.current = false;

      if (isTradingRef.current) {
        addLog("🔄 RETRY: Attempting system reboot in 5 seconds...");
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
    VOLATILITY_MARKETS.find((m) => m.id === getCurrentMarket())?.label ||
    getCurrentMarket();

  const activeContractLabel =
    CONTRACT_TYPES.find((c) => c.id === getCurrentContractType())?.label ||
    getCurrentContractType();

  const currentUnitConfig = DURATION_UNITS.find((u) => u.id === durationUnit) || DURATION_UNITS[2];

  return (
    <div
      className={`bot-card premium-card ${
        bot4State?.isTrading ? "active-trading" : ""
      }`}
    >
      <div className="bot-header">
        <div className="bot-title-group">
          <div className="title-with-badge">
            <h2>TitanEngine (Bot 4)</h2>
            <span className="premium-badge">TITAN MATRIX</span>
          </div>
          <span className="bot-subtitle">
            Dynamic Multi-Market Rotation • Alternating Contract Options
          </span>
        </div>
        <span className="account-tag">{accountType.toUpperCase()}</span>
      </div>

      <div className="bot-explanation">
        <p className="notice-highlight">
          🔄 Active Market: <strong>{activeMarketLabel}</strong> | Next Type: <strong>{activeContractLabel}</strong>
        </p>
        <p className="risk-warning-banner" style={{ color: "#a0aec0", fontSize: "0.85rem", marginTop: "4px" }}>
          💡 TitanEngine rotates markets and contract types sequentially after every settled trade to diversify execution across indices.
        </p>
      </div>

      <div className="config-grid triple-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div className="form-field">
          <label>Base Stake ($ Min: 1.00)</label>
          <input
            type="number"
            step="0.50"
            min="1.00"
            value={minStake}
            onChange={handleStakeChange}
            disabled={bot4State?.isTrading || disabled}
          />
        </div>

        <div className="form-field">
          <label>Profit Ratio ({(profitRatio * 100).toFixed(0)}%)</label>
          <input
            type="number"
            step="0.05"
            min="0.25"
            max="0.75"
            value={profitRatio}
            onChange={handleRatioChange}
            disabled={bot4State?.isTrading || disabled}
          />
        </div>

        <div className="form-field">
          <label>Duration ({currentUnitConfig.min}-{currentUnitConfig.max || "∞"})</label>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="number"
              min={currentUnitConfig.min}
              max={currentUnitConfig.max}
              value={durationValue}
              onChange={handleDurationValueChange}
              disabled={bot4State?.isTrading || disabled}
              style={{ width: "60%" }}
            />
            <select
              value={durationUnit}
              onChange={handleDurationUnitChange}
              disabled={bot4State?.isTrading || disabled}
              style={{ width: "40%" }}
            >
              {DURATION_UNITS.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="metrics-ribbon">
        <div className="metric-item">
          <span className="metric-label">Active Market</span>
          <span className="metric-value">{activeMarketLabel}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Contract Type</span>
          <span className="metric-value">{activeContractLabel}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Engine Status</span>
          <span
            className={`metric-value ${
              bot4State?.isTrading ? "status-on" : "status-off"
            }`}
          >
            {bot4State?.isTrading ? "ONLINE" : "OFF"}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Next Stake</span>
          <span className="metric-value">${nextStakeVal.toFixed(2)}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Banked Wins</span>
          <span className="metric-value highlight-win">
            {bankedWinsCount} / {totalSettledCount}
          </span>
        </div>
      </div>

      <div className="controls">
        {!bot4State?.isTrading ? (
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
              className="start-btn premium-btn"
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
          {(bot4State?.logs || []).join("\n") ||
            "Titan Engine standing by. Ready to launch trading session..."}
        </pre>
      </div>
    </div>
  );
}