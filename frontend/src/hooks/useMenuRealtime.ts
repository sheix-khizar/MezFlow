"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface RealtimeMenuEvent {
  event: "ITEM_AVAILABILITY_CHANGED" | "MENU_ITEM_UPDATED" | "CATEGORY_UPDATED" | "CONNECTED";
  item_id?: string;
  category_id?: string;
  is_available?: boolean;
  price?: number;
  name?: string;
  updated_at?: string;
}

export function useMenuRealtime(
  restaurantId: string | undefined,
  onEvent?: (event: RealtimeMenuEvent) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeMenuEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    if (!restaurantId || typeof window === "undefined") return;

    // Build WS URL
    const isHttps = window.location.protocol === "https:";
    const host =
      window.location.hostname === "localhost"
        ? "127.0.0.1"
        : window.location.hostname;
    const defaultHost = `${host}:8000`;
    const wsBase =
      process.env.NEXT_PUBLIC_WS_URL || `${isHttps ? "wss" : "ws"}://${defaultHost}`;
    const wsUrl = `${wsBase}/ws/restaurants/${restaurantId}/menu`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        retryCountRef.current = 0;

        // Keep-alive heartbeat ping every 25 seconds
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        if (evt.data === "pong") return;
        try {
          const data: RealtimeMenuEvent = JSON.parse(evt.data);
          setLastEvent(data);
          if (onEvent) {
            onEvent(data);
          }
        } catch {
          // Ignore non-json frames
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Exponential backoff reconnect: 1s, 2s, 4s, max 10s
        const backoffMs = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Reconnect on immediate failure
      const backoffMs = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
      retryCountRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoffMs);
    }
  }, [restaurantId, onEvent]);

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

  return { isConnected, lastEvent };
}
