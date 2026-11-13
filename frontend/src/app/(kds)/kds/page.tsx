"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useKDSStore } from "@/lib/kdsStore";
import { useKDSSocket } from "@/hooks/useKDSSocket";
import { StationFilterBar } from "@/components/kds/StationFilterBar";
import { OrderTicketCard } from "@/components/kds/OrderTicketCard";
import {
  ChefHat,
  RotateCcw,
  Sparkles,
  Layers,
  AlertCircle,
  Loader2,
  Clock,
  ArrowLeft,
  X,
} from "lucide-react";

export default function KDSPage() {
  const { user, setAuth } = useAuthStore();
  const restaurantId = user?.restaurant_id || "52dc0556-c8c6-4131-be96-6643f9cc35b0"; // Fallback to seeded demo restaurant

  const {
    orders,
    summary,
    selectedStation,
    statusFilter,
    soundEnabled,
    isLoading,
    recallToast,
    error,
    setSelectedStation,
    setStatusFilter,
    toggleSound,
    clearRecallToast,
    fetchActiveOrders,
    fetchSummary,
    bumpOrder,
    recallOrder,
    updateItemStatus,
  } = useKDSStore();

  const { isConnected, isPolling, reconnect } = useKDSSocket(restaurantId);

  // Ensure kitchen authentication for wall-mounted tablet or direct browser access
  useEffect(() => {
    async function ensureAuth() {
      const token = typeof window !== "undefined" ? localStorage.getItem("mezflow_token") : null;
      if (!token) {
        try {
          const res = await apiClient.post("/auth/login", {
            username: "kitchen@mezflow.com",
            password: "kitchen123",
          });
          const { access_token, user_id, restaurant_id, role, display_name, preferred_language } = res.data;
          setAuth(access_token, {
            id: user_id,
            restaurant_id,
            role,
            is_active: true,
            is_verified: true,
            profile: {
              id: user_id,
              display_name: display_name || "Kitchen Chef",
              preferred_language: preferred_language || "en",
              push_notifications_enabled: false,
            },
          });
          fetchActiveOrders();
          fetchSummary();
        } catch (e) {
          console.error("Failed to auto-authenticate kitchen staff:", e);
        }
      }
    }
    ensureAuth();
  }, [setAuth, fetchActiveOrders, fetchSummary]);

  // Initial fetch on mount (continuous fast auto-sync is handled by useKDSSocket)
  useEffect(() => {
    fetchActiveOrders();
    fetchSummary();
  }, [fetchActiveOrders, fetchSummary]);

  // Recall toast countdown effect
  const [toastCountdown, setToastCountdown] = useState(60);

  useEffect(() => {
    if (!recallToast) return;
    setToastCountdown(60);

    const timer = setInterval(() => {
      setToastCountdown((prev) => {
        if (prev <= 1) {
          clearRecallToast();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [recallToast, clearRecallToast]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Station Navigation Header Bar */}
      <StationFilterBar
        selectedStation={selectedStation}
        statusFilter={statusFilter}
        summary={summary}
        soundEnabled={soundEnabled}
        isConnected={isConnected}
        isPolling={isPolling}
        onSelectStation={setSelectedStation}
        onSelectStatus={setStatusFilter}
        onToggleSound={toggleSound}
      />

      {/* Main Order Queue Viewport */}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchActiveOrders()}
              className="px-3 py-1 rounded-lg bg-rose-500 text-white font-bold text-[11px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State on first load */}
        {isLoading && orders.length === 0 && (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-3" />
            <h3 className="text-base font-bold text-white">
              Connecting to Kitchen Queue...
            </h3>
            <p className="text-xs text-slate-400">
              Fetching active table tickets and station routes
            </p>
          </div>
        )}

        {/* Empty State: All orders cleared */}
        {!isLoading && orders.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
              <ChefHat className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              All Orders Prepared!
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              The kitchen display queue is clear. New incoming orders from dining
              table QR sessions will pop up here in real time.
            </p>
          </div>
        )}

        {/* Responsive Multi-Column Kitchen Grid */}
        {orders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-start">
            {orders.map((order) => (
              <OrderTicketCard
                key={order.id}
                order={order}
                onBump={bumpOrder}
                onToggleItemStatus={async (orderId, itemId, currentStatus) => {
                  await updateItemStatus(orderId, itemId, currentStatus);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating 60-Second Recall Toast / Snackbar (WP4.13) */}
      {recallToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-white flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  Bumped #{recallToast.displayNumber}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-black">
                  {toastCountdown}s
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Tap undo to recall back to previous status
              </p>
            </div>

            <button
              type="button"
              onClick={() => recallOrder(recallToast.orderId)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>UNDO</span>
            </button>

            <button
              type="button"
              onClick={clearRecallToast}
              aria-label="Dismiss toast"
              className="text-slate-500 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
