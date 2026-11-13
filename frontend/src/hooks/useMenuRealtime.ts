"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getWebSocketBaseUrl } from "@/lib/ws";

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
  onEvent?: (event: RealtimeMenuEvent) => void,
  onPollFallback?: () => Promise<void> | void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeMenuEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingBusyRef = useRef(false);
  const retryCountRef = useRef(0);

  // Active HTTP Polling Fallback (Runs when WebSocket is disconnected or on serverless)
  const pollFallbackTick = useCallback(async () => {
    if (!restaurantId || !onPollFallback || isPollingBusyRef.current) return;
    isPollingBusyRef.current = true;
    try {
      await onPollFallback();
    } catch {
      // Quiet polling fallback
    } finally {
      isPollingBusyRef.current = false;
    }
  }, [restaurantId, onPollFallback]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
    if (!pollIntervalRef.current && onPollFallback) {
      pollFallbackTick();
      pollIntervalRef.current = setInterval(pollFallbackTick, 4000);
    }
  }, [pollFallbackTick, onPollFallback]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!restaurantId || typeof window === "undefined") return;

    const wsBase = getWebSocketBaseUrl();
    const wsUrl = `${wsBase}/ws/restaurants/${restaurantId}/menu`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        stopPolling();
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
        startPolling();
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

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
      setIsConnected(false);
      startPolling();
      const backoffMs = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
      retryCountRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoffMs);
    }
  }, [restaurantId, onEvent, startPolling, stopPolling]);

  useEffect(() => {
    connect();

    return () => {
      stopPolling();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, stopPolling]);

  return { isConnected, isPolling, lastEvent };
}
