"use client";

import React, { useState, useEffect, useMemo } from "react";
import { MenuItem, ModifierGroup, ModifierOption, SelectedModifier } from "@/types/menu";
import { X, Check, Plus, Minus, AlertCircle, Sparkles, Clock, Flame, ShieldCheck, Leaf } from "lucide-react";
import { getDishImage } from "@/lib/dishImages";

interface ModifierModalProps {
  item: MenuItem | null;
  currency?: string;
  language?: "en" | "ur";
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (payload: {
    item: MenuItem;
    selectedModifiers: SelectedModifier[];
    specialInstructions: string;
    quantity: number;
    calculatedTotal: number;
  }) => void;
}

export function ModifierModal({
  item,
  currency = "PKR",
  language = "en",
  isOpen,
  onClose,
  onAddToCart,
}: ModifierModalProps) {
  const isUrdu = language === "ur";
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");
  // Mapping: group_id -> Set of selected option_ids
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize defaults whenever item opens
  useEffect(() => {
    if (!item || !isOpen) {
      setSelections({});
      setQuantity(1);
      setSpecialInstructions("");
      setValidationError(null);
      return;
    }

    const initialSelections: Record<string, string[]> = {};
    for (const grp of item.modifier_groups || []) {
      const defaults = grp.options.filter((o) => o.is_default).map((o) => o.id);
      if (defaults.length > 0) {
        initialSelections[grp.id] = grp.selection_type === "single" ? [defaults[0]] : defaults;
      } else if (grp.is_required && grp.selection_type === "single" && grp.options.length > 0) {
        // Auto-select first option if required single-choice
        initialSelections[grp.id] = [grp.options[0].id];
      } else {
        initialSelections[grp.id] = [];
      }
    }
    setSelections(initialSelections);
  }, [item, isOpen]);

  // Handle Option Click
  const handleToggleOption = (group: ModifierGroup, option: ModifierOption) => {
    const current = selections[group.id] || [];

    if (group.selection_type === "single") {
      setSelections((prev) => ({
        ...prev,
        [group.id]: [option.id],
      }));
    } else {
      // Multiple choice
      if (current.includes(option.id)) {
        setSelections((prev) => ({
          ...prev,
          [group.id]: current.filter((id) => id !== option.id),
        }));
      } else {
        if (group.max_selections && current.length >= group.max_selections) {
          // Reached limit
          return;
        }
        setSelections((prev) => ({
          ...prev,
          [group.id]: [...current, option.id],
        }));
      }
    }
    setValidationError(null);
  };

  // Check required groups satisfaction
  const isSatisfied = useMemo(() => {
    if (!item) return false;
    for (const grp of item.modifier_groups || []) {
      const count = (selections[grp.id] || []).length;
      if (grp.is_required && count < grp.min_selections) {
        return false;
      }
      if (grp.max_selections && count > grp.max_selections) {
        return false;
      }
    }
    return true;
  }, [item, selections]);

  // Calculate live total price
  const { unitTotal, grandTotal, selectedModifiersList } = useMemo(() => {
    if (!item) return { unitTotal: 0, grandTotal: 0, selectedModifiersList: [] };

    let base = Number(item.price);
    const modsList: SelectedModifier[] = [];

    for (const grp of item.modifier_groups || []) {
      const selectedIds = selections[grp.id] || [];
      for (const optId of selectedIds) {
        const opt = grp.options.find((o) => o.id === optId);
        if (opt) {
          const delta = Number(opt.price_delta);
          base += delta;
          modsList.push({
            group_id: grp.id,
            group_name: grp.name,
            option_id: opt.id,
            option_name: opt.name,
            price_delta: delta,
          });
        }
      }
    }

    const finalUnit = Math.max(0, base);
    return {
      unitTotal: finalUnit,
      grandTotal: finalUnit * quantity,
      selectedModifiersList: modsList,
    };
  }, [item, selections, quantity]);

  if (!isOpen || !item) return null;

  const displayName = isUrdu && item.name_ur ? item.name_ur : item.name;
  const currencyDisplay = isUrdu ? "روپیہ" : currency;

  const handleSubmit = () => {
    if (!isSatisfied) {
      setValidationError(
        isUrdu
          ? "براہ کرم تمام لازمی اختیارات منتخب کریں۔"
          : "Please select all required options before proceeding."
      );
      return;
    }

    if (onAddToCart) {
      onAddToCart({
        item,
        selectedModifiers: selectedModifiersList,
        specialInstructions: specialInstructions.trim(),
        quantity,
        calculatedTotal: grandTotal,
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] bg-surface-card border-t border-surface-border rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        dir={isUrdu ? "rtl" : "ltr"}
      >
        {/* Hero Food Photography Header */}
        <div className="relative w-full h-44 sm:h-48 shrink-0 bg-surface-dark overflow-hidden">
          <img
            src={getDishImage(item)}
            alt={displayName}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/40 to-transparent" />

          {/* Drag Pill */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/40 rounded-full backdrop-blur-sm" />

          {/* Floating Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badges on Hero */}
          <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4 flex items-center gap-1.5">
            {item.dietary_tags?.includes("halal") && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/80 text-white font-bold text-[10px] backdrop-blur-sm shadow flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>{isUrdu ? "حلال" : "Halal"}</span>
              </span>
            )}
            {item.dietary_tags?.includes("spicy") && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/80 text-white font-bold text-[10px] backdrop-blur-sm shadow flex items-center gap-1">
                <Flame className="w-3 h-3" />
                <span>{isUrdu ? "تیز" : "Spicy"}</span>
              </span>
            )}
          </div>

          {/* Title & Price Overlay */}
          <div className="absolute bottom-3 left-6 right-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight drop-shadow-md">
                {displayName}
              </h2>
              {isUrdu ? (
                <p className="text-xs text-slate-300 drop-shadow">{item.name}</p>
              ) : (
                item.name_ur && (
                  <p className="text-xs text-slate-300 font-arabic drop-shadow" dir="rtl">
                    {item.name_ur}
                  </p>
                )
              )}
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs text-brand-300 font-medium block">
                {isUrdu ? "ابتدائی قیمت" : "Base Price"}
              </span>
              <span className="text-lg font-black text-white">
                {Number(item.price).toLocaleString()} {currencyDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Modifier Groups */}
          {item.modifier_groups?.map((group) => {
            const groupName = isUrdu && group.name_ur ? group.name_ur : group.name;
            const currentSelected = selections[group.id] || [];
            const isSingle = group.selection_type === "single";

            return (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      {groupName}
                    </h3>
                    {group.is_required && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        {isUrdu ? "لازمی" : "Required"}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {isSingle
                      ? isUrdu ? "ایک کا انتخاب" : "Choose 1"
                      : isUrdu
                      ? `زیادہ سے زیادہ ${group.max_selections}`
                      : `Max ${group.max_selections}`}
                  </span>
                </div>

                {/* Options List */}
                <div className="grid grid-cols-1 gap-2">
                  {group.options.map((opt) => {
                    const optName = isUrdu && opt.name_ur ? opt.name_ur : opt.name;
                    const isSelected = currentSelected.includes(opt.id);
                    const delta = Number(opt.price_delta);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleToggleOption(group, opt)}
                        className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl border flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-brand-500/15 border-brand-500 text-white font-medium"
                            : "glass-panel border-surface-border text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-${
                              isSingle ? "full" : "md"
                            } border flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-brand-500 border-brand-500 text-white"
                                : "border-slate-600 bg-surface-dark"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs">{optName}</span>
                        </div>

                        {delta !== 0 && (
                          <span
                            className={`text-xs font-semibold ${
                              delta > 0 ? "text-brand-300" : "text-emerald-400"
                            }`}
                          >
                            {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()}{" "}
                            {currencyDisplay}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Preparation Instructions */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                {isUrdu ? "خاص ہدایات (آپشنل)" : "Special Instructions (Optional)"}
              </label>
              <span className="text-[10px] text-slate-500">
                {specialInstructions.length}/150
              </span>
            </div>
            <textarea
              maxLength={150}
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder={
                isUrdu
                  ? "مثلاً: کم نمک، زیادہ تلا ہوا، ہری مرچیں الگ رکھیں..."
                  : "e.g., Less spicy, no mayo, extra napkins..."
              }
              className="w-full text-xs p-3 rounded-xl bg-surface-dark border border-surface-border focus:border-brand-500 focus:outline-none text-white placeholder-slate-500 resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-surface-dark/80 border-t border-surface-border flex items-center justify-between gap-4">
          {/* Quantity Counter */}
          <div className="flex items-center gap-2 glass-panel p-1 rounded-xl border border-surface-border">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center text-sm font-bold text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              aria-label="Increase quantity"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add CTA */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isSatisfied}
            className={`flex-1 min-h-[48px] px-6 py-3 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-between ${
              isSatisfied
                ? "bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white shadow-brand-500/25"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            <span>{isUrdu ? "آرڈر میں شامل کریں" : "Add to Order"}</span>
            <span className="font-extrabold text-sm">
              {grandTotal.toLocaleString()} {currencyDisplay}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
