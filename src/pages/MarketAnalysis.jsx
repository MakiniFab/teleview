import React, { useEffect, useState } from "react";

const WS_URL =
  "wss://api.derivws.com/trading/v1/options/ws/public";

const MARKETS = [
  {
    id: "R_10",
    label: "Volatility 10 Index",
  },
  {
    id: "R_25",
    label: "Volatility 25 Index",
  },
  {
    id: "R_50",
    label: "Volatility 50 Index",
  },
  {
    id: "R_75",
    label: "Volatility 75 Index",
  },
  {
    id: "R_100",
    label: "Volatility 100 Index",
  },
];

const CANDLE_COUNT = 20;
const GRANULARITY = 120; // 2 minutes

function MarketAnalysis() {
  const [markets, setMarkets] = useState({});
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    let ws;
    let cancelled = false;

    const fetchMarkets = () => {
      if (cancelled) return;

      setLoading(true);
      setConnectionError("");

      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log("Market WebSocket connected");

        /*
         * Fetch each market individually.
         */
        MARKETS.forEach((market, index) => {
          ws.send(
            JSON.stringify({
              ticks_history: market.id,

              /*
               * We need 20 complete 2-minute candles.
               *
               * Request slightly more history so the response
               * can contain enough candles around the current time.
               */
              end: "latest",
              count: CANDLE_COUNT,
              style: "candles",
              granularity: GRANULARITY,

              req_id: index + 1,
            })
          );
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          console.log("Deriv response:", message);

          if (message.error) {
            console.error(
              "Deriv error:",
              message.error.message
            );

            return;
          }

          if (message.msg_type !== "candles") {
            return;
          }

          const symbol = message.echo_req?.ticks_history;

          if (!symbol) {
            return;
          }

          const candles = (message.candles || [])
            .map((candle) => {
              const open = Number(candle.open);
              const high = Number(candle.high);
              const low = Number(candle.low);
              const close = Number(candle.close);

              let direction = "F";

              if (close > open) {
                direction = "R";
              } else if (close < open) {
                direction = "F";
              } else {
                direction = "FLAT";
              }

              return {
                epoch: Number(candle.epoch),
                open,
                high,
                low,
                close,
                direction,
              };
            })
            .sort((a, b) => a.epoch - b.epoch)
            .slice(-CANDLE_COUNT);

          const riseCount = candles.filter(
            (candle) => candle.direction === "R"
          ).length;

          const fallCount = candles.filter(
            (candle) => candle.direction === "F"
          ).length;

          const flatCount = candles.filter(
            (candle) => candle.direction === "FLAT"
          ).length;

          const total = candles.length;

          const risePercentage =
            total > 0
              ? ((riseCount / total) * 100).toFixed(1)
              : "0.0";

          const fallPercentage =
            total > 0
              ? ((fallCount / total) * 100).toFixed(1)
              : "0.0";

          setMarkets((previous) => ({
            ...previous,

            [symbol]: {
              candles,
              riseCount,
              fallCount,
              flatCount,
              risePercentage,
              fallPercentage,
              total,
              receivedAt: new Date(),
            },
          }));
        } catch (error) {
          console.error(
            "Unable to process market response:",
            error
          );
        }
      };

      ws.onerror = (error) => {
        console.error(
          "Market WebSocket error:",
          error
        );

        setConnectionError(
          "Unable to connect to Deriv market data."
        );

        setLoading(false);
      };

      ws.onclose = () => {
        console.log(
          "Market WebSocket closed"
        );

        setLoading(false);
      };
    };

    fetchMarkets();

    return () => {
      cancelled = true;

      if (ws) {
        ws.close();
      }
    };
  }, []);

  const formatTime = (epoch) => {
    return new Date(epoch * 1000).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const formatPrice = (price) => {
    return Number(price).toFixed(2);
  };

  const getDirectionClass = (direction) => {
    if (direction === "R") {
      return "rise";
    }

    if (direction === "F") {
      return "fall";
    }

    return "flat";
  };

  return (
    <div className="market-analysis">

      <style>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        .market-analysis {
          min-height: 100vh;
          padding: 30px;
          background: #0b1120;
          color: #e5e7eb;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .container {
          width: 100%;
          max-width: 1400px;
          margin: auto;
        }

        .page-header {
          margin-bottom: 30px;
        }

        .page-header h1 {
          margin: 0;
          color: #f8fafc;
          font-size: 30px;
          font-weight: 700;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #94a3b8;
          font-size: 14px;
        }

        .connection-status {
          margin-top: 15px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: #111827;
          border: 1px solid #1f2937;
          color: #94a3b8;
          font-size: 12px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #64748b;
        }

        .status-dot.connected {
          background: #22c55e;
          box-shadow:
            0 0 8px
            rgba(34, 197, 94, 0.6);
        }

        .error {
          margin-bottom: 20px;
          padding: 15px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid
            rgba(239, 68, 68, 0.25);
          color: #fca5a5;
        }

        /*
         * MARKET SUMMARY
         */

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .summary-card {
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 14px;
          padding: 18px;
        }

        .summary-title {
          color: #f8fafc;
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 5px;
        }

        .summary-symbol {
          color: #64748b;
          font-size: 12px;
          margin-bottom: 18px;
        }

        .counts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .count-box {
          padding: 12px;
          border-radius: 9px;
          text-align: center;
        }

        .rise-box {
          background:
            rgba(34, 197, 94, 0.08);
          border: 1px solid
            rgba(34, 197, 94, 0.15);
        }

        .fall-box {
          background:
            rgba(239, 68, 68, 0.08);
          border: 1px solid
            rgba(239, 68, 68, 0.15);
        }

        .count-number {
          font-size: 25px;
          font-weight: 700;
        }

        .rise-number {
          color: #4ade80;
        }

        .fall-number {
          color: #f87171;
        }

        .count-label {
          margin-top: 3px;
          font-size: 11px;
          color: #64748b;
        }

        .percentage {
          display: flex;
          justify-content: space-between;
          margin-top: 14px;
          font-size: 12px;
        }

        .percentage-rise {
          color: #4ade80;
        }

        .percentage-fall {
          color: #f87171;
        }

        /*
         * MARKET SECTIONS
         */

        .market-section {
          margin-bottom: 25px;
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 14px;
          overflow: hidden;
        }

        .market-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid #1f2937;
        }

        .market-name {
          color: #f8fafc;
          font-size: 17px;
          font-weight: 650;
        }

        .market-id {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .market-stats {
          display: flex;
          align-items: center;
          gap: 15px;
          font-size: 12px;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 700px;
        }

        th {
          padding: 12px 18px;
          background: #0f172a;
          color: #64748b;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        td {
          padding: 12px 18px;
          border-top: 1px solid #1f2937;
          color: #cbd5e1;
          font-size: 13px;
        }

        tr:hover td {
          background: #172033;
        }

        .price {
          font-variant-numeric:
            tabular-nums;
        }

        .direction {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          min-width: 34px;
          padding: 4px 8px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 11px;
        }

        .direction.rise {
          color: #4ade80;
          background:
            rgba(34, 197, 94, 0.1);
        }

        .direction.fall {
          color: #f87171;
          background:
            rgba(239, 68, 68, 0.1);
        }

        .direction.flat {
          color: #94a3b8;
          background:
            rgba(148, 163, 184, 0.1);
        }

        .loading {
          padding: 40px;
          text-align: center;
          color: #64748b;
        }

        .no-data {
          padding: 25px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
        }

        /*
         * RESPONSIVE
         */

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 750px) {
          .market-analysis {
            padding: 18px;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .market-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }
        }

        @media (max-width: 500px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .page-header h1 {
            font-size: 24px;
          }
        }

      `}</style>

      <div className="container">

        {/* HEADER */}

        <div className="page-header">

          <h1>
            Market Analysis
          </h1>

          <p>
            Last 20 two-minute candles across
            five volatility indices
          </p>

          <div className="connection-status">

            <span
              className={`status-dot ${
                Object.keys(markets).length ===
                MARKETS.length
                  ? "connected"
                  : ""
              }`}
            />

            {loading
              ? "Fetching market data..."
              : `${Object.keys(markets).length}/5 markets loaded`}
          </div>

        </div>

        {/* ERROR */}

        {connectionError && (
          <div className="error">
            {connectionError}
          </div>
        )}

        {/* SUMMARY */}

        <div className="summary-grid">

          {MARKETS.map((market) => {

            const data = markets[market.id];

            return (
              <div
                className="summary-card"
                key={market.id}
              >

                <div className="summary-title">
                  {market.label}
                </div>

                <div className="summary-symbol">
                  {market.id}
                </div>

                {!data ? (
                  <div className="no-data">
                    Loading...
                  </div>
                ) : (
                  <>
                    <div className="counts">

                      <div className="count-box rise-box">

                        <div
                          className="
                            count-number
                            rise-number
                          "
                        >
                          {data.riseCount}
                        </div>

                        <div className="count-label">
                          RISE
                        </div>

                      </div>

                      <div className="count-box fall-box">

                        <div
                          className="
                            count-number
                            fall-number
                          "
                        >
                          {data.fallCount}
                        </div>

                        <div className="count-label">
                          FALL
                        </div>

                      </div>

                    </div>

                    <div className="percentage">

                      <span
                        className="percentage-rise"
                      >
                        Rise {data.risePercentage}%
                      </span>

                      <span
                        className="percentage-fall"
                      >
                        Fall {data.fallPercentage}%
                      </span>

                    </div>

                  </>
                )}

              </div>
            );

          })}

        </div>

        {/* INDIVIDUAL MARKET TABLES */}

        {MARKETS.map((market) => {

          const data = markets[market.id];

          return (
            <div
              className="market-section"
              key={market.id}
            >

              <div className="market-header">

                <div>
                  <div className="market-name">
                    {market.label}
                  </div>

                  <div className="market-id">
                    {market.id} · 2-minute candles
                  </div>
                </div>

                {data && (
                  <div className="market-stats">

                    <span className="percentage-rise">
                      R {data.riseCount}
                    </span>

                    <span className="percentage-fall">
                      F {data.fallCount}
                    </span>

                    <span>
                      {data.total}/20
                    </span>

                  </div>
                )}

              </div>

              {!data ? (
                <div className="loading">
                  Loading {market.label}...
                </div>
              ) : (
                <div className="table-wrapper">

                  <table>

                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Time</th>
                        <th>Open</th>
                        <th>High</th>
                        <th>Low</th>
                        <th>Close</th>
                        <th>Direction</th>
                      </tr>
                    </thead>

                    <tbody>

                      {data.candles.map(
                        (candle, index) => (

                          <tr
                            key={candle.epoch}
                          >

                            <td>
                              {index + 1}
                            </td>

                            <td>
                              {formatTime(
                                candle.epoch
                              )}
                            </td>

                            <td className="price">
                              {formatPrice(
                                candle.open
                              )}
                            </td>

                            <td className="price">
                              {formatPrice(
                                candle.high
                              )}
                            </td>

                            <td className="price">
                              {formatPrice(
                                candle.low
                              )}
                            </td>

                            <td className="price">
                              {formatPrice(
                                candle.close
                              )}
                            </td>

                            <td>

                              <span
                                className={`
                                  direction
                                  ${getDirectionClass(
                                    candle.direction
                                  )}
                                `}
                              >
                                {candle.direction}
                              </span>

                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>
              )}

            </div>
          );

        })}

      </div>

    </div>
  );
}

export default MarketAnalysis;