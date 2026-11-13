"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCartStore } from "@/lib/cartStore";
import { getWebSocketBaseUrl } from "@/lib/ws";
import apiClient from "@/lib/api";

export interface SessionRealtimeEvent {
  event:
    | "CONNECTED"
    | "DINER_JOINED"
    | "CART_UPDATED"
    | "CART_CLEARED"
    | "ORDER_SUBMITTED"
    | "ORDER_STATUS_CHANGED";
  session_id?: string;
  order_id?: string;
  action?: string;
  actor_diner_name?: string;
  cart_total?: number;
  cart_item_count?: number;
  diner?: {
    id: string;
    display_name: string;
    avatar_color: string;
    is_host: boolean;
  };
  active_diners_count?: number;
  order_number?: number;
  display_number?: string;
  new_status?: string;
  placed_by?: string;
}

export function useTableSession(
  sessionId: string | undefined,
  dinerId: string | undefined,
  onOrderSubmitted?: (evt: SessionRealtimeEvent) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lastEvent, setLastEvent] = useState<SessionRealtimeEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingBusyRef = useRef(false);
  const retryCountRef = useRef(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  const { fetchCart, addOrUpdateDiner, notify, setCart } = useCartStore();

  // Seed existing orders on session load so pre-existing orders don't re-trigger notification
  useEffect(() => {
    if (!sessionId) return;
    apiClient
      .get<any[]>(`/sessions/${sessionId}/orders`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          res.data.forEach((o) => {
            if (o?.id) knownOrderIdsRef.current.add(o.id);
          });
        }
      })
      .catch(() => {});
  }, [sessionId]);

  const handleMessage = useCallback(
    (evt: MessageEvent) => {
      if (evt.data === "pong") return;

      try {
        const data: SessionRealtimeEvent = JSON.parse(evt.data);
        setLastEvent(data);

        switch (data.event) {
          case "CONNECTED":
            break;

          case "DINER_JOINED":
            if (data.diner) {
              addOrUpdateDiner({
                id: data.diner.id,
                session_id: sessionId || "",
                display_name: data.diner.display_name,
                avatar_color: data.diner.avatar_color,
                client_session_id: "",
                is_host: data.diner.is_host,
                is_active: true,
                joined_at: new Date().toISOString(),
              });
              if (data.diner.id !== dinerId) {
                notify(`${data.diner.display_name} joined the table 👋`, "info");
              }
            }
            break;

          case "CART_UPDATED":
            if (sessionId) {
              fetchCart(sessionId, dinerId, true).catch(() => {});
            }
            if (data.actor_diner_name) {
              const actionText =
                data.action === "ITEM_REMOVED"
                  ? "removed an item from"
                  : data.action === "ITEM_UPDATED"
                  ? "updated an item in"
                  : "added an item to";
              notify(`${data.actor_diner_name} ${actionText} the cart`, "info");
            }
            break;

          case "CART_CLEARED":
            if (sessionId) {
              fetchCart(sessionId, dinerId, true).catch(() => {});
            }
            if (data.actor_diner_name) {
              notify(`${data.actor_diner_name} cleared the cart`, "info");
            }
            break;

          case "ORDER_SUBMITTED":
            if (data.order_id) {
              knownOrderIdsRef.current.add(data.order_id);
            }
            setCart(null);
            notify(
              `Order ${data.display_number || ""} submitted by ${
                data.placed_by || "a diner"
              }! 🚀`,
              "success"
            );
            if (onOrderSubmitted) {
              onOrderSubmitted(data);
            }
            break;

          case "ORDER_STATUS_CHANGED":
            notify(
              `Order #${data.order_number} is now ${data.new_status} 🍽️`,
              "info"
            );
            break;

          default:
            break;
        }
      } catch (e) {
        // Non-JSON frame
      }
    },
    [sessionId, dinerId, fetchCart, addOrUpdateDiner, notify, setCart, onOrderSubmitted]
  );

  // Active HTTP Polling Fallback (Runs when WebSocket is disconnected or on serverless)
  const pollFallbackTick = useCallback(async () => {
    if (!sessionId || isPollingBusyRef.current) return;
    isPollingBusyRef.current = true;
    try {
      // 1. Authoritative Cart sync
      await fetchCart(sessionId, dinerId, true);

      // 2. Discover newly submitted orders by peers
      const res = await apiClient.get<any[]>(`/sessions/${sessionId}/orders`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        for (const ord of res.data) {
          if (ord?.id && !knownOrderIdsRef.current.has(ord.id)) {
            knownOrderIdsRef.current.add(ord.id);
            setCart(null);
            notify(
              `Order ${ord.display_number || ""} submitted by ${
                ord.placed_by_diner_name || "a diner"
              }! 🚀`,
              "success"
            );
            if (onOrderSubmitted) {
              onOrderSubmitted({
                event: "ORDER_SUBMITTED",
                session_id: sessionId,
                order_id: ord.id,
                display_number: ord.display_number,
                order_number: ord.order_number,
                placed_by: ord.placed_by_diner_name,
              });
            }
          }
        }
      }
    } catch {
      // Quiet background polling fallback
    } finally {
      isPollingBusyRef.current = false;
    }
  }, [sessionId, dinerId, fetchCart, notify, setCart, onOrderSubmitted]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
    if (!pollIntervalRef.current) {
      // Run immediate tick then every 3000ms
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
    if (!sessionId || typeof window === "undefined") return;

    const wsBase = getWebSocketBaseUrl();
    const queryParams = new URLSearchParams();
    if (dinerId) queryParams.set("diner_id", dinerId);

    const wsUrl = `${wsBase}/ws/sessions/${sessionId}?${queryParams.toString()}`;

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

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        setIsConnected(false);
        startPolling();
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Exponential backoff reconnect
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
  }, [sessionId, dinerId, handleMessage, startPolling, stopPolling]);

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

  return {
    isConnected,
    isPolling,
    lastEvent,
    reconnect: connect,
  };
}
