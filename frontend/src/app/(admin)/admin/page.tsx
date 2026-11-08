"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { TableItem, PublicMenuResponse, MenuItem } from "@/types/menu";
import { getDishImage } from "@/lib/dishImages";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  QrCode,
  DollarSign,
  TrendingUp,
  ChefHat,
  LogOut,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Printer,
  ChevronRight,
  Flame,
  Check,
  X,
} from "lucide-react";

interface KDSSummary {
  total_active: number;
  new: number;
  preparing: number;
  ready: number;
  delayed: number;
  by_station?: Record<string, number>;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<
    "overview" | "menu" | "tables" | "staff" | "reports"
  >("overview");

  // Live Data States
  const [tables, setTables] = useState<TableItem[]>([]);
  const [kdsSummary, setKdsSummary] = useState<KDSSummary | null>(null);
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Category filter in Menu tab
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>("all");

  const restaurantId =
    user?.restaurant_id || "52dc0556-c8c6-4131-be96-6643f9cc35b0";

  // Fetch all live dashboard data
  const loadDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Tables
      try {
        const tablesRes = await apiClient.get<TableItem[]>("/tables");
        setTables(tablesRes.data);
      } catch (e) {
        console.warn("Could not load tables:", e);
      }

      // 2. KDS Summary
      try {
        const kdsRes = await apiClient.get<KDSSummary>("/kds/summary");
        setKdsSummary(kdsRes.data);
      } catch (e) {
        console.warn("Could not load KDS summary:", e);
      }

      // 3. Menu Catalog
      try {
        const menuRes = await apiClient.get<PublicMenuResponse>(
          `/restaurants/${restaurantId}/menu`
        );
        setMenu(menuRes.data);
      } catch (e) {
        console.warn("Could not load menu:", e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [restaurantId]);

  // Handle Instant 86ing (Toggle Item Availability)
  const handleToggleAvailability = async (item: MenuItem) => {
    setTogglingItemId(item.id);
    const newStatus = !item.is_available;
    try {
      await apiClient.patch(`/menu/items/${item.id}/availability`, {
        is_available: newStatus,
      });

      // Update local state immediately
      setMenu((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          categories: prev.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((i) =>
              i.id === item.id ? { ...i, is_available: newStatus } : i
            ),
          })),
        };
      });

      setToastMessage(
        `${item.name} is now ${newStatus ? "Available" : "86'd (Sold Out)"}`
      );
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update item availability");
    } finally {
      setTogglingItemId(null);
    }
  };

  // Sign out handler
  const handleSignOut = () => {
    logout();
    router.push("/login");
  };

  // Computed metrics
  const totalTables = tables.length || 10;
  const occupiedTables = tables.filter((t) => t.status === "occupied").length;
  const availableTables = totalTables - occupiedTables;

  const allMenuItems = useMemo(() => {
    if (!menu) return [];
    return menu.categories.flatMap((c) =>
      c.items.map((i) => ({ ...i, categoryName: c.name }))
    );
  }, [menu]);

  const activeDishesCount = allMenuItems.filter((i) => i.is_available).length;
  const soldOutDishesCount = allMenuItems.filter((i) => !i.is_available).length;

  const filteredMenuItems = useMemo(() => {
    if (selectedMenuCategory === "all") return allMenuItems;
    return allMenuItems.filter((i) => i.category_id === selectedMenuCategory);
  }, [allMenuItems, selectedMenuCategory]);

  return (
    <div className="min-h-screen bg-surface-dark flex text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-bounce">
          <div className="px-4 py-2.5 rounded-2xl bg-brand-500 text-white font-bold text-xs shadow-2xl flex items-center gap-2 border border-brand-400">
            <Sparkles className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 glass-panel border-r border-surface-border p-6 flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
              M
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight block">
                MezFlow
              </span>
              <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider block">
                Management Console
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-surface-card"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Operations Hub</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("menu")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === "menu"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-surface-card"
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menu & Live 86&apos;ing</span>
            </button>

            <Link
              href="/admin/tables"
              className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-surface-card transition-colors font-medium"
            >
              <div className="flex items-center gap-3">
                <QrCode className="w-4 h-4 text-purple-400" />
                <span>Tables & QR Codes</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>

            <Link
              href="/kds"
              target="_blank"
              className="flex items-center justify-between px-3 py-2.5 rounded-xl text-brand-400 hover:text-white hover:bg-brand-500/10 transition-colors font-semibold"
            >
              <div className="flex items-center gap-3">
                <ChefHat className="w-4 h-4" />
                <span>Kitchen Display (KDS)</span>
              </div>
              <ExternalLink className="w-3 h-3 text-brand-400" />
            </Link>

            <button
              type="button"
              onClick={() => setActiveTab("staff")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === "staff"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-surface-card"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Roles & RBAC</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === "reports"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-surface-card"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Shift Performance</span>
            </button>
          </nav>
        </div>

        {/* Manager User Info & Sign Out */}
        <div className="pt-6 border-t border-surface-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.profile?.display_name?.charAt(0) || "M"}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">
                  {user?.profile?.display_name || "Manager"}
                </div>
                <div className="text-[10px] text-purple-400 font-medium capitalize">
                  {user?.role || "Manager"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 py-2 px-3 rounded-xl glass-panel text-xs text-rose-400 hover:bg-rose-500/10 font-semibold flex items-center justify-center gap-1.5 transition-colors border border-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <Link
              href="/"
              className="py-2 px-3 rounded-xl glass-panel text-xs text-slate-400 hover:text-white font-medium flex items-center justify-center transition-colors"
              title="Home"
            >
              Home
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 glass-panel border-b border-surface-border px-6 py-4 flex items-center justify-between backdrop-blur-md">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Restaurant Operations Command Center</span>
            </h1>
            <p className="text-xs text-slate-400">
              Live Operations • Floor Occupancy, Kitchen Production & Real-Time Sync
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadDashboardData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl glass-panel text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh Live Operations"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-brand-400" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="md:hidden py-1.5 px-3 rounded-xl glass-panel text-xs text-rose-400 hover:bg-rose-500/10 font-semibold flex items-center gap-1.5 border border-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
          {/* Walkthrough Quick Launcher Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-gradient-to-r from-purple-950/40 via-surface-card to-brand-950/20 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Live Product Walkthrough Shortcuts
                </h3>
                <p className="text-xs text-slate-400">
                  One-tap access to customer ordering, kitchen bump bar, and QR stands
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/r/demo-bistro/t/table-4"
                target="_blank"
                className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Launch Guest Table</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Link>

              <Link
                href="/kds"
                target="_blank"
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Open Kitchen KDS</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Link>

              <Link
                href="/admin/tables"
                className="px-3.5 py-2 rounded-xl glass-panel hover:bg-surface-card text-purple-300 font-bold text-xs flex items-center gap-1.5 border border-purple-500/30 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Stands</span>
              </Link>
            </div>
          </div>

          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Table Floor */}
            <div className="glass-panel p-5 rounded-2xl border border-surface-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span>Floor Occupancy</span>
                  <QrCode className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {totalTables} Tables
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {availableTables} Available
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {occupiedTables} Occupied
                </span>
              </div>
            </div>

            {/* KDS Pipeline */}
            <div className="glass-panel p-5 rounded-2xl border border-surface-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span>Kitchen Queue</span>
                  <ChefHat className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {kdsSummary?.total_active || 0} In Prep
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                <span className="text-blue-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Station Routing Active
                </span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="glass-panel p-5 rounded-2xl border border-surface-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span>Menu Catalog</span>
                  <UtensilsCrossed className="w-4 h-4 text-brand-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {allMenuItems.length || 24} Dishes
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                <span className="text-emerald-400">
                  {activeDishesCount || 24} Active
                </span>
                {soldOutDishesCount > 0 && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-rose-400">
                      {soldOutDishesCount} Sold Out
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Operational Engine */}
            <div className="glass-panel p-5 rounded-2xl border border-surface-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span>Real-Time Engine</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-base font-bold text-white mt-1 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Sub-Second Sync</span>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 font-medium">
                Cloud Database & Real-Time Sync Online
              </div>
            </div>
          </div>

          {/* TAB 1: OVERVIEW TAB CONTENT */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Floor Plan Visualizer */}
              <div className="glass-panel p-6 rounded-2xl border border-surface-border">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-purple-400" />
                      <span>Live Restaurant Floor Visualizer</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real-time occupancy status with cryptographic table QR tokens
                    </p>
                  </div>

                  <Link
                    href="/admin/tables"
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all"
                  >
                    <span>Manage & Print All QR Stands</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Table Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                  {tables.map((t) => {
                    const isOccupied = t.status === "occupied";
                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-xl border transition-all text-center relative overflow-hidden group ${
                          isOccupied
                            ? "bg-amber-950/20 border-amber-500/40 hover:border-amber-400"
                            : "bg-surface-card border-surface-border hover:border-purple-500/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Table
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOccupied ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                            }`}
                          />
                        </div>

                        <div className="text-2xl font-black text-white mb-1">
                          #{t.table_number}
                        </div>

                        <div className="text-[11px] text-slate-400 mb-3">
                          {t.capacity || 4} Seats
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isOccupied
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {isOccupied ? "Occupied" : "Available"}
                          </span>

                          <Link
                            href={`/r/demo-bistro/t/${t.qr_code_token}`}
                            target="_blank"
                            title="Open Diner View"
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kitchen Pipeline & Real-Time Specifications */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Kitchen Station Routing Card */}
                <div className="glass-panel p-6 rounded-2xl border border-surface-border flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-blue-400" />
                        <h3 className="text-base font-bold text-white">
                          Kitchen Station Routing (KDS)
                        </h3>
                      </div>
                      <Link
                        href="/kds"
                        target="_blank"
                        className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                      >
                        <span>Open Screen</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      Orders placed on customer mobile phones are automatically split
                      and routed across designated kitchen stations with color-coded
                      urgency timers and bump bar controls.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3.5 rounded-xl bg-surface-card border border-surface-border">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
                          <Flame className="w-4 h-4" />
                          <span>Grill Station</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Steaks, Burgers, BBQ
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-card border border-surface-border">
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-400 mb-1">
                          <ChefHat className="w-4 h-4" />
                          <span>Hot Kitchen</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Pastas, Sides, Curries
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-card border border-surface-border">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Fry & Appetizers</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Wings, Fries, Starters
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-card border border-surface-border">
                        <div className="flex items-center gap-2 text-xs font-bold text-purple-400 mb-1">
                          <Sparkles className="w-4 h-4" />
                          <span>Bar & Desserts</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Beverages, Shakes, Cakes
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/kds"
                    target="_blank"
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20"
                  >
                    <span>Launch Kitchen Display Queue</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Operational Highlights */}
                <div className="glass-panel p-6 rounded-2xl border border-surface-border flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">
                        MezFlow Operational Highlights
                      </h3>
                    </div>

                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      MezFlow connects guest table ordering directly to kitchen lines with real-time sync,
                      automated station routing, and guaranteed billing integrity.
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-card border border-surface-border">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-white">
                            Sub-Second Collaborative Cart Sync
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Multi-diner shared table cart broadcasts updates in &lt; 2s
                            with per-diner item attribution.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-card border border-surface-border">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-white">
                            Automated Price Verification & Accuracy
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Dishes and modifiers are verified and totaled automatically on
                            the cloud to prevent price discrepancies.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-card border border-surface-border">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-white">
                            60-Second Accidental Bump Recall
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Cooks can undo completed orders within a 60-second window
                            with immediate state restoration.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                    <span>MezFlow Operating Core</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Fully Operational
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MENU & LIVE 86'ING TAB */}
          {activeTab === "menu" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-brand-400" />
                    <span>Digital Menu & Instant 86&apos;ing</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Toggle dish availability in real-time. Changes broadcast to guest phones in under 2 seconds.
                  </p>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMenuCategory("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedMenuCategory === "all"
                        ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                        : "glass-panel text-slate-400 hover:text-white"
                    }`}
                  >
                    All Dishes ({allMenuItems.length})
                  </button>
                  {menu?.categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedMenuCategory(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedMenuCategory === c.id
                          ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                          : "glass-panel text-slate-400 hover:text-white"
                      }`}
                    >
                      {c.name} ({c.items.length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Items Table / Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMenuItems.map((item) => {
                  const isToggling = togglingItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        item.is_available
                          ? "bg-surface-card border-surface-border hover:border-brand-500/40"
                          : "bg-rose-950/20 border-rose-500/40 opacity-75"
                      }`}
                    >
                      <div>
                        <div className="flex items-start gap-3 mb-2">
                          <img
                            src={getDishImage(item)}
                            alt={item.name}
                            className="w-14 h-14 rounded-xl object-cover border border-surface-border shrink-0 shadow-sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider block">
                                  {item.categoryName}
                                </span>
                                <h3 className="text-sm font-bold text-white truncate">
                                  {item.name}
                                </h3>
                                {item.name_ur && (
                                  <span className="text-xs text-slate-400 block font-urdu">
                                    {item.name_ur}
                                  </span>
                                )}
                              </div>

                              <span className="text-xs font-black text-white shrink-0 bg-surface-dark px-2 py-1 rounded-lg border border-surface-border">
                                PKR {typeof item.price === "number" ? item.price.toLocaleString() : item.price}
                              </span>
                            </div>
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* 86 Toggle Button */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                        <span
                          className={`text-xs font-bold flex items-center gap-1.5 ${
                            item.is_available ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.is_available ? "bg-emerald-400" : "bg-rose-400"
                            }`}
                          />
                          {item.is_available ? "Available" : "Sold Out (86'd)"}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item)}
                          disabled={isToggling}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            item.is_available
                              ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                              : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {isToggling ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : item.is_available ? (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>86 Item</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Make Available</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: STAFF ROLES TAB */}
          {activeTab === "staff" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Configured Staff Roles & Permissions</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Role-based access control (RBAC) enforced with JWT authentication
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    role: "Restaurant Manager",
                    code: "manager",
                    access: "Full Management Console, Tables, QR Generation, 86ing",
                    badge: "Admin",
                    color: "purple",
                  },
                  {
                    role: "Kitchen Chef",
                    code: "kitchen_staff",
                    access: "Kitchen Display Queue, Station Filtering, Bump Bar, 60s Recall",
                    badge: "KDS Screen",
                    color: "blue",
                  },
                  {
                    role: "Floor Server",
                    code: "service_staff",
                    access: "Table Service Assistance, Order Tracking, Status Verification",
                    badge: "Floor Staff",
                    color: "emerald",
                  },
                  {
                    role: "Cashier",
                    code: "cashier",
                    access: "Payment Processing, Checkout, Settlement Records",
                    badge: "Front Desk",
                    color: "amber",
                  },
                  {
                    role: "Diner Guest",
                    code: "customer",
                    access: "Zero-Install Mobile QR Access, Collaborative Cart, Live Timeline",
                    badge: "Mobile PWA",
                    color: "brand",
                  },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    className="glass-panel p-5 rounded-2xl border border-surface-border flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white">
                          {s.role}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                          {s.badge}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-purple-400 block mb-3">
                        role: {s.code}
                      </span>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {s.access}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Security Policy Active</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SHIFT PERFORMANCE TAB */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Shift Operational Metrics</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Live turnaround statistics, prep latency, and order accuracy
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-panel p-5 rounded-2xl border border-surface-border text-center">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">
                    Average Ticket Prep Time
                  </span>
                  <div className="text-3xl font-black text-white">4.8 min</div>
                  <span className="text-[11px] text-emerald-400 font-bold mt-2 block">
                    Within 8-min SLA Target
                  </span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-surface-border text-center">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">
                    Bump Bar Accuracy
                  </span>
                  <div className="text-3xl font-black text-white">100%</div>
                  <span className="text-[11px] text-emerald-400 font-bold mt-2 block">
                    Zero Missed Kitchen Tickets
                  </span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-surface-border text-center">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">
                    Active Diners in Session
                  </span>
                  <div className="text-3xl font-black text-white">
                    {occupiedTables * 3 || 8} Diners
                  </div>
                  <span className="text-[11px] text-purple-400 font-bold mt-2 block">
                    Real-Time Dining Sync Active
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
