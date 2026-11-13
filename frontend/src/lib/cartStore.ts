"use client";

import { create } from "zustand";
import apiClient from "./api";
import {
  TableSession,
  Diner,
  CartResponse,
  CartItem,
  Order,
} from "@/types/menu";

export interface ToastNotification {
  id: string;
  message: string;
  type: "info" | "success" | "warn";
}

interface CartStoreState {
  session: TableSession | null;
  currentDiner: Diner | null;
  cart: CartResponse | null;
  activeDiners: Diner[];
  isDrawerOpen: boolean;
  isSubmitModalOpen: boolean;
  isDinerModalOpen: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  notification: ToastNotification | null;

  // Sync setters
  setSession: (session: TableSession | null) => void;
  setCurrentDiner: (diner: Diner | null) => void;
  setCart: (cart: CartResponse | null) => void;
  setDiners: (diners: Diner[]) => void;
  addOrUpdateDiner: (diner: Diner) => void;
  setIsDrawerOpen: (open: boolean) => void;
  setIsSubmitModalOpen: (open: boolean) => void;
  setIsDinerModalOpen: (open: boolean) => void;
  notify: (message: string, type?: "info" | "success" | "warn") => void;
  clearNotification: () => void;

  // Async API actions
  joinSession: (
    qrToken: string,
    displayName: string,
    avatarColor?: string
  ) => Promise<TableSession>;
  fetchCart: (sessionId: string, dinerId?: string, silent?: boolean) => Promise<CartResponse>;
  addItem: (
    sessionId: string,
    dinerId: string,
    payload: {
      item_id: string;
      quantity: number;
      selected_modifier_option_ids?: string[];
      special_instructions?: string;
    }
  ) => Promise<CartResponse>;
  updateItemQuantity: (
    sessionId: string,
    cartItemId: string,
    dinerId: string,
    quantity: number
  ) => Promise<CartResponse | null>;
  removeItem: (
    sessionId: string,
    cartItemId: string,
    dinerId: string
  ) => Promise<void>;
  clearCart: (sessionId: string, dinerId: string) => Promise<void>;
  submitOrder: (
    sessionId: string,
    dinerId: string,
    notes?: string
  ) => Promise<Order>;
  loadSavedIdentity: () => {
    savedDinerId: string | null;
    savedClientSessionId: string | null;
    savedDisplayName: string | null;
    savedAvatarColor: string | null;
  };
}

export const useCartStore = create<CartStoreState>((set, get) => ({
  session: null,
  currentDiner: null,
  cart: null,
  activeDiners: [],
  isDrawerOpen: false,
  isSubmitModalOpen: false,
  isDinerModalOpen: false,
  isLoading: false,
  isSubmitting: false,
  error: null,
  notification: null,

  setSession: (session) => set({ session }),
  setCurrentDiner: (currentDiner) => {
    if (typeof window !== "undefined" && currentDiner) {
      localStorage.setItem("mezflow_diner_id", currentDiner.id);
      localStorage.setItem("mezflow_diner_name", currentDiner.display_name);
      localStorage.setItem("mezflow_diner_avatar", currentDiner.avatar_color);
      localStorage.setItem("mezflow_client_session_id", currentDiner.client_session_id);
    }
    set({ currentDiner });
  },
  setCart: (cart) => set({ cart }),
  setDiners: (activeDiners) => set({ activeDiners }),

  addOrUpdateDiner: (diner) => {
    set((state) => {
      const exists = state.activeDiners.some((d) => d.id === diner.id);
      const updated = exists
        ? state.activeDiners.map((d) => (d.id === diner.id ? diner : d))
        : [...state.activeDiners, diner];
      return { activeDiners: updated };
    });
  },

  setIsDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
  setIsSubmitModalOpen: (isSubmitModalOpen) => set({ isSubmitModalOpen }),
  setIsDinerModalOpen: (isDinerModalOpen) => set({ isDinerModalOpen }),

  notify: (message, type = "info") => {
    const id = Date.now().toString();
    set({ notification: { id, message, type } });
    setTimeout(() => {
      if (get().notification?.id === id) {
        set({ notification: null });
      }
    }, 4000);
  },

  clearNotification: () => set({ notification: null }),

  loadSavedIdentity: () => {
    if (typeof window === "undefined") {
      return {
        savedDinerId: null,
        savedClientSessionId: null,
        savedDisplayName: null,
        savedAvatarColor: null,
      };
    }
    return {
      savedDinerId: localStorage.getItem("mezflow_diner_id"),
      savedClientSessionId: localStorage.getItem("mezflow_client_session_id"),
      savedDisplayName: localStorage.getItem("mezflow_diner_name"),
      savedAvatarColor: localStorage.getItem("mezflow_diner_avatar"),
    };
  },

  joinSession: async (qrToken, displayName, avatarColor) => {
    set({ isLoading: true, error: null });
    try {
      const clientSessionId =
        (typeof window !== "undefined" &&
          localStorage.getItem("mezflow_client_session_id")) ||
        undefined;

      const res = await apiClient.post<TableSession>("/sessions/join", {
        qr_code_token: qrToken,
        display_name: displayName,
        avatar_color: avatarColor,
        client_session_id: clientSessionId,
      });

      const sessionData = res.data;
      const currentDiner = sessionData.current_diner || null;

      if (typeof window !== "undefined" && currentDiner) {
        localStorage.setItem("mezflow_diner_id", currentDiner.id);
        localStorage.setItem("mezflow_diner_name", currentDiner.display_name);
        localStorage.setItem("mezflow_diner_avatar", currentDiner.avatar_color);
        localStorage.setItem("mezflow_client_session_id", currentDiner.client_session_id);
      }

      set({
        session: sessionData,
        currentDiner,
        activeDiners: sessionData.diners || [],
        cart: sessionData.cart || null,
        isLoading: false,
        isDinerModalOpen: false,
      });

      return sessionData;
    } catch (err: any) {
      const message = err.message || "Failed to join dining session";
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  fetchCart: async (sessionId, dinerId, silent = false) => {
    try {
      const headers = dinerId ? { "X-Diner-ID": dinerId } : undefined;
      const res = await apiClient.get<CartResponse>(
        `/sessions/${sessionId}/cart`,
        { headers }
      );
      set({
        cart: res.data,
        activeDiners: res.data.diners || get().activeDiners,
      });
      return res.data;
    } catch (err: any) {
      if (!silent) {
        console.error("fetchCart error:", err);
      }
      throw err;
    }
  },

  addItem: async (sessionId, dinerId, payload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post<CartResponse>(
        `/sessions/${sessionId}/cart/items`,
        payload,
        {
          headers: { "X-Diner-ID": dinerId },
        }
      );
      set({ cart: res.data, isLoading: false });
      get().notify(
        `Added ${payload.quantity}x to shared cart!`,
        "success"
      );
      return res.data;
    } catch (err: any) {
      set({ isLoading: false });
      const msg = err.message || "Could not add item to cart";
      get().notify(msg, "warn");
      throw new Error(msg);
    }
  },

  updateItemQuantity: async (sessionId, cartItemId, dinerId, quantity) => {
    try {
      if (quantity <= 0) {
        await get().removeItem(sessionId, cartItemId, dinerId);
        return null;
      }
      const res = await apiClient.patch<CartResponse>(
        `/sessions/${sessionId}/cart/items/${cartItemId}`,
        { quantity },
        {
          headers: { "X-Diner-ID": dinerId },
        }
      );
      set({ cart: res.data });
      return res.data;
    } catch (err: any) {
      const msg = err.message || "Could not update quantity";
      get().notify(msg, "warn");
      throw new Error(msg);
    }
  },

  removeItem: async (sessionId, cartItemId, dinerId) => {
    try {
      const res = await apiClient.delete<CartResponse>(
        `/sessions/${sessionId}/cart/items/${cartItemId}`,
        {
          headers: { "X-Diner-ID": dinerId },
        }
      );
      set({ cart: res.data });
      get().notify("Item removed from shared cart", "info");
    } catch (err: any) {
      const msg = err.message || "Could not remove item";
      get().notify(msg, "warn");
      throw new Error(msg);
    }
  },

  clearCart: async (sessionId, dinerId) => {
    try {
      const res = await apiClient.delete<CartResponse>(
        `/sessions/${sessionId}/cart`,
        {
          headers: { "X-Diner-ID": dinerId },
        }
      );
      set({ cart: res.data, isDrawerOpen: false });
      get().notify("Shared cart cleared", "info");
    } catch (err: any) {
      const msg = err.message || "Could not clear cart";
      get().notify(msg, "warn");
      throw new Error(msg);
    }
  },

  submitOrder: async (sessionId, dinerId, notes) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiClient.post<Order>(
        `/sessions/${sessionId}/submit`,
        { notes },
        {
          headers: { "X-Diner-ID": dinerId },
        }
      );

      const createdOrder = res.data;

      // Update local state: session status SUBMITTING/COMPLETED, clear cart
      set((state) => ({
        isSubmitting: false,
        isSubmitModalOpen: false,
        isDrawerOpen: false,
        cart: state.cart
          ? {
              ...state.cart,
              items: [],
              item_count: 0,
              subtotal: "0.00",
              tax_amount: "0.00",
              total_amount: "0.00",
            }
          : null,
      }));

      get().notify(
        `Order ${createdOrder.display_number} sent to kitchen! 🍳`,
        "success"
      );

      return createdOrder;
    } catch (err: any) {
      set({ isSubmitting: false });
      const msg = err.message || "Failed to submit order";
      get().notify(msg, "warn");
      throw new Error(msg);
    }
  },
}));
