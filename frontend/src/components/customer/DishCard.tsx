"use client";

import React, { useState } from "react";
import { MenuItem } from "@/types/menu";
import { Clock, Flame, Leaf, ShieldCheck, Plus, Ban, Sparkles } from "lucide-react";
import { getDishImage } from "@/lib/dishImages";

interface DishCardProps {
  item: MenuItem;
  currency?: string;
  language?: "en" | "ur";
  onSelect: (item: MenuItem) => void;
}

export function DishCard({
  item,
  currency = "PKR",
  language = "en",
  onSelect,
}: DishCardProps) {
  const isUrdu = language === "ur";
  const displayName = isUrdu && item.name_ur ? item.name_ur : item.name;
  const displayDesc = isUrdu && item.description_ur ? item.description_ur : item.description;

  const formattedPrice = Number(item.price).toLocaleString();
  const currencyDisplay = isUrdu ? "روپیہ" : currency;
  const isSoldOut = !item.is_available;

  const imageUrl = getDishImage(item);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={() => {
        if (!isSoldOut) onSelect(item);
      }}
      className={`relative group rounded-3xl p-4 transition-all duration-300 border cursor-pointer select-none overflow-hidden ${
        isSoldOut
          ? "bg-surface-card/40 border-surface-border/40 opacity-70 grayscale-[50%]"
          : "glass-panel border-surface-border hover:border-brand-500/50 hover:shadow-2xl hover:shadow-brand-500/10 hover:-translate-y-0.5"
      }`}
    >
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Dish Info Column */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
              {item.dietary_tags?.includes("halal") && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{isUrdu ? "حلال" : "Halal"}</span>
                </span>
              )}
              {item.dietary_tags?.includes("spicy") && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Flame className="w-3 h-3 text-amber-500" />
                  <span>{isUrdu ? "تیز مرچ" : "Spicy"}</span>
                </span>
              )}
              {item.dietary_tags?.includes("vegetarian") && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                  <Leaf className="w-3 h-3" />
                  <span>{isUrdu ? "سبزی" : "Veg"}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-surface-dark/70 px-2 py-0.5 rounded-full border border-surface-border">
                <Clock className="w-3 h-3 text-brand-400" />
                <span>
                  {item.expected_prep_minutes} {isUrdu ? "منٹ" : "mins"}
                </span>
              </span>
            </div>

            {/* Dish Name */}
            <h3 className="text-base font-extrabold text-white group-hover:text-brand-300 transition-colors tracking-tight mb-1">
              {displayName}
            </h3>

            {/* Bilingual Secondary Subtitle */}
            {isUrdu ? (
              <p className="text-xs text-slate-500 font-sans mb-2 font-medium">{item.name}</p>
            ) : (
              item.name_ur && (
                <p className="text-xs text-slate-500 font-arabic mb-2" dir="rtl">
                  {item.name_ur}
                </p>
              )
            )}

            {/* Description */}
            {displayDesc && (
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                {displayDesc}
              </p>
            )}
          </div>

          {/* Bottom Bar: Price & Customization */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-border/40 mt-auto">
            <div className="text-lg font-black text-white">
              {isUrdu ? (
                <span>
                  {formattedPrice}{" "}
                  <span className="text-xs text-brand-400 font-semibold">{currencyDisplay}</span>
                </span>
              ) : (
                <span>
                  <span className="text-xs text-brand-400 font-semibold mr-1">{currencyDisplay}</span>
                  {formattedPrice}
                </span>
              )}
            </div>

            {item.modifier_groups && item.modifier_groups.length > 0 && (
              <span className="text-[11px] font-bold text-brand-400/90 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{isUrdu ? "ترمیم شدہ" : "Customizable"}</span>
              </span>
            )}
          </div>
        </div>

        {/* Dish Thumbnail & Action Column */}
        <div className="relative w-full sm:w-36 h-36 sm:h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10 bg-surface-dark shadow-inner group">
          <img
            src={imgError ? "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80" : imageUrl}
            alt={displayName}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
          />

          {/* Sold Out Overlay */}
          {isSoldOut ? (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-2">
              <Ban className="w-5 h-5 text-rose-400 mb-1" />
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-300">
                {isUrdu ? "ختم ہو گیا" : "Sold Out"}
              </span>
            </div>
          ) : (
            /* Floating Quick Add Pill Button */
            <div className="absolute bottom-2 right-2 rtl:right-auto rtl:left-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item);
                }}
                aria-label={`Select ${item.name}`}
                className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-90 text-white font-black text-xs shadow-lg shadow-black/40 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden xs:inline">
                  {item.modifier_groups && item.modifier_groups.length > 0
                    ? isUrdu ? "اختیار" : "Customize"
                    : isUrdu ? "شامل" : "Add"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
