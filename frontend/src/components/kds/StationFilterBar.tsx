"use client";

import React from "react";
import Link from "next/link";
import {
  Flame,
  Utensils,
  Coffee,
  Layers,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  ChefHat,
  ArrowLeft,
} from "lucide-react";
import { KitchenStation, KDSStatusFilter, KDSSummary } from "@/types/kds";

interface StationFilterBarProps {
  selectedStation: KitchenStation;
  statusFilter: KDSStatusFilter;
  summary: KDSSummary | null;
  soundEnabled: boolean;
  isConnected: boolean;
  onSelectStation: (station: KitchenStation) => void;
  onSelectStatus: (status: KDSStatusFilter) => void;
  onToggleSound: () => void;
}

const STATIONS: { id: KitchenStation; label: string; icon: any }[] = [
  { id: "all", label: "All Stations", icon: Layers },
  { id: "grill", label: "Grill Station", icon: Flame },
  { id: "fry", label: "Fry Station", icon: Utensils },
  { id: "hot_kitchen", label: "Hot Kitchen", icon: ChefHat },
  { id: "beverage", label: "Beverage", icon: Coffee },
];

export function StationFilterBar({
  selectedStation,
  statusFilter,
  summary,
  soundEnabled,
  isConnected,
  onSelectStation,
  onSelectStatus,
  onToggleSound,
}: StationFilterBarProps) {
  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Return & Station Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <Link
            href="/admin"
            className="min-h-[46px] px-3 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700/60 flex items-center justify-center shrink-0 transition-colors"
            title="Return to Operations Portal"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          {STATIONS.map((station) => {
            const Icon = station.icon;
            const isSelected = selectedStation === station.id;
            const count =
              station.id === "all"
                ? summary?.total_active ?? 0
                : summary?.by_station[station.id] ?? 0;

            return (
              <button
                key={station.id}
                type="button"
                onClick={() => onSelectStation(station.id)}
                className={`min-h-[46px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20 scale-[1.02]"
                    : "bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{station.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-700 text-brand-300"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Status Filters & Controls */}
        <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
          {/* Status Sub-Filters */}
          <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
            {(["ALL", "NEW", "PREPARING", "READY"] as KDSStatusFilter[]).map(
              (st) => {
                const isActive = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onSelectStatus(st)}
                    className={`min-h-[36px] px-3 py-1 rounded-lg font-bold transition-all ${
                      isActive
                        ? "bg-slate-800 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {st === "ALL"
                      ? "All"
                      : st === "NEW"
                      ? `New (${summary?.new ?? 0})`
                      : st === "PREPARING"
                      ? `Prep (${summary?.preparing ?? 0})`
                      : `Ready (${summary?.ready ?? 0})`}
                  </button>
                );
              }
            )}
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? "Mute audio chimes" : "Enable audio chimes"}
            title={soundEnabled ? "Audio chime ON" : "Audio chime MUTED"}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all border ${
              soundEnabled
                ? "bg-slate-800 border-slate-700 text-brand-400 shadow-inner"
                : "bg-slate-900 border-slate-800 text-slate-500"
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>

          {/* Live Kitchen Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
            title={isConnected ? "Kitchen Live Sync Active" : "Reconnecting..."}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-400 hidden sm:inline">
                  LIVE
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-400 hidden sm:inline">
                  RECONNECTING
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
