"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useKDSStore } from "@/lib/kdsStore";

export function useKDSSocket(restaurantId: string | undefined) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const { handleRealtimeKdsEvent } = useKDSStore();

  const connect = useCallback(() => {
    if (!restaurantId || typeof window === "undefined") return;

    const isHttps = window.location.protocol === "https:";
    const host =
      window.location.hostname === "localhost"
        ? "127.0.0.1"
        : window.location.hostname;
    const defaultHost = `${host}:8000`;
    const wsBase =
      process.env.NEXT_PUBLIC_WS_URL || `${isHttps ? "wss" : "ws"}://${defaultHost}`;

    const wsUrl = `${wsBase}/ws/kds/${restaurantId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        retryCountRef.current = 0;

        // 15-second heartbeat ping
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 15000);
      };

      ws.onmessage = (evt) => {
        if (evt.data === "pong") return;
        try {
          const data = JSON.parse(evt.data);
          handleRealtimeKdsEvent(data);
        } catch {
          // ignore non-json frames
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        const backoffMs = Math.min(
          1000 * Math.pow(2, retryCountRef.current),
          10000
        );
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      const backoffMs = Math.min(
        1000 * Math.pow(2, retryCountRef.current),
        10000
      );
      retryCountRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoffMs);
    }
  }, [restaurantId, handleRealtimeKdsEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, reconnect: connect };
}
