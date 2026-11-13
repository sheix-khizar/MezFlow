"use client";

import { create } from "zustand";
import apiClient from "./api";
import {
  KDSOrderCard,
  KDSSummary,
  KitchenStation,
  KDSStatusFilter,
  ItemStatus,
} from "@/types/kds";
import { audioAlerts } from "./audioAlerts";

interface RecallToast {
  orderId: string;
  displayNumber: string;
  timerSeconds: number;
}

interface KDSState {
  orders: KDSOrderCard[];
  summary: KDSSummary | null;
  selectedStation: KitchenStation;
  statusFilter: KDSStatusFilter;
  soundEnabled: boolean;
  isLoading: boolean;
  recallToast: RecallToast | null;
  error: string | null;

  // Setters
  setSelectedStation: (station: KitchenStation) => void;
  setStatusFilter: (filter: KDSStatusFilter) => void;
  toggleSound: () => void;
  clearRecallToast: () => void;

  // Async API calls
  fetchActiveOrders: (silent?: boolean) => Promise<void>;
  fetchSummary: () => Promise<void>;
  bumpOrder: (orderId: string, targetStatus?: string) => Promise<void>;
  recallOrder: (orderId: string, reason?: string) => Promise<void>;
  updateItemStatus: (
    orderId: string,
    itemId: string,
    status: ItemStatus
  ) => Promise<void>;

  // Real-time Event Processor
  handleRealtimeKdsEvent: (event: any) => void;
}

export const useKDSStore = create<KDSState>((set, get) => ({
  orders: [],
  summary: null,
  selectedStation: "all",
  statusFilter: "ALL",
  soundEnabled: audioAlerts.isEnabled(),
  isLoading: false,
  recallToast: null,
  error: null,

  setSelectedStation: (station) => {
    set({ selectedStation: station });
    get().fetchActiveOrders();
  },

  setStatusFilter: (filter) => {
    set({ statusFilter: filter });
    get().fetchActiveOrders();
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    audioAlerts.setEnabled(next);
    set({ soundEnabled: next });
  },

  clearRecallToast: () => set({ recallToast: null }),

  fetchActiveOrders: async (silent = false) => {
    const { selectedStation, statusFilter } = get();
    try {
      if (!silent) set({ isLoading: true, error: null });
      const res = await apiClient.get<KDSOrderCard[]>("/kds/orders/active", {
        params: {
          station: selectedStation,
          status: statusFilter.toLowerCase(),
        },
      });
      set({ orders: res.data, isLoading: false });
    } catch (err: any) {
      if (!silent) {
        set({
          isLoading: false,
          error: err.message || "Failed to load active kitchen queue",
        });
      }
    }
  },

  fetchSummary: async () => {
    try {
      const res = await apiClient.get<KDSSummary>("/kds/summary");
      set({ summary: res.data });
    } catch {
      // Summary error silently logged
    }
  },

  bumpOrder: async (orderId, targetStatus) => {
    const currentOrders = get().orders;
    const targetOrder = currentOrders.find((o) => o.id === orderId);

    try {
      audioAlerts.playBumpSound();

      const res = await apiClient.patch(`/kds/orders/${orderId}/bump`, {
        target_status: targetStatus,
      });

      const nextStatus = res.data.status;

      // Update in state
      if (nextStatus === "DISPATCHED") {
        set({
          orders: currentOrders.filter((o) => o.id !== orderId),
        });
      } else {
        set({
          orders: currentOrders.map((o) =>
            o.id === orderId ? { ...o, status: nextStatus } : o
          ),
        });
      }

      // Show 60s Recall snackbar
      if (targetOrder) {
        set({
          recallToast: {
            orderId,
            displayNumber: targetOrder.display_number,
            timerSeconds: 60,
          },
        });
      }

      get().fetchSummary();
    } catch (err: any) {
      set({ error: err.message || "Could not bump order" });
      throw err;
    }
  },

  recallOrder: async (orderId, reason) => {
    try {
      audioAlerts.playWarningSound();
      await apiClient.post(`/kds/orders/${orderId}/recall`, { reason });
      set({ recallToast: null });
      await get().fetchActiveOrders();
      await get().fetchSummary();
    } catch (err: any) {
      set({ error: err.message || "Could not recall order" });
      throw err;
    }
  },

  updateItemStatus: async (orderId, itemId, status) => {
    try {
      await apiClient.patch(`/kds/orders/${orderId}/items/${itemId}/status`, {
        status,
      });

      // Update item in local state
      set((state) => ({
        orders: state.orders.map((o) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            items: o.items.map((i) =>
              i.id === itemId ? { ...i, status } : i
            ),
          };
        }),
      }));
    } catch (err: any) {
      set({ error: err.message || "Could not update item status" });
    }
  },

  handleRealtimeKdsEvent: (data) => {
    if (!data || !data.event) return;

    switch (data.event) {
      case "NEW_ORDER":
        if (data.order) {
          audioAlerts.playNewOrderChime();
          get().fetchActiveOrders();
          get().fetchSummary();
        }
        break;

      case "ORDER_BUMPED":
        if (data.new_status === "DISPATCHED") {
          set((state) => ({
            orders: state.orders.filter((o) => o.id !== data.order_id),
          }));
        } else {
          set((state) => ({
            orders: state.orders.map((o) =>
              o.id === data.order_id ? { ...o, status: data.new_status } : o
            ),
          }));
        }
        get().fetchSummary();
        break;

      case "ORDER_RECALLED":
        get().fetchActiveOrders();
        get().fetchSummary();
        break;

      case "ITEM_STATUS_UPDATED":
        set((state) => ({
          orders: state.orders.map((o) => {
            if (o.id !== data.order_id) return o;
            return {
              ...o,
              items: o.items.map((i) =>
                i.id === data.item_id ? { ...i, status: data.status } : i
              ),
            };
          }),
        }));
        break;

      default:
        break;
    }
  },
}));
