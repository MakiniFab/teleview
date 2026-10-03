import React, { useState, useEffect, useRef } from "react";
import { useTrading } from "../context/TradingContext";
import "./AegisEngine.css";

const API_BASE = "https://api.derivws.com";
const APP_ID = "34jtvKMAMvumIpF2SDF0D";
const CURRENCY = "USD";
const STORAGE_KEY = "nexus_engine_session_v1";

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

export default function NexusEngine({ disabled = false }) {
  const {
    patToken,
    isConnected,
    accountType,
    bot2State,
    setBot2State,
    wsRef2,
    engineRef2,
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

  // Contract Type Alternation State: Starts with PUT, switches to CALL after every proposal
  const currentContractTypeRef = useRef("PUT");

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
        if (parsed.nextContractType) {
          currentContractTypeRef.current = parsed.nextContractType;
        }

        // Restore saved trade history into Bot 2 state
        if (Array.isArray(parsed.history) && parsed.history.length > 0) {
          setBot2State((prev) => ({
            ...prev,
            history: parsed.history,
          }));
        }

        if (parsed.engineState && engineRef2?.current?.restoreState) {
          engineRef2.current.restoreState(parsed.engineState);
        }
      } catch (err) {
        console.error("Failed to restore Nexus session from storage:", err);
      }
    }
  }, [engineRef2, setBot2State]);

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
      nextContractType: currentContractTypeRef.current,
      history: bot2State.history,
      engineState: engineRef2?.current?.exportState
        ? engineRef2.current.exportState()
        : null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setHasSavedSession(updatedSettled > 0 || updatedWins > 0);
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setBot2State((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-99), `[NEXUS-BOT | ${time}] ${msg}`],
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
    
    // Recalculate limits dynamically
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

    // Synchronize Bot 2 engine context
    if (engineRef2?.current) {
      engineRef2.current.MIN_STAKE = Number(minStake);
      engineRef2.current.UNIT_TARGET_PROFIT = unitProfit;
    }

    const rawStake = engineRef2?.current?.getNextStake
      ? engineRef2.current.getNextStake(Number(minStake))
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

    // Use current contract type and immediately toggle for next trade
    const contractTypeToTrade = currentContractTypeRef.current;
    currentContractTypeRef.current = contractTypeToTrade === "PUT" ? "CALL" : "PUT";

    try {
      ws.send(
        JSON.stringify({
          proposal: 1,
          amount: stake,
          basis: "stake",
          contract_type: contractTypeToTrade,
          currency: CURRENCY,
          duration: Number(durationValue),
          duration_unit: durationUnit,
          underlying_symbol: activeSymbol,
          req_id: ++requestIdRef.current,
        })
      );
      addLog(
        `📈 PROPOSAL REQUEST: Market=${activeSymbol} | Type=${contractTypeToTrade} | Duration=${durationValue}${durationUnit} | Calculated Stake=$${stake.toFixed(2)}`
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
    currentContractTypeRef.current = "PUT"; // Reset alternation to start with PUT
    setBankedWinsCount(0);
    setTotalSettledCount(0);
    settledIdsRef.current.clear();
    localStorage.removeItem(STORAGE_KEY);
    setHasSavedSession(false);

    setBot2State((prev) => ({
      ...prev,
      logs: [],
      history: [], // Clear trade history array on fresh cycle reset
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
    if (engineRef2?.current?.reset) {
      engineRef2.current.reset();
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
      `▶️ RESUMING SESSION: Market=${currentBlockSymbolRef.current} | Saved Wins=${bankedWinsCount} | Settled Trades=${totalSettledCount} | Next Type=${currentContractTypeRef.current}`
    );
    executeStart();
  };

  const stopBot = () => {
    isTradingRef.current = false;
    isExecutingRef.current = false;

    clearExecutionTimeout();

    if (wsRef2.current) {
      wsRef2.current.onclose = null;
      wsRef2.current.onerror = null;
      wsRef2.current.onmessage = null;
      wsRef2.current.onopen = null;
      wsRef2.current.close();
      wsRef2.current = null;
    }

    setBot2State((prev) => ({ ...prev, isTrading: false }));
    addLog("⏸️ ENGINE PAUSED: Trading system stopped successfully by user action.");
  };

  const autoRestartFreshBlock = (reasonMsg) => {
    isTradingRef.current = true;
    addLog(`🏁 BLOCK COMPLETED: ${reasonMsg}`);
    addLog("🔄 CYCLE RESTART: Initiating fresh block in 3 seconds...");

    clearExecutionTimeout();
    if (wsRef2.current) {
      wsRef2.current.onclose = null;
      wsRef2.current.onerror = null;
      wsRef2.current.onmessage = null;
      wsRef2.current.onopen = null;
      wsRef2.current.close();
      wsRef2.current = null;
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
      (wsRef2.current && wsRef2.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    isTradingRef.current = true;
    isExecutingRef.current = true;
    setBot2State((prev) => ({ ...prev, isTrading: true }));

    if (wsRef2.current) {
      wsRef2.current.onclose = null;
      wsRef2.current.onerror = null;
      wsRef2.current.onmessage = null;
      wsRef2.current.onopen = null;
      wsRef2.current.close();
      wsRef2.current = null;
    }

    if (engineRef2?.current) {
      engineRef2.current.MIN_STAKE = Number(minStake);
      engineRef2.current.UNIT_TARGET_PROFIT = unitProfit;
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
      wsRef2.current = ws;

      ws.onopen = () => {
        isExecutingRef.current = false;
        addLog(
          `✅ CONNECTED: Market=${currentBlockSymbolRef.current} | Base Stake=$${Number(minStake).toFixed(2)} | Target/Win=$${unitProfit.toFixed(2)} (${(profitRatio * 100).toFixed(1)}%) | Duration=${durationValue}${durationUnit}`
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

            const row = engineRef2?.current?.processOutcome
              ? engineRef2.current.processOutcome(
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

            saveSessionToStorage(
              updatedWinsCount,
              updatedSettledCount,
              totalSessionProfitRef.current
            );

            setBot2State((prev) => ({
              ...prev,
              history: [...prev.history, { bot: "Nexus Dynamic", ...row }],
            }));

            addLog(
              `📊 TRADE SETTLED (${updatedSettledCount}/50): Result=${
                isWin ? "WIN 🟢" : "LOSS 🔴"
              } | P/L=$${Number(row.profitLoss || 0).toFixed(
                2
              )} | Cycle P/L=$${(engineRef2?.current?.cycleRunningBalance || 0).toFixed(
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
            const totalLosses = engineRef2?.current?.totalLosses || 0;
            const ratio = engineRef2?.current?.RATIO || 1.9;
            const stakingModifier = engineRef2?.current?.stakingModifier || 0;
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

            if (!isWin) {
              lossStreakRef.current += 1;
            } else {
              lossStreakRef.current = 0;
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
        setBot2State((prev) => ({ ...prev, isTrading: false }));
      }
    }
  };

  const nextStakeVal = engineRef2?.current?.getNextStake
    ? engineRef2.current.getNextStake(Number(minStake))
    : Number(minStake);

  const activeMarketLabel =
    VOLATILITY_MARKETS.find((m) => m.id === currentBlockSymbolRef.current)
      ?.label || currentBlockSymbolRef.current || "Unassigned";

  const currentUnitConfig = DURATION_UNITS.find((u) => u.id === durationUnit) || DURATION_UNITS[2];

  return (
    <div
      className={`bot-card premium-card ${
        bot2State.isTrading ? "active-trading" : ""
      }`}
    >
      <div className="bot-header">
        <div className="bot-title-group">
          <div className="title-with-badge">
            <h2>Nexus Dynamic Engine</h2>
            <span className="premium-badge">PREMIUM</span>
          </div>
          <span className="bot-subtitle">
            Single-Market Execution • Alternating PUT/CALL Strategy
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
            disabled={bot2State.isTrading || disabled}
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
            disabled={bot2State.isTrading || disabled}
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
              disabled={bot2State.isTrading || disabled}
              style={{ width: "60%" }}
            />
            <select
              value={durationUnit}
              onChange={handleDurationUnitChange}
              disabled={bot2State.isTrading || disabled}
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
            disabled={bot2State.isTrading || disabled}
          />
        </div>

        <div className="form-field">
          <label>Stop Loss ($ Max Loss, Default = 100x Stake)</label>
          <input
            type="number"
            step="1.00"
            min="0"
            placeholder={(minStake * 100).toFixed(2)}
            value={stopLoss}
            onChange={handleStopLossChange}
            disabled={bot2State.isTrading || disabled}
          />
        </div>
      </div>

      <div className="metrics-ribbon">
        <div className="metric-item">
          <span className="metric-label">Active Market</span>
          <span className="metric-value">{activeMarketLabel}</span>
        </div>
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
          <span className="metric-label">Running Balance</span>
          <span
            className={`metric-value ${
              (engineRef2?.current?.cycleRunningBalance || 0) >= 0
                ? "highlight-win"
                : "status-off"
            }`}
          >
            ${(engineRef2?.current?.cycleRunningBalance || 0).toFixed(2)}
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
        {!bot2State.isTrading ? (
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
              Start Nexus Engine
            </button>
          )
        ) : (
          <button onClick={stopBot} className="stop-btn">
            Stop Nexus Engine
          </button>
        )}
      </div>

      <div className="console-wrapper">
        <div className="console-title">Engine Terminal Output</div>
        <pre className="logs-console">
          {bot2State.logs.join("\n") ||
            "Nexus Engine standing by. Ready to launch trading session..."}
        </pre>
      </div>
    </div>
  );
}