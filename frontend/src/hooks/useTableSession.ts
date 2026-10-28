"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCartStore } from "@/lib/cartStore";

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
  const [lastEvent, setLastEvent] = useState<SessionRealtimeEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const { fetchCart, addOrUpdateDiner, notify, setCart } = useCartStore();

  const handleMessage = useCallback(
    (evt: MessageEvent) => {
      if (evt.data === "pong") return;

      try {
        const data: SessionRealtimeEvent = JSON.parse(evt.data);
        setLastEvent(data);

        switch (data.event) {
          case "CONNECTED":
            // Connected successfully
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
              // Fetch authoritative cart
              fetchCart(sessionId, dinerId).catch(() => {});
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
              fetchCart(sessionId, dinerId).catch(() => {});
            }
            if (data.actor_diner_name) {
              notify(`${data.actor_diner_name} cleared the cart`, "info");
            }
            break;

          case "ORDER_SUBMITTED":
            // Update cart to empty
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

  const connect = useCallback(() => {
    if (!sessionId || typeof window === "undefined") return;

    const isHttps = window.location.protocol === "https:";
    const host =
      window.location.hostname === "localhost"
        ? "127.0.0.1"
        : window.location.hostname;
    const defaultHost = `${host}:8000`;
    const wsBase =
      process.env.NEXT_PUBLIC_WS_URL || `${isHttps ? "wss" : "ws"}://${defaultHost}`;

    const queryParams = new URLSearchParams();
    if (dinerId) queryParams.set("diner_id", dinerId);

    const wsUrl = `${wsBase}/ws/sessions/${sessionId}?${queryParams.toString()}`;

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

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        setIsConnected(false);
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
      const backoffMs = Math.min(
        1000 * Math.pow(2, retryCountRef.current),
        10000
      );
      retryCountRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoffMs);
    }
  }, [sessionId, dinerId, handleMessage]);

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

  return {
    isConnected,
    lastEvent,
    reconnect: connect,
  };
}
