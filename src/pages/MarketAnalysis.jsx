import React, { useState, useEffect } from "react";
import "./MarketAnalysis.css";

// Directly point to your live Render Flask endpoint
const API_ENDPOINT = "https://back-analysis.onrender.com/api/metrics";

export default function MarketAnalysis() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const rawJson = await response.json();
      const processedData = processAndSortMarketData(rawJson);
      setData(processedData);
    } catch (err) {
      console.error("Failed to fetch market metrics from Render:", err);
      setError("Unable to connect to analysis server. Displaying fallback stats.");
      setData(getFallbackData());
    } finally {
      setLoading(false);
    }
  };

  const processAndSortMarketData = (list) => {
    const rawList = Array.isArray(list) ? list : [];

    const processed = rawList.map((item) => {
      const symbol = item.symbol || item.code || "Unknown Asset";
      const wins = Number(item.wins || 0);
      const losses = Number(item.losses || 0);
      const total = Number(item.total || wins + losses) || 1;

      // Risk Probability (P_loss) calculation
      const pLoss = Number(((losses / total) * 100).toFixed(2));
      const pWin = Number((100 - pLoss).toFixed(2));

      // Determine Market Bias based on Risk Probability
      let bias = "NEUTRAL";
      let biasClass = "bias-neutral";

      if (pLoss >= 60.0) {
        bias = "STRONG BEARISH (PUT Optimal)";
        biasClass = "bias-bearish-strong";
      } else if (pLoss >= 54.0) {
        bias = "MODERATE BEARISH";
        biasClass = "bias-bearish";
      } else if (pLoss <= 40.0) {
        bias = "STRONG BULLISH (CALL Optimal)";
        biasClass = "bias-bullish-strong";
      } else if (pLoss <= 46.0) {
        bias = "MODERATE BULLISH";
        biasClass = "bias-bullish";
      }

      return { symbol, total, wins, losses, pLoss, pWin, bias, biasClass };
    });

    // Sort descending by Risk Probability (P_loss)
    return processed.sort((a, b) => b.pLoss - a.pLoss);
  };

  const getFallbackData = () => {
    const fallbackList = [
      { symbol: "Volatility 100 Index (R_100)", losses: 19, wins: 11, total: 30 },
      { symbol: "Volatility 10 Index (R_10)", losses: 18, wins: 12, total: 30 },
      { symbol: "Volatility 25 Index (R_25)", losses: 18, wins: 12, total: 30 },
      { symbol: "Volatility 75 Index (R_75)", losses: 17, wins: 13, total: 30 },
      { symbol: "Volatility 25 (1s) Index (1HZ25V)", losses: 17, wins: 13, total: 30 },
      { symbol: "Volatility 100 (1s) Index (1HZ100V)", losses: 15, wins: 15, total: 30 },
      { symbol: "Volatility 50 Index (R_50)", losses: 14, wins: 16, total: 30 },
      { symbol: "Volatility 10 (1s) Index (1HZ10V)", losses: 14, wins: 16, total: 30 },
      { symbol: "Volatility 75 (1s) Index (1HZ75V)", losses: 12, wins: 18, total: 30 },
      { symbol: "Volatility 50 (1s) Index (1HZ50V)", losses: 11, wins: 19, total: 30 },
    ];
    return processAndSortMarketData(fallbackList);
  };

  return (
    <div className="market-analysis-container">
      <div className="analysis-header">
        <h2>Market Risk Analysis & Bias Ranking</h2>
        <p className="subtitle">
          Real-time metrics sorted in <strong>Descending Order by Risk Probability (P_loss)</strong>.
        </p>
        <button onClick={fetchMarketData} className="refresh-btn" disabled={loading}>
          {loading ? "Syncing..." : "Sync Live Stats"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-wrapper">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Volatility Index</th>
              <th>Total Samples</th>
              <th>Wins (W)</th>
              <th>Losses (L)</th>
              <th>Win Ratio (P_win)</th>
              <th>Risk Probability (P_loss)</th>
              <th>Market Bias / Outlook</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((item, index) => (
                <tr key={item.symbol || index} className={index % 2 === 0 ? "even-row" : ""}>
                  <td className="rank-cell">#{index + 1}</td>
                  <td className="symbol-cell">{item.symbol}</td>
                  <td>{item.total}</td>
                  <td className="win-text">{item.wins}</td>
                  <td className="loss-text">{item.losses}</td>
                  <td>{item.pWin.toFixed(2)}%</td>
                  <td className="ploss-cell">{item.pLoss.toFixed(2)}%</td>
                  <td>
                    <span className={`bias-badge ${item.biasClass}`}>
                      {item.bias}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="no-data-cell">
                  {loading ? "Fetching live market metrics..." : "No market metrics available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}