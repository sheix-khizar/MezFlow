"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { getWebSocketBaseUrl } from "@/lib/ws";
import { useAuthStore } from "@/lib/authStore";
import { Order, OrderStatus } from "@/types/menu";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Utensils,
  PlusCircle,
  Sparkles,
  Wifi,
  Languages,
} from "lucide-react";

interface StatusStep {
  key: OrderStatus;
  labelEn: string;
  labelUr: string;
  descEn: string;
  descUr: string;
}

const ORDER_STEPS: StatusStep[] = [
  {
    key: "NEW",
    labelEn: "Order Placed",
    labelUr: "آرڈر موصول",
    descEn: "Sent to kitchen display",
    descUr: "کچن اسکرین پر بھیج دیا گیا",
  },
  {
    key: "CONFIRMED",
    labelEn: "Accepted",
    labelUr: "قبول شدہ",
    descEn: "Head chef acknowledged",
    descUr: "شیف نے تصدیق کر لی",
  },
  {
    key: "PREPARING",
    labelEn: "Cooking Now",
    labelUr: "تیاری میں",
    descEn: "Hot & fresh on station",
    descUr: "کچن اسٹیشن پر پکایا جا رہا ہے",
  },
  {
    key: "READY",
    labelEn: "Plated & Ready",
    labelUr: "تیار",
    descEn: "Ready for table runner",
    descUr: "سرونگ کے لیے بالکل تیار",
  },
  {
    key: "DISPATCHED",
    labelEn: "Served",
    labelUr: "پیش کر دیا گیا",
    descEn: "Delivered to your table",
    descUr: "دسترخوان پر پیش کیا جا چکا ہے",
  },
];

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = params.restaurantId as string;
  const tableId = params.tableId as string;
  const orderId = params.orderId as string;

  const { language, setLanguage } = useAuthStore();
  const isUrdu = language === "ur";

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch order details (silent = false on initial mount, silent = true for polling)
  const fetchOrder = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) {
          setLoading(true);
          setError(null);
        }
        const res = await apiClient.get<Order>(`/orders/${orderId}`);
        setOrder(res.data);
      } catch (err: any) {
        if (isInitial) {
          setError(err.message || "Failed to load order details");
        }
      } finally {
        if (isInitial) {
          setLoading(false);
        }
      }
    },
    [orderId]
  );

  useEffect(() => {
    fetchOrder(true);
  }, [fetchOrder]);

  // Connect WebSocket to table session with automatic 3s REST polling fallback
  useEffect(() => {
    if (!order?.session_id || typeof window === "undefined") return;

    const sessionId = order.session_id;
    const wsBase = getWebSocketBaseUrl();

    let ws: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const startPollingFallback = () => {
      if (!pollInterval) {
        pollInterval = setInterval(() => {
          fetchOrder(false);
        }, 3000);
      }
    };

    const stopPollingFallback = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    try {
      ws = new WebSocket(`${wsBase}/ws/sessions/${sessionId}`);

      ws.onopen = () => {
        stopPollingFallback();
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        if (evt.data === "pong") return;
        try {
          const data = JSON.parse(evt.data);
          if (data.event === "ORDER_STATUS_CHANGED" && data.order_id === orderId) {
            setOrder((prev) =>
              prev ? { ...prev, status: data.new_status as OrderStatus } : null
            );
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        startPollingFallback();
        if (pingInterval) clearInterval(pingInterval);
      };

      ws.onerror = () => {
        startPollingFallback();
        if (ws) ws.close();
      };
    } catch {
      startPollingFallback();
    }

    return () => {
      stopPollingFallback();
      if (pingInterval) clearInterval(pingInterval);
      if (ws) ws.close();
    };
  }, [order?.session_id, orderId, fetchOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <h2 className="text-base font-bold text-white mb-1">
          {isUrdu ? "آرڈر لوڈ ہو رہا ہے..." : "Loading Order Details..."}
        </h2>
        <p className="text-xs text-slate-400">
          {isUrdu ? "کچن اسٹیٹس کی جانچ جاری ہے" : "Connecting to kitchen live tracker"}
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          {isUrdu ? "آرڈر نہیں ملا" : "Order Not Found"}
        </h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          {error || "Could not retrieve the specified order."}
        </p>
        <Link
          href={`/r/${restaurantId}/t/${tableId}`}
          className="px-5 py-2.5 rounded-xl bg-brand-500 text-xs font-bold text-white hover:bg-brand-600"
        >
          {isUrdu ? "مینو پر واپس جائیں" : "Return to Table Menu"}
        </Link>
      </div>
    );
  }

  // Calculate current step index
  const statusRank: Record<OrderStatus, number> = {
    NEW: 0,
    CONFIRMED: 1,
    PREPARING: 2,
    READY: 3,
    DISPATCHED: 4,
    CANCELLED: -1,
  };

  const currentRank = statusRank[order.status] ?? 0;
  const isCancelled = order.status === "CANCELLED";

  const formattedSubtotal = Number(order.subtotal).toLocaleString("en-PK");
  const formattedTax = Number(order.tax_amount).toLocaleString("en-PK");
  const formattedTotal = Number(order.total_amount).toLocaleString("en-PK");

  return (
    <div
      className="min-h-screen bg-surface-dark text-slate-100 pb-20"
      dir={isUrdu ? "rtl" : "ltr"}
    >
      {/* Top Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-surface-border px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/r/${restaurantId}/t/${tableId}`}
            className="p-1.5 rounded-lg glass-panel text-slate-400 hover:text-white transition-colors"
            aria-label="Back to Menu"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          </Link>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-tight">
              {isUrdu ? "لائیو آرڈر ٹریکر" : "Live Kitchen Tracker"}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-brand-400 font-semibold">
              <span>Table {order.table_number}</span>
              <span>•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            </div>
          </div>
        </div>

        {/* Language switch */}
        <button
          type="button"
          onClick={() => setLanguage(isUrdu ? "en" : "ur")}
          className="px-2.5 py-1.5 rounded-xl glass-panel text-xs font-semibold text-slate-300 hover:text-white border border-surface-border flex items-center gap-1.5"
        >
          <Languages className="w-3.5 h-3.5 text-brand-400" />
          <span>{isUrdu ? "English" : "اردو"}</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-6">
        {/* Ticket Header Card */}
        <div className="relative rounded-3xl glass-panel border border-surface-border p-6 text-center shadow-xl overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 text-xs font-extrabold mb-3">
            <ChefHat className="w-4 h-4" />
            <span>Ticket #{order.display_number}</span>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            {isCancelled
              ? isUrdu
                ? "آرڈر منسوخ کر دیا گیا"
                : "Order Cancelled"
              : isUrdu
              ? ORDER_STEPS[currentRank]?.labelUr || order.status
              : ORDER_STEPS[currentRank]?.labelEn || order.status}
          </h2>

          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {isCancelled
              ? isUrdu
                ? "یہ آرڈر کچن یا عملے کی جانب سے منسوخ کیا گیا ہے"
                : "This order was cancelled by restaurant staff."
              : isUrdu
              ? ORDER_STEPS[currentRank]?.descUr
              : ORDER_STEPS[currentRank]?.descEn}
          </p>

          {order.placed_by_diner_name && (
            <p className="text-[11px] text-slate-500 mt-3">
              {isUrdu
                ? `آرڈر بذریعہ: ${order.placed_by_diner_name}`
                : `Submitted by: ${order.placed_by_diner_name}`}
            </p>
          )}
        </div>

        {/* Live Stepper Timeline */}
        {!isCancelled && (
          <div className="rounded-3xl glass-panel border border-surface-border p-5 shadow-lg">
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4 px-1">
              {isUrdu ? "کچن ٹائم لائن" : "Preparation Progress"}
            </h3>

            <div className="space-y-4">
              {ORDER_STEPS.map((step, idx) => {
                const isPassed = idx < currentRank;
                const isCurrent = idx === currentRank;
                const isUpcoming = idx > currentRank;

                return (
                  <div key={step.key} className="flex items-start gap-3 relative">
                    {/* Connecting vertical line */}
                    {idx < ORDER_STEPS.length - 1 && (
                      <div
                        className={`absolute top-6 left-3 rtl:right-3 rtl:left-auto w-0.5 h-8 -ml-[1px] rtl:-mr-[1px] transition-colors ${
                          idx < currentRank ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      />
                    )}

                    {/* Step Icon circle */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all z-10 ${
                        isPassed
                          ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                          : isCurrent
                          ? "bg-brand-500 text-white ring-4 ring-brand-500/20 animate-pulse shadow-md shadow-brand-500/40"
                          : "bg-surface-dark border border-slate-700 text-slate-500"
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    {/* Step Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`text-xs font-bold ${
                            isCurrent
                              ? "text-brand-400 font-extrabold"
                              : isPassed
                              ? "text-white"
                              : "text-slate-500"
                          }`}
                        >
                          {isUrdu ? step.labelUr : step.labelEn}
                        </h4>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">
                            {isUrdu ? "فعال" : "In Progress"}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {isUrdu ? step.descUr : step.descEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Itemized Order Breakdown */}
        <div className="rounded-3xl glass-panel border border-surface-border p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-surface-border/50 pb-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              {isUrdu ? "آرڈر کی تفصیلات" : "Ordered Items"}
            </h3>
            <span className="text-xs text-slate-400">
              {order.items.length} {order.items.length === 1 ? "dish" : "dishes"}
            </span>
          </div>

          <div className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="py-2 border-b border-surface-border/30 last:border-0 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-brand-400">
                      {item.quantity}x
                    </span>
                    <span className="font-bold text-white">{item.item_name}</span>
                  </div>

                  {/* Modifiers */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.modifiers.map((m) => (
                        <span
                          key={m.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface-border/50 text-slate-300 border border-surface-border"
                        >
                          +{m.option_name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Special notes */}
                  {item.special_instructions && (
                    <p className="text-[10px] text-amber-400 italic mt-0.5">
                      &quot;{item.special_instructions}&quot;
                    </p>
                  )}

                  {/* Diner attribution */}
                  {item.diner_name && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {isUrdu ? "آرڈر بذریعہ: " : "For: "}
                      <span className="text-slate-400">{item.diner_name}</span>
                    </p>
                  )}
                </div>

                <div className="text-right rtl:text-left font-bold text-white">
                  {order.currency}{" "}
                  {Number(item.total_price).toLocaleString("en-PK")}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-surface-border/50 pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>{isUrdu ? "ذیلی کل رقم" : "Subtotal"}</span>
              <span>
                {order.currency} {formattedSubtotal}
              </span>
            </div>
            {Number(order.tax_amount) > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>{isUrdu ? "ٹیکس" : "Tax"}</span>
                <span>
                  {order.currency} {formattedTax}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-surface-border/50">
              <span>{isUrdu ? "کل ادا شدہ رقم" : "Total Amount"}</span>
              <span className="text-brand-400">
                {order.currency} {formattedTotal}
              </span>
            </div>
          </div>
        </div>

        {/* CTA: Order More Dishes */}
        <div className="pt-2 pb-6">
          <Link
            href={`/r/${restaurantId}/t/${tableId}`}
            className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-extrabold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {isUrdu ? "مزید اشیاء آرڈر کریں" : "Order More Items for Table"}
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
