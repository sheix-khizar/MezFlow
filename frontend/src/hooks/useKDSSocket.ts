"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useKDSStore } from "@/lib/kdsStore";
import { getWebSocketBaseUrl } from "@/lib/ws";
import { audioAlerts } from "@/lib/audioAlerts";

export function useKDSSocket(restaurantId: string | undefined) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingBusyRef = useRef(false);
  const retryCountRef = useRef(0);
  const prevOrderCountRef = useRef<number | null>(null);

  const { handleRealtimeKdsEvent, fetchActiveOrders, fetchSummary } = useKDSStore();

  // Active HTTP Polling Fallback (Runs when WebSocket is disconnected or on serverless)
  const pollFallbackTick = useCallback(async () => {
    if (!restaurantId || isPollingBusyRef.current) return;
    isPollingBusyRef.current = true;
    try {
      // Silent fetch prevents loading skeleton flash every 3s
      await fetchActiveOrders(true);
      await fetchSummary();

      const currentOrders = useKDSStore.getState().orders;
      if (
        prevOrderCountRef.current !== null &&
        currentOrders.length > prevOrderCountRef.current
      ) {
        audioAlerts.playNewOrderChime();
      }
      prevOrderCountRef.current = currentOrders.length;
    } catch {
      // Quiet polling fallback
    } finally {
      isPollingBusyRef.current = false;
    }
  }, [restaurantId, fetchActiveOrders, fetchSummary]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
    if (!pollIntervalRef.current) {
      pollFallbackTick();
      pollIntervalRef.current = setInterval(pollFallbackTick, 3000);
    }
  }, [pollFallbackTick]);

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
    const wsUrl = `${wsBase}/ws/kds/${restaurantId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        stopPolling();
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
          // Sync order count tracker
          prevOrderCountRef.current = useKDSStore.getState().orders.length;
        } catch {
          // ignore non-json frames
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        startPolling();
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
      setIsConnected(false);
      startPolling();
      const backoffMs = Math.min(
        1000 * Math.pow(2, retryCountRef.current),
        10000
      );
      retryCountRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoffMs);
    }
  }, [restaurantId, handleRealtimeKdsEvent, startPolling, stopPolling]);

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

  return { isConnected, isPolling, reconnect: connect };
}
