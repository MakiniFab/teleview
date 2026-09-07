import { useEffect, useState, useRef } from 'react';

const PUBLIC_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

export function usePublicMarket(symbol = 'R_100') {
  const [ticks, setTicks] = useState([]);
  const [activeSymbols, setActiveSymbols] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(PUBLIC_WS_URL);

    ws.current.onopen = () => {
      setIsConnected(true);
      // Request active symbols
      ws.current.send(JSON.stringify({ active_symbols: 'brief', product_type: 'basic' }));
      // Subscribe to symbol ticks
      ws.current.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'active_symbols') {
          setActiveSymbols(data.active_symbols || []);
        }
        if (data.msg_type === 'tick' && data.tick) {
          setTicks((prev) => [...prev.slice(-19), data.tick]);
        }
      } catch (e) {
        console.error('Error parsing public market socket data:', e);
      }
    };

    ws.current.onclose = () => setIsConnected(false);

    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [symbol]);

  return { isConnected, ticks, activeSymbols };
}