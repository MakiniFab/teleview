import React, { useState, useEffect } from "react";
import "./MarketAnalysis.css";

const METRICS_ENDPOINT = "https://back-analysis.onrender.com/api/metrics";

export default function MarketAnalysis() {
  const [metricsData, setMetricsData] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState("Volatility 100 Index (R_100)");

  useEffect(() => {
    fetchMarketMetrics();
  }, []);

  const fetchMarketMetrics = async () => {
    setLoadingMetrics(true);
    setError(null);
    try {
      const response = await fetch(METRICS_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const rawJson = await response.json();
      const processed = processMarketData(rawJson);
      setMetricsData(processed);
      if (processed.length > 0) setSelectedAsset(processed[0].symbol);
    } catch (err) {
      console.error("Failed to fetch metrics, using fallback stats:", err);
      setError("Server connection offline. Displaying fallback metrics.");
      const fallback = getFallbackData();
      setMetricsData(fallback);
      setSelectedAsset(fallback[0].symbol);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const processMarketData = (list) => {
    const rawList = Array.isArray(list) ? list : [];
    return rawList.map((item) => {
      const symbol = item.symbol || item.code || "Unknown Asset";
      const wins = Number(item.wins || 0);
      const losses = Number(item.losses || 0);
      const total = Number(item.total || wins + losses) || 1;
      const pLoss = Number(((losses / total) * 100).toFixed(2));
      const pWin = Number((100 - pLoss).toFixed(2));

      let bias = "NEUTRAL";
      let biasClass = "bias-neutral";

      if (pLoss >= 60.0) {
        bias = "STRONG BEARISH (PUT)";
        biasClass = "bias-bearish-strong";
      } else if (pLoss >= 54.0) {
        bias = "MODERATE BEARISH";
        biasClass = "bias-bearish";
      } else if (pLoss <= 40.0) {
        bias = "STRONG BULLISH (CALL)";
        biasClass = "bias-bullish-strong";
      } else if (pLoss <= 46.0) {
        bias = "MODERATE BULLISH";
        biasClass = "bias-bullish";
      }

      return { symbol, total, pLoss, pWin, bias, biasClass };
    }).sort((a, b) => b.pLoss - a.pLoss);
  };

  const getFallbackData = () => {
    const fallbackList = [
      { symbol: "Volatility 100 Index (R_100)", losses: 19, wins: 11, total: 30 },
      { symbol: "Volatility 100 (1s) Index (1HZ100V)", losses: 17, wins: 16, total: 33 },
      { symbol: "Volatility 25 Index (R_25)", losses: 18, wins: 12, total: 30 },
      { symbol: "Volatility 75 (1s) Index (1HZ75V)", losses: 17, wins: 13, total: 30 },
      { symbol: "Volatility 25 (1s) Index (1HZ25V)", losses: 17, wins: 13, total: 30 },
      { symbol: "Volatility 50 Index (R_50)", losses: 14, wins: 16, total: 30 },
      { symbol: "Volatility 10 (1s) Index (1HZ10V)", losses: 14, wins: 16, total: 30 },
      { symbol: "Volatility 10 Index (R_10)", losses: 18, wins: 12, total: 30 },
      { symbol: "Volatility 75 Index (R_75)", losses: 17, wins: 13, total: 30 },
      { symbol: "Volatility 50 (1s) Index (1HZ50V)", losses: 11, wins: 19, total: 30 },
    ];
    return processMarketData(fallbackList);
  };

  return (
    <div className="market-analysis-container">
      <div className="analysis-header">
        <div>
          <h2>Risk Probability Index & Market Bias</h2>
          <p className="subtitle">
            Visual risk probability metrics and market direction analysis across synthetic volatility indices.
          </p>
        </div>
        <button onClick={fetchMarketMetrics} className="refresh-btn" disabled={loadingMetrics}>
          {loadingMetrics ? "Syncing..." : "Sync Live Metrics"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Probability Visual Bar Chart Table */}
      <div className="table-wrapper">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Volatility Index</th>
              <th>Win Ratio (P_win)</th>
              <th>Risk Probability (P_loss)</th>
              <th>Win vs Risk Distribution Chart</th>
              <th>Bias</th>
            </tr>
          </thead>
          <tbody>
            {metricsData.map((item, index) => (
              <tr
                key={item.symbol || index}
                className={selectedAsset === item.symbol ? "selected-row" : ""}
                onClick={() => setSelectedAsset(item.symbol)}
              >
                <td className="rank-cell">#{index + 1}</td>
                <td className="symbol-cell">{item.symbol}</td>
                <td className="pwin-cell">{item.pWin.toFixed(2)}%</td>
                <td className="ploss-cell">{item.pLoss.toFixed(2)}%</td>
                <td className="chart-bar-cell">
                  {/* Inline visual distribution bar */}
                  <div className="bar-container">
                    <div
                      className="bar-win"
                      style={{ width: `${item.pWin}%` }}
                      title={`Win Rate: ${item.pWin}%`}
                    />
                    <div
                      className="bar-loss"
                      style={{ width: `${item.pLoss}%` }}
                      title={`Risk Loss: ${item.pLoss}%`}
                    />
                  </div>
                </td>
                <td>
                  <span className={`bias-badge ${item.biasClass}`}>{item.bias}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}