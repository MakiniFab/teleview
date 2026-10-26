import React, { useState, useEffect, useRef } from "react";
import { useTrading } from "../context/TradingContext";
import "./QuantumSpikePro.css";

const API_BASE = "https://api.derivws.com";
const APP_ID = "34jtvKMAMvumIpF2SDF0D";
const CURRENCY = "USD";
const STORAGE_KEY = "quantum_spike_session_v1";

const VOLATILITY_MARKETS = [
  { id: "R_10", label: "Volatility 10 Index" },
  { id: "R_25", label: "Volatility 25 Index" },
  { id: "R_50", label: "Volatility 50 Index" },
  { id: "R_75", label: "Volatility 75 Index" },
  { id: "R_100", label: "Volatility 100 Index" },
];

const DURATION_UNITS = [
  { id: "t", label: "Ticks", min: 1, max: 10 },
  { id: "s", label: "Seconds", min: 15, max: 86400 },
  { id: "m", label: "Minutes", min: 1, max: 1440 },
  { id: "h", label: "Hours", min: 1, max: 24 },
  { id: "d", label: "Days", min: 1, max: 365 },
];

export default function QuantumSpikePro({ disabled = false }) {
  const {
    patToken,
    isConnected,
    accountType,
    bot3State,
    setBot3State,
    wsRef3,
    engineRef3,
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

  // Take Profit (Default: 5 * minStake)
  const [takeProfit, setTakeProfit] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && JSON.parse(saved).takeProfit !== undefined) {
      return JSON.parse(saved).takeProfit;
    }
    return minStake * 5;
  });

  // Stop Loss (Default: 100 * minStake)
  const [stopLoss, setStopLoss] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && JSON.parse(saved).stopLoss !== undefined) {
      return JSON.parse(saved).stopLoss;
    }
    return minStake * 30;
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

  // Dynamic Contract Type Tracking (PUT / CALL alternating on loss)
  const [currentContractType, setCurrentContractType] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).currentContractType || "PUT" : "PUT";
  });

  const requestIdRef = useRef(500);
  const isExecutingRef = useRef(false);
  const activeStakeRef = useRef(1.0);
  const settledIdsRef = useRef(new Set());
  const isTradingRef = useRef(false);
  const executionTimeoutRef = useRef(null);
  const lossStreakRef = useRef(0);
  const totalSessionProfitRef = useRef(0);

  // Persistent market symbol for the entire duration of a trade block
  const currentBlockSymbolRef = useRef(null);

  const selectNewBlockMarket = () => {
    const randomIndex = Math.floor(Math.random() * VOLATILITY_MARKETS.length);
    const selected = VOLATILITY_MARKETS[randomIndex].id;
    currentBlockSymbolRef.current = selected;
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
        if (parsed.currentBlockSymbol) {
          currentBlockSymbolRef.current = parsed.currentBlockSymbol;
        }
        if (parsed.currentContractType) {
          setCurrentContractType(parsed.currentContractType);
        }

        if (Array.isArray(parsed.history) && parsed.history.length > 0) {
          setBot3State((prev) => ({
            ...prev,
            history: parsed.history,
          }));
        }

        if (parsed.engineState && engineRef3?.current?.restoreState) {
          engineRef3.current.restoreState(parsed.engineState);
        }
      } catch (err) {
        console.error("Failed to restore QuantumSpike session from storage:", err);
      }
    }
  }, [engineRef3, setBot3State]);

  const unitProfit = Number(minStake) * Number(profitRatio);
  const blockTargetProfit = 250 * unitProfit;

  const saveSessionToStorage = (updatedWins, updatedSettled, updatedProfit, contractTypeVal) => {
    const payload = {
      minStake: Number(minStake),
      profitRatio: Number(profitRatio),
      durationValue: Number(durationValue),
      durationUnit,
      takeProfit: Number(takeProfit),
      stopLoss: Number(stopLoss),
      bankedWinsCount: updatedWins,
      totalSettledCount: updatedSettled,
      settledIds: Array.from(settledIdsRef.current),
      lossStreak: lossStreakRef.current,
      totalSessionProfit: updatedProfit,
      currentBlockSymbol: currentBlockSymbolRef.current,
      currentContractType: contractTypeVal,
      history: bot3State.history,
      engineState: engineRef3?.current?.exportState
        ? engineRef3.current.exportState()
        : null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setHasSavedSession(updatedSettled > 0 || updatedWins > 0);
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setBot3State((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-99), `[QUANTUM-PRO | ${time}] ${msg}`],
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
    setTakeProfit(val * 5);
    setStopLoss(val * 30);
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

  const handleTakeProfitChange = (e) => {
    const val = Math.max(0, parseFloat(e.target.value) || 0);
    setTakeProfit(val);
  };

  const handleStopLossChange = (e) => {
    const val = Math.max(0, parseFloat(e.target.value) || 0);
    setStopLoss(val);
  };

  const getTimeoutDurationMs = () => {
    const val = Number(durationValue);
    switch (durationUnit) {
      case "t": return val * 2000;
      case "s": return val * 1000;
      case "m": return val * 60 * 1000;
      case "h": return val * 60 * 60 * 1000;
      case "d": return val * 24 * 60 * 60 * 1000;
      default: return 120000;
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

    if (engineRef3?.current) {
      engineRef3.current.MIN_STAKE = Number(minStake);
      engineRef3.current.UNIT_TARGET_PROFIT = unitProfit;
    }

    const rawStake = engineRef3?.current?.getNextStake
      ? engineRef3.current.getNextStake(Number(minStake))
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

    if (!currentBlockSymbolRef.current) {
      selectNewBlockMarket();
    }
    const activeSymbol = currentBlockSymbolRef.current;

    try {
      ws.send(
        JSON.stringify({
          proposal: 1,
          amount: stake,
          basis: "stake",
          contract_type: currentContractType,
          currency: CURRENCY,
          duration: Number(durationValue),
          duration_unit: durationUnit,
          underlying_symbol: activeSymbol,
          req_id: ++requestIdRef.current,
        })
      );
      addLog(
        `📈 PROPOSAL REQUEST: Market=${activeSymbol} | Type=${currentContractType} | Duration=${durationValue}${durationUnit} | Calculated Stake=$${stake.toFixed(2)}`
      );
    } catch (err) {
      addLog(`❌ PROPOSAL FAILED: ${err.message}`);
      unlockAndRetry(ws, 2000, "Websocket frame transmission failure.");
    }
  };

  const resetSessionData = () => {
    lossStreakRef.current = 0;
    totalSessionProfitRef.current = 0;
    currentBlockSymbolRef.current = null;
    setCurrentContractType("PUT");
    setBankedWinsCount(0);
    setTotalSettledCount(0);
    settledIdsRef.current.clear();
    localStorage.removeItem(STORAGE_KEY);
    setHasSavedSession(false);

    setBot3State((prev) => ({
      ...prev,
      logs: [],
      history: [],
      contract: null,
      wins: 0,
      losses: 0,
      totalTrades: 0,
      totalProfit: 0,
      winRate: 0,
      profitFactor: 0,
      consecutiveLosses: 0,
      maxConsecutiveLosses: 0,
      drawdown: 0,
      maxDrawdown: 0,
    }));
    if (engineRef3?.current?.reset) {
      engineRef3.current.reset();
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
    selectNewBlockMarket();
    addLog(`🚀 INITIALIZING FRESH TRADE BLOCK (QuantumSpikePro)`);
    executeStart();
  };

  const handleResumeTrades = () => {
    if (!isConnected || !patToken) {
      return alert("Please connect your PAT on the Dashboard first.");
    }
    if (Number(minStake) < 1.0) {
      return alert("Minimum base stake must be at least $1.00.");
    }

    if (!currentBlockSymbolRef.current) {
      selectNewBlockMarket();
    }

    addLog(
      `▶️ RESUMING SESSION: Market=${currentBlockSymbolRef.current} | Type=${currentContractType} | Saved Wins=${bankedWinsCount}`
    );
    executeStart();
  };

  const stopBot = () => {
    isTradingRef.current = false;
    isExecutingRef.current = false;
    clearExecutionTimeout();

    if (wsRef3.current) {
      wsRef3.current.onclose = null;
      wsRef3.current.onerror = null;
      wsRef3.current.onmessage = null;
      wsRef3.current.onopen = null;
      wsRef3.current.close();
      wsRef3.current = null;
    }

    setBot3State((prev) => ({ ...prev, isTrading: false }));
    addLog("⏸️ ENGINE PAUSED: Trading system stopped successfully by user action.");
  };

  const autoRestartFreshBlock = (reasonMsg) => {
    isTradingRef.current = true;
    addLog(`🏁 BLOCK COMPLETED: ${reasonMsg}`);
    addLog("🔄 CYCLE RESTART: Initiating fresh block in 3 seconds...");

    clearExecutionTimeout();
    if (wsRef3.current) {
      wsRef3.current.onclose = null;
      wsRef3.current.onerror = null;
      wsRef3.current.onmessage = null;
      wsRef3.current.onopen = null;
      wsRef3.current.close();
      wsRef3.current = null;
    }

    setTimeout(() => {
      if (!isTradingRef.current) {
        addLog("⛔ AUTO-RESTART CANCELLED: Engine manually stopped prior to cycle launch.");
        return;
      }

      resetSessionData();
      selectNewBlockMarket();
      addLog(`✨ NEW BLOCK ACTIVE: Market reset to ${currentBlockSymbolRef.current}`);
      executeStart();
    }, 3000);
  };

  const executeStart = async () => {
    if (
      isExecutingRef.current ||
      (wsRef3.current && wsRef3.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    isTradingRef.current = true;
    isExecutingRef.current = true;
    setBot3State((prev) => ({ ...prev, isTrading: true }));

    if (wsRef3.current) {
      wsRef3.current.onclose = null;
      wsRef3.current.onerror = null;
      wsRef3.current.onmessage = null;
      wsRef3.current.onopen = null;
      wsRef3.current.close();
      wsRef3.current = null;
    }

    if (engineRef3?.current) {
      engineRef3.current.MIN_STAKE = Number(minStake);
      engineRef3.current.UNIT_TARGET_PROFIT = unitProfit;
    }

    try {
      addLog(`🌐 CONNECTING`);
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

      addLog(`🔑 AUTHORIZING`);
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

      addLog("Establishing real-time feed with Deriv API...");
      const ws = new WebSocket(wsUrl);
      wsRef3.current = ws;

      ws.onopen = () => {
        isExecutingRef.current = false;
        addLog(
          `✅ CONNECTED: Market=${currentBlockSymbolRef.current} | Type=${currentContractType} | Base Stake=$${Number(minStake).toFixed(2)} | Target/Win=$${unitProfit.toFixed(2)} (${(profitRatio * 100).toFixed(1)}%)`
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
              c.symbol === currentBlockSymbolRef.current &&
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
            addLog(`📥 PROPOSAL ACCEPTED`);
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
          addLog(`🛒 POSITION PURCHASED`);
          setBot3State((prev) => ({
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
          setBot3State((prev) => ({
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

            const row = engineRef3?.current?.processOutcome
              ? engineRef3.current.processOutcome(
                  profit,
                  activeStakeRef.current,
                  Number(minStake)
                )
              : { outcome: profit > 0 ? "W" : "L", profitLoss: profit, blockWins: bankedWinsCount };

            const isWin =
              profit > 0 || poc.status === "won" || row.outcome === "W";
            totalSessionProfitRef.current += Number(row.profitLoss || 0);

            // DYNAMIC CONTRACT TYPE TRANSITION LOGIC:
            // - If WIN: Keep current contract type.
            // - If LOSS: Switch contract type between PUT and CALL.
            // DYNAMIC CONTRACT TYPE TRANSITION LOGIC (REVERSED):
            // - If WIN: Switch contract type between PUT and CALL.
            // - If LOSS: Keep current contract type.
            let nextType = currentContractType;
            if (isWin) {
              nextType = currentContractType === "PUT" ? "CALL" : "PUT";
              setCurrentContractType(nextType);
              addLog(`⚡ DYNAMIC SWITCH: Win registered. Switched contract type to [${nextType}]`);
            } else {
              addLog(`🎯 MAINTAINED: Loss registered. Retaining contract type [${currentContractType}]`);
            }

            const updatedWinsCount = row.blockWins;
            const updatedSettledCount = settledIdsRef.current.size;

            setBankedWinsCount(updatedWinsCount);
            setTotalSettledCount(updatedSettledCount);

            saveSessionToStorage(
              updatedWinsCount,
              updatedSettledCount,
              totalSessionProfitRef.current,
              nextType
            );

            setBot3State((prev) => ({
              ...prev,
              history: [...prev.history, { bot: "Quantum Spike Pro", ...row }],
            }));

            addLog(
              `📊 TRADE SETTLED (${updatedSettledCount}/50): Result=${
                isWin ? "WIN 🟢" : "LOSS 🔴"
              } | P/L=$${Number(row.profitLoss || 0).toFixed(
                2
              )} | Next Type=${nextType} | Net Acc=$${totalSessionProfitRef.current.toFixed(2)}`
            );

            // USER-DEFINED TAKE PROFIT
            const tpVal = Number(takeProfit);
            if (tpVal > 0 && totalSessionProfitRef.current >= tpVal) {
              addLog(`🎯 [TAKE PROFIT HIT] Net profit reached target. Stopping engine.`);
              stopBot();
              return;
            }

            // USER-DEFINED STOP LOSS
            const slVal = Number(stopLoss);
            if (slVal > 0 && totalSessionProfitRef.current <= -Math.abs(slVal)) {
              addLog(`🛑 [STOP LOSS HIT] Net drawdown reached threshold. Stopping engine.`);
              stopBot();
              return;
            }

            // DRAWDOWN LIMIT
            const maxDrawdownLimit = -1 * Number(minStake) * 2500;
            if (totalSessionProfitRef.current < maxDrawdownLimit) {
              autoRestartFreshBlock(`Maximum Session Drawdown Exceeded`);
              return;
            }

            if (isWin && activeStakeRef.current > 700.0) {
              autoRestartFreshBlock(`[CAP TRIGGERED] Target win achieved at high stake level.`);
              return;
            }

            const totalLosses = engineRef3?.current?.totalLosses || 0;
            const ratio = engineRef3?.current?.RATIO || 1.9;
            const stakingModifier = engineRef3?.current?.stakingModifier || 0;
            const rawExpected = totalLosses > 0 ? totalLosses / ratio : 1.0;
            const expectedWinsRequired = Math.ceil(rawExpected) + stakingModifier;

            if (updatedWinsCount >= 300 && updatedWinsCount >= expectedWinsRequired) {
              autoRestartFreshBlock(`[EARLY EXIT TRIGGERED] Banked target recovery wins.`);
              return;
            }

            if (updatedWinsCount >= 250 || totalSessionProfitRef.current >= blockTargetProfit) {
              autoRestartFreshBlock(`[TARGET REACHED] Reached target banked wins.`);
              return;
            }

            if (!isWin) {
              lossStreakRef.current += 1;
            } else {
              lossStreakRef.current = 0;
            }

            if (updatedSettledCount >= 500) {
              autoRestartFreshBlock(`[BLOCK ROW LIMIT REACHED] Reached maximum block capacity.`);
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

        if (!isTradingRef.current) return;

        addLog("🔄 RECONNECTING: Re-establishing link in 3 seconds...");
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
        setBot3State((prev) => ({ ...prev, isTrading: false }));
      }
    }
  };

  const nextStakeVal = engineRef3?.current?.getNextStake
    ? engineRef3.current.getNextStake(Number(minStake))
    : Number(minStake);

  const activeMarketLabel =
    VOLATILITY_MARKETS.find((m) => m.id === currentBlockSymbolRef.current)
      ?.label || currentBlockSymbolRef.current || "Unassigned";

  const currentUnitConfig = DURATION_UNITS.find((u) => u.id === durationUnit) || DURATION_UNITS[2];

  return (
    <div
      className={`bot-card premium-card ${
        bot3State.isTrading ? "active-trading" : ""
      }`}
    >
      <div className="bot-header">
        <div className="bot-title-group">
          <div className="title-with-badge">
            <h2>QuantumSpikePro</h2>
            <span className="premium-badge">PRO</span>
          </div>
          <span className="bot-subtitle">
            High-Frequency Spike Execution • Adaptive Quantum Recovery
          </span>
        </div>
        <span className="account-tag">{accountType.toUpperCase()}</span>
      </div>

      <div className="bot-explanation">
        <p className="notice-highlight">
          ⚠️ Market locked to <strong>{activeMarketLabel}</strong> for current trade block.
        </p>
        <p className="risk-warning-banner" style={{ color: "#a0aec0", fontSize: "0.85rem", marginTop: "4px" }}>
          💡 Profit Ratio range is 25% – 75%. Higher ratios increase target payouts per win but scale recovery stakes faster during loss streaks.
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
            disabled={bot3State.isTrading || disabled}
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
            disabled={bot3State.isTrading || disabled}
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
              disabled={bot3State.isTrading || disabled}
              style={{ width: "60%" }}
            />
            <select
              value={durationUnit}
              onChange={handleDurationUnitChange}
              disabled={bot3State.isTrading || disabled}
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

      <div className="config-grid dual-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div className="form-field">
          <label>Take Profit ($ Max Limit, Default = 5x Stake)</label>
          <input
            type="number"
            step="1.00"
            min="0"
            placeholder={(minStake * 5).toFixed(2)}
            value={takeProfit}
            onChange={handleTakeProfitChange}
            disabled={bot3State.isTrading || disabled}
          />
        </div>

        <div className="form-field">
          <label>Stop Loss ($ Max Loss, Default = 30x Stake)</label>
          <input
            type="number"
            step="1.00"
            min="0"
            placeholder={(minStake * 30).toFixed(2)}
            value={stopLoss}
            onChange={handleStopLossChange}
            disabled={bot3State.isTrading || disabled}
          />
        </div>
      </div>

      <div className="metrics-ribbon">
        <div className="metric-item">
          <span className="metric-label">Active Market</span>
          <span className="metric-value">{activeMarketLabel}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Contract Type</span>
          <span className="metric-value" style={{ color: currentContractType === "PUT" ? "#f56565" : "#48bb78" }}>
            {currentContractType}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Engine Status</span>
          <span
            className={`metric-value ${
              bot3State.isTrading ? "status-on" : "status-off"
            }`}
          >
            {bot3State.isTrading ? "ONLINE" : "OFF"}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Next Stake</span>
          <span className="metric-value">${nextStakeVal.toFixed(2)}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Running Balance</span>
          <span
            className={`metric-value ${
              (engineRef3?.current?.cycleRunningBalance || 0) >= 0
                ? "highlight-win"
                : "status-off"
            }`}
          >
            ${(engineRef3?.current?.cycleRunningBalance || 0).toFixed(2)}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Banked Wins</span>
          <span className="metric-value highlight-win">
            {bankedWinsCount} / {totalSettledCount}
          </span>
        </div>
      </div>

      <div className="controls">
        {!bot3State.isTrading ? (
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
              Start QuantumSpikePro
            </button>
          )
        ) : (
          <button onClick={stopBot} className="stop-btn">
            Stop QuantumSpikePro
          </button>
        )}
      </div>

      <div className="console-wrapper">
        <div className="console-title">Engine Terminal Output</div>
        <pre className="logs-console">
          {bot3State.logs.join("\n") ||
            "QuantumSpikePro standing by. Ready to launch trading session..."}
        </pre>
      </div>
    </div>
  );
}