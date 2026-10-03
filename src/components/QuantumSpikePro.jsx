import React, { useState, useEffect, useRef } from "react";
import { useTrading } from "../context/TradingContext";
import "./AegisEngine.css";

const API_BASE = "https://api.derivws.com";
const APP_ID = "34jtvKMAMvumIpF2SDF0D";
const CURRENCY = "USD";
const STORAGE_KEY = "quantum_spike_pro_session_v3";

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
    return minStake * 100;
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

  const requestIdRef = useRef(300);
  const isExecutingRef = useRef(false);
  const activeStakeRef = useRef(1.0);
  const settledIdsRef = useRef(new Set());
  const isTradingRef = useRef(false);
  const executionTimeoutRef = useRef(null);
  const lossStreakRef = useRef(0);
  const totalSessionProfitRef = useRef(0);

  // Custom Direction Tracking: Default is "CALL"
  const currentDirectionRef = useRef("CALL");

  // Persistent market symbol for the entire duration of a trade block
  const currentBlockSymbolRef = useRef(null);

  // Pick a single random market for the block
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
        if (parsed.currentDirection) {
          currentDirectionRef.current = parsed.currentDirection;
        }

        // Restore saved trade history into state
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
        console.error("Failed to restore QuantumSpikePro session from storage:", err);
      }
    }
  }, [engineRef3, setBot3State]);

  // Calculated target values
  const unitProfit = Number(minStake) * Number(profitRatio);
  const blockTargetProfit = 250 * unitProfit;

  const saveSessionToStorage = (updatedWins, updatedSettled, updatedProfit) => {
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
      currentDirection: currentDirectionRef.current,
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
      logs: [...prev.logs.slice(-99), `[QUANTUM-SPIKE-PRO | ${time}] ${msg}`],
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
    setStopLoss(val * 100);
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
    const activeDirection = currentDirectionRef.current;

    try {
      ws.send(
        JSON.stringify({
          proposal: 1,
          amount: stake,
          basis: "stake",
          contract_type: activeDirection,
          currency: CURRENCY,
          duration: Number(durationValue),
          duration_unit: durationUnit,
          underlying_symbol: activeSymbol,
          req_id: ++requestIdRef.current,
        })
      );
      addLog(
        `📈 PROPOSAL REQUEST: Market=${activeSymbol} | Type=${activeDirection} | Duration=${durationValue}${durationUnit} | Calculated Stake=$${stake.toFixed(2)}`
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
    currentDirectionRef.current = "CALL"; // Reset to default CALL direction
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
    addLog(`🚀 INITIALIZING FRESH TRADE BLOCK`);
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
      `▶️ RESUMING SESSION: Market=${currentBlockSymbolRef.current} | Direction=${currentDirectionRef.current} | Saved Wins=${bankedWinsCount} | Settled Trades=${totalSettledCount}`
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

      addLog("Establishing real-time feed with Deriv API...");
      const ws = new WebSocket(wsUrl);
      wsRef3.current = ws;

      ws.onopen = () => {
        isExecutingRef.current = false;
        addLog(
          `✅ CONNECTED: Market=${currentBlockSymbolRef.current} | Direction=${currentDirectionRef.current} | Base Stake=$${Number(minStake).toFixed(2)} | Target/Win=$${unitProfit.toFixed(2)} (${(profitRatio * 100).toFixed(1)}%) | Duration=${durationValue}${durationUnit}`
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

            // DIRECTION LOGIC: Keep current direction on WIN, toggle direction on LOSS
            if (isWin) {
              lossStreakRef.current = 0;
              addLog(`🔄 DIRECTION MAINTAINED: Position won. Retaining ${currentDirectionRef.current} for next trade.`);
            } else {
              lossStreakRef.current += 1;
              const nextDir = currentDirectionRef.current === "CALL" ? "PUT" : "CALL";
              currentDirectionRef.current = nextDir;
              addLog(`🔀 DIRECTION SWITCHED: Position lost. Swapping direction to ${nextDir} for next trade.`);
            }

            totalSessionProfitRef.current += Number(row.profitLoss || 0);

            const updatedWinsCount = row.blockWins;
            const updatedSettledCount = settledIdsRef.current.size;

            setBankedWinsCount(updatedWinsCount);
            setTotalSettledCount(updatedSettledCount);

            saveSessionToStorage(
              updatedWinsCount,
              updatedSettledCount,
              totalSessionProfitRef.current
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
              )} | Cycle P/L=$${(engineRef3?.current?.cycleRunningBalance || 0).toFixed(
                2
              )} | Net Acc=$${totalSessionProfitRef.current.toFixed(2)}`
            );

            // USER-DEFINED TAKE PROFIT CHECK
            const tpVal = Number(takeProfit);
            if (tpVal > 0 && totalSessionProfitRef.current >= tpVal) {
              addLog(
                `🎯 [TAKE PROFIT HIT] Net profit ($${totalSessionProfitRef.current.toFixed(
                  2
                )}) reached target ($${tpVal.toFixed(2)}). Stopping engine.`
              );
              stopBot();
              return;
            }

            // USER-DEFINED STOP LOSS CHECK
            const slVal = Number(stopLoss);
            if (slVal > 0 && totalSessionProfitRef.current <= -Math.abs(slVal)) {
              addLog(
                `🛑 [STOP LOSS HIT] Net drawdown ($${totalSessionProfitRef.current.toFixed(
                  2
                )}) reached threshold (-$${Math.abs(slVal).toFixed(2)}). Stopping engine.`
              );
              stopBot();
              return;
            }

            // 1. HARD DRAWDOWN CHECK: Limit set to -25 * base stake
            const maxDrawdownLimit = -1 * Number(minStake) * 2500;
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
            if (isWin && activeStakeRef.current > 700.0) {
              autoRestartFreshBlock(
                `[CAP TRIGGERED] Target win achieved at high stake level ($${activeStakeRef.current.toFixed(
                  2
                )} > $7.00).`
              );
              return;
            }

            // 3. RECOVERY THRESHOLD ACHIEVED: Wins >= 10
            const totalLosses = engineRef3?.current?.totalLosses || 0;
            const ratio = engineRef3?.current?.RATIO || 1.9;
            const stakingModifier = engineRef3?.current?.stakingModifier || 0;
            const rawExpected = totalLosses > 0 ? totalLosses / ratio : 1.0;
            const expectedWinsRequired = Math.ceil(rawExpected) + stakingModifier;

            if (
              updatedWinsCount >= 300 &&
              updatedWinsCount >= expectedWinsRequired
            ) {
              autoRestartFreshBlock(
                `[EARLY EXIT TRIGGERED] Banked ${updatedWinsCount} wins (>=10) fulfilling calculated recovery threshold (${expectedWinsRequired} req).`
              );
              return;
            }

            // 4. STANDARD TARGET OR 25 BANKED WINS REACHED
            if (
              updatedWinsCount >= 250 ||
              totalSessionProfitRef.current >= blockTargetProfit
            ) {
              autoRestartFreshBlock(
                `[TARGET REACHED] Reached ${updatedWinsCount} banked wins ($${totalSessionProfitRef.current.toFixed(
                  2
                )} net profit).`
              );
              return;
            }

            // 5. MAXIMUM BLOCK LIMIT REACHED (50 TRADES)
            if (updatedSettledCount >= 500) {
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
    <div className={`aegis-container ${disabled ? "disabled" : ""}`}>
      <div className="aegis-card">
        <div className="aegis-header">
          <h2>Quantum Spike Pro (Bot 3)</h2>
          <span className={`status-badge ${bot3State.isTrading ? "active" : "inactive"}`}>
            {bot3State.isTrading ? "RUNNING" : "STOPPED"}
          </span>
        </div>

        <div className="aegis-controls-grid">
          <div className="control-group">
            <label>Base Stake ($)</label>
            <input
              type="number"
              min="1.0"
              step="0.5"
              value={minStake}
              onChange={handleStakeChange}
              disabled={bot3State.isTrading}
            />
          </div>

          <div className="control-group">
            <label>Profit Ratio</label>
            <input
              type="number"
              min="0.25"
              max="0.75"
              step="0.05"
              value={profitRatio}
              onChange={handleRatioChange}
              disabled={bot3State.isTrading}
            />
          </div>

          <div className="control-group">
            <label>Duration Unit</label>
            <select
              value={durationUnit}
              onChange={handleDurationUnitChange}
              disabled={bot3State.isTrading}
            >
              {DURATION_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Duration ({currentUnitConfig.min}-{currentUnitConfig.max || "∞"})</label>
            <input
              type="number"
              min={currentUnitConfig.min}
              max={currentUnitConfig.max}
              value={durationValue}
              onChange={handleDurationValueChange}
              disabled={bot3State.isTrading}
            />
          </div>

          <div className="control-group">
            <label>Take Profit ($)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={takeProfit}
              onChange={handleTakeProfitChange}
              disabled={bot3State.isTrading}
            />
          </div>

          <div className="control-group">
            <label>Stop Loss ($)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={stopLoss}
              onChange={handleStopLossChange}
              disabled={bot3State.isTrading}
            />
          </div>
        </div>

        <div className="aegis-info-panel">
          <div className="info-item">
            <span>Market:</span>
            <strong>{activeMarketLabel}</strong>
          </div>
          <div className="info-item">
            <span>Active Direction:</span>
            <strong className={currentDirectionRef.current === "CALL" ? "text-green" : "text-red"}>
              {currentDirectionRef.current}
            </strong>
          </div>
          <div className="info-item">
            <span>Next Stake:</span>
            <strong>${nextStakeVal.toFixed(2)}</strong>
          </div>
          <div className="info-item">
            <span>Banked Wins:</span>
            <strong>{bankedWinsCount}</strong>
          </div>
          <div className="info-item">
            <span>Settled Trades:</span>
            <strong>{totalSettledCount}</strong>
          </div>
          <div className="info-item">
            <span>Session P/L:</span>
            <strong className={totalSessionProfitRef.current >= 0 ? "text-green" : "text-red"}>
              ${totalSessionProfitRef.current.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="aegis-actions">
          {!bot3State.isTrading ? (
            <>
              {hasSavedSession && (
                <button className="btn btn-resume" onClick={handleResumeTrades}>
                  Resume Session
                </button>
              )}
              <button className="btn btn-start" onClick={handleStartNewCycle}>
                Start New Block
              </button>
            </>
          ) : (
            <button className="btn btn-stop" onClick={stopBot}>
              Pause Engine
            </button>
          )}
        </div>

        <div className="aegis-logs">
          <h3>Activity Logs</h3>
          <div className="log-window">
            {bot3State.logs.length === 0 ? (
              <p className="no-logs">No activity recorded yet.</p>
            ) : (
              bot3State.logs.map((log, index) => (
                <div key={index} className="log-line">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}