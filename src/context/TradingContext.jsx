import React, { createContext, useContext, useEffect, useRef, useState } from "react";

const API_BASE = "https://api.derivws.com";
const APP_ID = "34sztETpkcwjcAayV9upz";
const CURRENCY = "USD";
const PAT_STORAGE_KEY = "deriv_pat_token";
const PAT_EXPIRY_KEY = "deriv_pat_expiry";
const ACCOUNT_TYPE_KEY = "deriv_account_type";
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export class StakingEngine {
  constructor({ minStake = 1.00, ratio = 1.5, targetReturnRate = 0.55, standardTargetWins = 25, blockRowLimit = 50 } = {}) {
    this.MIN_STAKE = minStake;
    this.RATIO = ratio;
    this.TARGET_RETURN_RATE = targetReturnRate;
    this.STANDARD_TARGET_WINS = standardTargetWins;
    this.BLOCK_ROW_LIMIT = blockRowLimit;

    this.bankedWins = 0;
    this.totalLosses = 0;
    this.cycleRunningBalance = 0.0;
    this.pendingWinDebt = 0;
    this.blockNum = 1;
    this.posInBlock = 1;
    this.consecutiveLosses = 0;
    this.totalTradeCount = 0;

    this.stakingModifier = 0;
  }

  getNextStake(customMinStake) {
    if (customMinStake !== undefined) this.MIN_STAKE = Number(customMinStake);

    const subtotal = this.cycleRunningBalance;
    const rawExpected = this.totalLosses > 0 ? this.totalLosses / this.RATIO : 1.0;
    const expectedWins = Math.max(1, Math.ceil(rawExpected));

    let finalStake = 0;

    if (expectedWins > this.bankedWins) {
      const remWins = expectedWins - this.bankedWins;
      let rawStake = (((expectedWins * 0.45) - subtotal) / remWins) * 1.1;

      if (rawStake >= 8.00) {
        this.stakingModifier = 2;
      } else if (rawStake > 3.00 && this.stakingModifier === 0) {
        this.stakingModifier = 1;
      }

      const effectiveDenominator = remWins + this.stakingModifier;
      finalStake = (((expectedWins * 0.45) - subtotal) / effectiveDenominator) * 1.1;
    } else {
      let divisor = this.stakingModifier > 0 ? this.stakingModifier : 1;
      let rawStake = (((this.bankedWins * 0.45) - subtotal) / divisor) * 1.1;

      if (rawStake >= 8.00) {
        this.stakingModifier = 2;
        divisor = 2;
      } else if (rawStake > 3.00 && this.stakingModifier === 0) {
        this.stakingModifier = 1;
        divisor = 1;
      }

      finalStake = (((this.bankedWins * 0.45) - subtotal) / divisor) * 1.1;
    }

    finalStake = Math.max(this.MIN_STAKE, finalStake);
    return Number(finalStake.toFixed(2));
  }

  processOutcome(realizedProfitLoss, stakeUsed, customMinStake) {
    const isWin = realizedProfitLoss > 0;
    this.totalTradeCount += 1;

    if (isWin) {
      this.bankedWins += 1;
      this.consecutiveLosses = 0;
    } else {
      this.totalLosses += 1;
      this.consecutiveLosses += 1;
    }

    this.cycleRunningBalance += realizedProfitLoss;

    const rawExpected = this.totalLosses > 0 ? this.totalLosses / this.RATIO : 1.0;
    const expectedWins = Math.max(1, Math.ceil(rawExpected));
    const effectiveWinsTarget = this.bankedWins >= expectedWins ? this.bankedWins : expectedWins;
    const expectedProfit = effectiveWinsTarget * 0.45;

    let blockEnded = false;
    let blockStatus = "Active";

    if (this.bankedWins >= this.STANDARD_TARGET_WINS) {
      blockEnded = true;
      blockStatus = "WIN";
      this.pendingWinDebt = Math.max(0, this.pendingWinDebt - this.STANDARD_TARGET_WINS);
    } else if (this.posInBlock >= this.BLOCK_ROW_LIMIT) {
      blockEnded = true;
      blockStatus = "LOSS";
      const unrecoveredWins = this.STANDARD_TARGET_WINS - this.bankedWins;
      this.pendingWinDebt += unrecoveredWins;
    }

    const currentBlockNum = this.blockNum;
    const currentPosInBlock = this.posInBlock;

    if (blockEnded) {
      this.bankedWins = 0;
      this.totalLosses = 0;
      this.cycleRunningBalance = 0.0;
      this.consecutiveLosses = 0;
      this.stakingModifier = 0;
      this.blockNum += 1;
      this.posInBlock = 1;
    } else {
      this.posInBlock += 1;
    }

    const nextStake = this.getNextStake(customMinStake);

    return {
      totalTrade: this.totalTradeCount,
      blockNum: currentBlockNum,
      blockRow: `${currentPosInBlock}/${this.BLOCK_ROW_LIMIT}`,
      outcome: isWin ? "W" : "L",
      blockLosses: this.totalLosses,
      blockWins: this.bankedWins,
      consecLosses: this.consecutiveLosses,
      expectedWins,
      expectedProfit: Number(expectedProfit.toFixed(2)),
      stakeUsed,
      profitLoss: realizedProfitLoss,
      runningBalance: Number(this.cycleRunningBalance.toFixed(2)),
      blockStatus: `${blockStatus} ${this.pendingWinDebt} Wins`,
      pendingWinDebt: this.pendingWinDebt,
      nextStake,
    };
  }
}

const TradingContext = createContext();

export const TradingProvider = ({ children }) => {
  const [patToken, setPatToken] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [accountType, setAccountType] = useState(() => {
    return localStorage.getItem(ACCOUNT_TYPE_KEY) || "demo";
  });
  const [accountsList, setAccountsList] = useState([]);
  const [accountData, setAccountData] = useState({ name: "", account: "", balance: 0.0, currency: CURRENCY });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Not connected");

  const [bot1State, setBot1State] = useState({ isTrading: false, logs: [], history: [], contract: null });
  const [bot2State, setBot2State] = useState({ isTrading: false, logs: [], history: [], contract: null });

  const wsRef1 = useRef(null);
  const wsRef2 = useRef(null);
  const engineRef1 = useRef(new StakingEngine({ minStake: 1.00 }));
  const engineRef2 = useRef(new StakingEngine({ minStake: 1.00 }));

  const saveTokenWithExpiry = (token) => {
    localStorage.setItem(PAT_STORAGE_KEY, token);
    localStorage.setItem(PAT_EXPIRY_KEY, (Date.now() + THREE_HOURS_MS).toString());
    setPatToken(token);
  };

  const clearTokenStorage = () => {
    localStorage.removeItem(PAT_STORAGE_KEY);
    localStorage.removeItem(PAT_EXPIRY_KEY);
    setPatToken("");
  };

  const readJsonResponse = async (response) => {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  const applySelectedAccount = (accounts, targetType) => {
    let matched = accounts.find((item) => String(item?.account_type).toLowerCase() === targetType);
    if (!matched) matched = accounts[0];

    if (matched) {
      const selectedType = matched.account_type.toLowerCase();
      setAccountType(selectedType);
      localStorage.setItem(ACCOUNT_TYPE_KEY, selectedType);
      setAccountData({
        name: matched.account_id,
        account: matched.account_id,
        balance: parseFloat(matched.balance) || 0.0,
        currency: matched.currency || CURRENCY,
      });
    }
  };

  const handleConnect = async (tokenToUse, targetType = accountType) => {
    const cleanToken = (tokenToUse || patToken).trim();
    if (!cleanToken) {
      setError("Please enter your Deriv PAT.");
      return;
    }
    setError("");
    setStatus("Connecting...");

    try {
      const response = await fetch(`${API_BASE}/trading/v1/options/accounts`, {
        headers: { Authorization: `Bearer ${cleanToken}`, "Deriv-App-ID": APP_ID },
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) throw new Error(payload?.error?.message || "Authentication failed.");

      const accountsArray = Array.isArray(payload?.data?.data)
        ? payload.data.data
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      if (accountsArray.length === 0) {
        throw new Error("No trading accounts found for this token.");
      }

      setAccountsList(accountsArray);
      applySelectedAccount(accountsArray, targetType);

      saveTokenWithExpiry(cleanToken);
      setIsConnected(true);
      setStatus("Connected successfully");
    } catch (err) {
      setError(err.message);
      setStatus("Connection failed");
      setIsConnected(false);
      clearTokenStorage();
    }
  };

  // Auto-connect on page refresh / initial load if stored PAT token is valid
  useEffect(() => {
    const storedToken = localStorage.getItem(PAT_STORAGE_KEY);
    const storedExpiry = localStorage.getItem(PAT_EXPIRY_KEY);
    const storedAccountType = localStorage.getItem(ACCOUNT_TYPE_KEY) || "demo";

    if (storedToken && storedExpiry && Date.now() < Number(storedExpiry)) {
      setPatToken(storedToken);
      handleConnect(storedToken, storedAccountType);
    } else {
      clearTokenStorage();
    }
  }, []);

  const switchAccount = (newType) => {
    const cleanType = newType.toLowerCase();
    setAccountType(cleanType);
    localStorage.setItem(ACCOUNT_TYPE_KEY, cleanType);
    if (accountsList.length > 0) {
      applySelectedAccount(accountsList, cleanType);
    } else if (patToken) {
      handleConnect(patToken, cleanType);
    }
  };

  const handleDisconnect = () => {
    clearTokenStorage();
    setIsConnected(false);
    setAccountsList([]);
    if (wsRef1.current) wsRef1.current.close();
    if (wsRef2.current) wsRef2.current.close();
    setBot1State((prev) => ({ ...prev, isTrading: false }));
    setBot2State((prev) => ({ ...prev, isTrading: false }));
    setStatus("Disconnected");
  };

  return (
    <TradingContext.Provider
      value={{
        patToken, setPatToken, isConnected, accountType, setAccountType, accountsList, accountData, error, status,
        handleConnect, handleDisconnect, switchAccount,
        bot1State, setBot1State, wsRef1, engineRef1,
        bot2State, setBot2State, wsRef2, engineRef2,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = () => useContext(TradingContext);