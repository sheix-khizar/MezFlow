"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Users,
  Utensils,
  Sparkles,
  ShoppingBag,
  Send,
  AlertCircle,
} from "lucide-react";
import { CartResponse, CartItem, Diner } from "@/types/menu";
import { DinerBadge } from "./DinerBadge";
import { getDishImage } from "@/lib/dishImages";

interface SharedCartDrawerProps {
  isOpen: boolean;
  cart: CartResponse | null;
  activeDiners: Diner[];
  currentDinerId?: string;
  tableName: string;
  isUrdu?: boolean;
  onClose: () => void;
  onUpdateQuantity: (cartItemId: string, newQty: number) => Promise<any>;
  onRemoveItem: (cartItemId: string) => Promise<any>;
  onClearCart: () => Promise<any>;
  onSubmitOrder: () => void;
}

export function SharedCartDrawer({
  isOpen,
  cart,
  activeDiners,
  currentDinerId,
  tableName,
  isUrdu = false,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSubmitOrder,
}: SharedCartDrawerProps) {
  const [viewMode, setViewMode] = useState<"diner" | "unified">("diner");
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const items = cart?.items || [];
  const currency = cart?.currency || "PKR";

  // Group items by Diner for "By Diner" view
  const groupedByDiner = useMemo(() => {
    const groups: Record<
      string,
      {
        dinerId: string;
        dinerName: string;
        avatarColor: string;
        items: CartItem[];
        subtotal: number;
      }
    > = {};

    items.forEach((item) => {
      if (!groups[item.diner_id]) {
        groups[item.diner_id] = {
          dinerId: item.diner_id,
          dinerName: item.diner_name,
          avatarColor: item.avatar_color,
          items: [],
          subtotal: 0,
        };
      }
      groups[item.diner_id].items.push(item);
      groups[item.diner_id].subtotal += Number(item.line_total);
    });

    return Object.values(groups);
  }, [items]);

  if (!isOpen) return null;

  const handleQtyChange = async (itemId: string, newQty: number) => {
    try {
      setUpdatingItemId(itemId);
      await onUpdateQuantity(itemId, newQty);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    try {
      setUpdatingItemId(itemId);
      await onRemoveItem(itemId);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleConfirmClear = async () => {
    if (
      window.confirm(
        isUrdu
          ? "کیا آپ واقعی تمام اشیاء کارٹ سے ہٹانا چاہتے ہیں؟"
          : "Are you sure you want to clear the entire table cart?"
      )
    ) {
      try {
        setIsClearing(true);
        await onClearCart();
      } finally {
        setIsClearing(false);
      }
    }
  };

  const formattedSubtotal = Number(cart?.subtotal || 0).toLocaleString("en-PK");
  const formattedTax = Number(cart?.tax_amount || 0).toLocaleString("en-PK");
  const formattedTotal = Number(cart?.total_amount || 0).toLocaleString("en-PK");

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-fade-in"
      dir={isUrdu ? "rtl" : "ltr"}
    >
      {/* Backdrop tap to close */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Surface */}
      <div className="relative w-full max-w-xl mx-auto max-h-[90vh] bg-surface-dark border-t border-surface-border rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1" />

        {/* Drawer Header */}
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                {isUrdu ? "مشترکہ ٹیبل کارٹ" : "Shared Table Cart"}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 font-bold border border-brand-500/20">
                {tableName}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {isUrdu
                  ? `${activeDiners.length} افراد ایک ساتھ آرڈر کر رہے ہیں`
                  : `${activeDiners.length} diners collaborating in real time`}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode Switcher */}
        {items.length > 0 && (
          <div className="px-5 py-2.5 bg-surface-dark/90 border-b border-surface-border/50 flex items-center justify-between">
            <div className="flex rounded-xl glass-panel p-1 border border-surface-border text-xs">
              <button
                type="button"
                onClick={() => setViewMode("diner")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewMode === "diner"
                    ? "bg-brand-500 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {isUrdu ? "بذریعہ فرد" : "Group by Diner"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("unified")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewMode === "unified"
                    ? "bg-brand-500 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {isUrdu ? "مشترکہ فہرست" : "Unified List"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleConfirmClear}
              disabled={isClearing}
              className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 p-1.5 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isUrdu ? "کارٹ خالی کریں" : "Clear All"}</span>
            </button>
          </div>
        )}

        {/* Cart Item Scroll Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl glass-panel border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {isUrdu ? "کارٹ فی الحال خالی ہے" : "Your table cart is empty"}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {isUrdu
                  ? "مینو سے کوئی بھی ڈش منتخب کریں اور اپنے ساتھیوں کے ساتھ مل کر آرڈر بنائیں"
                  : "Tap on any dish from the digital menu to customize and add it for the table"}
              </p>
            </div>
          ) : viewMode === "diner" ? (
            // Grouped By Diner View
            groupedByDiner.map((group) => {
              const isYou = group.dinerId === currentDinerId;
              return (
                <div
                  key={group.dinerId}
                  className="rounded-2xl glass-panel border border-surface-border p-3.5 space-y-3"
                >
                  {/* Diner Section Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border/40">
                    <DinerBadge
                      name={group.dinerName}
                      avatarColor={group.avatarColor}
                      isYou={isYou}
                      size="md"
                      prefix={isUrdu ? "آرڈر بذریعہ " : "Added by "}
                    />
                    <div className="text-xs font-bold text-slate-300">
                      {currency}{" "}
                      {group.subtotal.toLocaleString("en-PK", {
                        minimumFractionDigits: 0,
                      })}
                    </div>
                  </div>

                  {/* Items added by this diner */}
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        currency={currency}
                        isUrdu={isUrdu}
                        isUpdating={updatingItemId === item.id}
                        onQtyChange={(qty) => handleQtyChange(item.id, qty)}
                        onRemove={() => handleRemove(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // Unified Flat View
            <div className="rounded-2xl glass-panel border border-surface-border p-3.5 space-y-3">
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  isUrdu={isUrdu}
                  showDinerBadge
                  currentDinerId={currentDinerId}
                  isUpdating={updatingItemId === item.id}
                  onQtyChange={(qty) => handleQtyChange(item.id, qty)}
                  onRemove={() => handleRemove(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer Summary & Order Submission */}
        {items.length > 0 && (
          <div className="border-t border-surface-border bg-surface-dark/95 backdrop-blur-md p-5 space-y-3">
            {/* Totals Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>{isUrdu ? "ذیلی کل رقم" : "Subtotal"}</span>
                <span>
                  {currency} {formattedSubtotal}
                </span>
              </div>
              {Number(cart?.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>{isUrdu ? "ٹیکس (جی ایس ٹی)" : "Tax"}</span>
                  <span>
                    {currency} {formattedTax}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-surface-border/50">
                <span>{isUrdu ? "کل واجب الادا رقم" : "Grand Total"}</span>
                <span className="text-brand-400">
                  {currency} {formattedTotal}
                </span>
              </div>
            </div>

            {/* Submit Order Primary Button */}
            <button
              type="button"
              onClick={onSubmitOrder}
              className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 active:scale-[0.99] text-white font-extrabold text-sm shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2 transition-all"
            >
              <Send className="w-4 h-4 rtl:-scale-x-100" />
              <span>
                {isUrdu
                  ? "آرڈر کچن کو بھیجیں"
                  : "Submit Order to Kitchen"}
              </span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold ml-1 rtl:mr-1">
                {currency} {formattedTotal}
              </span>
            </button>

            <p className="text-[10px] text-center text-slate-500">
              {isUrdu
                ? "🔒 تصدیق شدہ آرڈر: براہ راست کچن اسکرین پر فوری ترسیل"
                : "🔒 Verified Order: Guaranteed pricing & direct kitchen line dispatch"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponent: Individual Cart Item Row
function CartItemRow({
  item,
  currency,
  isUrdu = false,
  showDinerBadge = false,
  currentDinerId,
  isUpdating = false,
  onQtyChange,
  onRemove,
}: {
  item: CartItem;
  currency: string;
  isUrdu?: boolean;
  showDinerBadge?: boolean;
  currentDinerId?: string;
  isUpdating?: boolean;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const itemName = isUrdu && item.item_name_ur ? item.item_name_ur : item.item_name;
  const isYou = item.diner_id === currentDinerId;
  const dishImg = getDishImage(item.item_name);

  return (
    <div className="py-2.5 border-b border-surface-border/40 last:border-0 flex items-start justify-between gap-3">
      {/* Left Details & Thumbnail */}
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {dishImg && (
          <img
            src={dishImg}
            alt={itemName}
            className="w-12 h-12 rounded-xl object-cover border border-surface-border shrink-0 shadow-sm"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white truncate">{itemName}</h4>
            {showDinerBadge && (
              <DinerBadge
                name={item.diner_name}
                avatarColor={item.avatar_color}
                isYou={isYou}
                size="xs"
                showLabel={false}
              />
            )}
          </div>

        {/* Modifiers List */}
        {item.modifiers && item.modifiers.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.modifiers.map((m) => (
              <span
                key={m.id || m.modifier_option_id}
                className="text-[10px] px-1.5 py-0.5 rounded bg-surface-border/60 text-slate-300 border border-surface-border font-medium"
              >
                +{m.option_name}{" "}
                {Number(m.price_delta) > 0 && `(${currency} ${m.price_delta})`}
              </span>
            ))}
          </div>
        )}

        {/* Special Cooking Instructions */}
        {item.special_instructions && (
          <p className="text-[10px] text-amber-400 italic mt-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block">
            📝 &quot;{item.special_instructions}&quot;
          </p>
        )}

        {/* Unit Price */}
        <div className="text-[11px] text-slate-400 mt-1">
          {currency} {Number(item.unit_price).toLocaleString("en-PK")} each
        </div>
      </div>
    </div>

      {/* Right Controls: Stepper and Line Total */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-xs font-black text-white">
          {currency} {Number(item.line_total).toLocaleString("en-PK")}
        </span>

        {/* Stepper (+ / -) */}
        <div className="flex items-center gap-1.5 bg-surface-dark border border-surface-border rounded-xl p-0.5 shadow-inner">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              if (item.quantity === 1) {
                onRemove();
              } else {
                onQtyChange(item.quantity - 1);
              }
            }}
            aria-label="Decrease quantity"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40"
          >
            {item.quantity === 1 ? (
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
          </button>

          <span className="w-5 text-center text-xs font-bold text-white">
            {item.quantity}
          </span>

          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onQtyChange(item.quantity + 1)}
            aria-label="Increase quantity"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
