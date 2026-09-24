import React from "react";
import { useTrading } from "../context/TradingContext";
import "./HistoryPage.css";

export const HistoryPage = () => {
  const { bot1State, bot2State } = useTrading();
  
  // Combine or select history from active bots with fallback
  const history = bot1State?.history?.length > 0 
    ? bot1State.history 
    : bot2State?.history || [];

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Trade History</h2>
      <div className="overflow-x-auto shadow rounded-lg border border-gray-200">
        <table className="w-full min-w-[800px] text-left border-collapse bg-white table-min-width">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="p-3 font-semibold text-gray-700">#</th>
              <th className="p-3 font-semibold text-gray-700">Block/Row</th>
              <th className="p-3 font-semibold text-gray-700">Outcome</th>
              <th className="p-3 font-semibold text-gray-700">Stake</th>
              <th className="p-3 font-semibold text-gray-700">P/L</th>
              <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Running Bal</th>
              <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Expected Profit</th>
              <th className="p-3 font-semibold text-gray-700">Status</th>
              <th className="p-3 font-semibold text-gray-700">Next Stake</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan="9" className="p-4 text-center text-gray-500">
                  No trade history available yet.
                </td>
              </tr>
            ) : (
              history.map((row, index) => {
                if (!row) return null;

                const totalTrade = row.totalTrade ?? row.id ?? index + 1;
                const blockRow = row.blockRow || row.row || "1/50";
                const outcome = row.outcome || row.result || "-";
                const stakeUsed = typeof row.stakeUsed === "number" ? row.stakeUsed : (typeof row.stake === "number" ? row.stake : 0);
                const profitLoss = typeof row.profitLoss === "number" ? row.profitLoss : (typeof row.pl === "number" ? row.pl : 0);
                
                // Fallbacks to handle various context naming formats
                const runningBalance = typeof row.runningBalance === "number" 
                  ? row.runningBalance 
                  : typeof row.runningBal === "number" 
                  ? row.runningBal 
                  : typeof row.balance === "number" 
                  ? row.balance 
                  : 0;

                const expectedProfit = typeof row.expectedProfit === "number" 
                  ? row.expectedProfit 
                  : typeof row.targetProfit === "number" 
                  ? row.targetProfit 
                  : 0;

                const nextStake = typeof row.nextStake === "number" ? row.nextStake : 0;
                const blockStatus = row.blockStatus || row.status || "Active";

                return (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3">{totalTrade}</td>
                    <td className="p-3">{blockRow}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                          outcome === "W" || outcome === "WIN"
                            ? "bg-green-100 text-green-800"
                            : outcome === "L" || outcome === "LOSS"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {outcome}
                      </span>
                    </td>
                    <td className="p-3">${stakeUsed.toFixed(2)}</td>
                    <td
                      className={`p-3 font-semibold ${
                        profitLoss >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {profitLoss >= 0 ? `+$${profitLoss.toFixed(2)}` : `-$${Math.abs(profitLoss).toFixed(2)}`}
                    </td>
                    <td className="p-3 font-medium whitespace-nowrap">${runningBalance.toFixed(2)}</td>
                    <td className="p-3 font-medium whitespace-nowrap">${expectedProfit.toFixed(2)}</td>
                    <td className="p-3 text-sm text-gray-600">{blockStatus}</td>
                    <td className="p-3 font-semibold text-blue-600">${nextStake.toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryPage;