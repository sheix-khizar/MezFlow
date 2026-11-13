"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  QrCode,
  ChefHat,
  LayoutDashboard,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  Zap,
  TrendingUp,
  Smartphone,
  Monitor,
  Sliders,
  RefreshCw,
  Users,
  Check,
  ExternalLink,
  ChevronRight,
  Flame,
  Utensils,
  LogIn,
  BarChart3,
  Coffee,
  Radio,
  FileText,
  Printer,
  Shield,
  Award,
} from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuthStore } from "@/lib/authStore";
import { warmupBackend } from "@/lib/api";

export default function HomePage() {
  const { language } = useAuthStore();
  const isUrdu = language === "ur";

  useEffect(() => {
    warmupBackend();
  }, []);

  // Interactive Pillar Tab State in Section 2
  const [activePillarTab, setActivePillarTab] = useState<"guest" | "kds" | "admin">("guest");

  return (
    <div className="min-h-screen bg-surface-dark text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* =========================================================================
          TOP NAVIGATION BAR (Sticky Glassmorphic Header)
         ========================================================================= */}
      <header className="sticky top-0 z-50 glass-panel border-b border-surface-border/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-transform">
              M
            </div>
            <div>
              <span className="font-black text-white text-xl tracking-tight block leading-tight">
                MezFlow
              </span>
              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest block">
                Hospitality Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
            <a href="#hero" className="hover:text-brand-400 transition-colors">
              Overview
            </a>
            <a href="#pillars" className="hover:text-brand-400 transition-colors">
              Product Suite
            </a>
            <a href="#how-it-works" className="hover:text-brand-400 transition-colors">
              How It Works
            </a>
            <a href="#benefits" className="hover:text-brand-400 transition-colors">
              Why MezFlow
            </a>
            <a href="#live-demo" className="hover:text-brand-400 transition-colors">
              Interactive Demo
            </a>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            <LanguageToggle />

            <Link
              href="/login"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/10 text-slate-200 text-xs font-bold border border-white/10 hover:border-brand-500/40 transition-all shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5 text-brand-400" />
              <span>Sign In</span>
            </Link>

            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-amber-500 hover:from-brand-500 hover:to-amber-400 text-white text-xs font-extrabold shadow-lg shadow-brand-500/20 active:scale-95 transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* =========================================================================
          SECTION 1: HERO SECTION (The Hook, Value Proposition & Live Pipeline)
         ========================================================================= */}
      <section id="hero" className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Ambient Glow Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-brand-500/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Consumer SaaS Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border border-brand-500/30 text-xs font-bold text-brand-300 mb-8 shadow-xl shadow-brand-500/10 animate-fade-in">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>The Modern All-In-One Restaurant Operations Platform</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6">
            Turn Tables 35% Faster with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-amber-400 to-brand-500">
              Zero-Install Collaborative Dining
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-slate-300/90 max-w-3xl mx-auto leading-relaxed mb-10">
            Diners scan tabletop QR stands to browse, customize, and order together in a
            synchronized live cart. Orders route instantly to a paperless Kitchen Display
            System without expensive proprietary hardware.
          </p>

          {/* Primary Action Button Cluster */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link
              href="/r/demo-bistro/t/table-4"
              className="px-6 py-4 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-amber-500 hover:from-brand-500 hover:to-amber-400 text-white font-extrabold text-sm sm:text-base flex items-center gap-2.5 shadow-2xl shadow-brand-500/30 active:scale-95 transition-all group"
            >
              <QrCode className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span>Launch Guest Dining App</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/kds"
              className="px-6 py-4 rounded-2xl glass-panel hover:bg-white/10 text-slate-200 font-extrabold text-sm sm:text-base flex items-center gap-2.5 border border-surface-border hover:border-blue-500/50 shadow-xl transition-all"
            >
              <ChefHat className="w-5 h-5 text-blue-400" />
              <span>Open Kitchen Display (KDS)</span>
            </Link>

            <Link
              href="/admin"
              className="px-6 py-4 rounded-2xl glass-panel hover:bg-white/10 text-slate-200 font-extrabold text-sm sm:text-base flex items-center gap-2.5 border border-surface-border hover:border-purple-500/50 shadow-xl transition-all"
            >
              <LayoutDashboard className="w-5 h-5 text-purple-400" />
              <span>Operations Command Center</span>
            </Link>
          </div>

          {/* Interactive Live Flow Showcase */}
          <div className="max-w-5xl mx-auto rounded-3xl glass-panel border border-surface-border/80 p-6 sm:p-8 shadow-2xl bg-surface-dark/80 backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-surface-border/60 mb-6">
              <div className="flex items-center gap-2 text-left">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Table-to-Kitchen Workflow
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                Instant Cloud Sync & Direct Kitchen Routing
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Pipeline Step 1: Diner App Mock */}
              <div className="rounded-2xl bg-surface-card border border-surface-border p-5 text-left relative overflow-hidden group hover:border-brand-500/50 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20">
                    Step 1 • Table 4
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    3 Diners Seated
                  </span>
                </div>
                <h4 className="text-sm font-black text-white mb-1">
                  Collaborative Guest Cart
                </h4>
                <p className="text-xs text-slate-400 mb-4">
                  Guests scan tabletop QR, customize choices, and add dishes together.
                </p>
                <div className="bg-surface-dark rounded-xl p-3 border border-surface-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-500 text-white font-black text-[10px] flex items-center justify-center">
                      K
                    </div>
                    <span className="text-slate-200 font-semibold truncate max-w-[110px]">
                      Shinwari Karahi
                    </span>
                  </div>
                  <span className="font-black text-brand-400">PKR 2,450</span>
                </div>
              </div>

              {/* Pipeline Step 2: Real-Time Sync Connector */}
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-3 shadow-lg shadow-brand-500/20">
                  <Zap className="w-7 h-7 animate-bounce" />
                </div>
                <span className="text-xs font-black text-white mb-0.5">
                  Instant Cloud Dispatch
                </span>
                <span className="text-[11px] text-slate-400">
                  Automatic real-time routing directly to cook lines and kitchen display screens
                </span>
              </div>

              {/* Pipeline Step 3: Kitchen KDS Ticket Mock */}
              <div className="rounded-2xl bg-surface-card border border-surface-border p-5 text-left relative overflow-hidden group hover:border-blue-500/50 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                    Step 2 • KDS Ticket #104
                  </span>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    04:12 elapsed
                  </span>
                </div>
                <h4 className="text-sm font-black text-white mb-1">
                  Automated Station Routing
                </h4>
                <p className="text-xs text-slate-400 mb-4">
                  Separated into Grill & Hot Kitchen stations with live prep countdowns.
                </p>
                <div className="bg-surface-dark rounded-xl p-3 border border-surface-border flex items-center justify-between text-xs">
                  <span className="text-slate-200 font-semibold">Grill Station • 2 items</span>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                    Cooking Now
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof & Performance Metric Ticker */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center border-t border-surface-border/60 pt-12">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                0 Apps
              </div>
              <div className="text-xs font-medium text-slate-400 mt-1">
                Zero Friction (Instant Mobile Web)
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-brand-400 tracking-tight">
                &lt; 2s
              </div>
              <div className="text-xs font-medium text-slate-400 mt-1">
                Real-Time Order Sync Speed
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                +28%
              </div>
              <div className="text-xs font-medium text-slate-400 mt-1">
                Average Check Size with Modifiers
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-blue-400 tracking-tight">
                100%
              </div>
              <div className="text-xs font-medium text-slate-400 mt-1">
                Automated Price & Billing Accuracy
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: THREE CORE PRODUCT PILLARS (Interactive Deep-Dive)
         ========================================================================= */}
      <section id="pillars" className="py-20 md:py-28 bg-surface-dark/95 border-t border-surface-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black text-brand-400 uppercase tracking-widest block mb-2">
              Core Product Suite
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              Three Systems Operating in Complete Synchronization
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Designed from the ground up for high-volume restaurants. Every touchpoint is
              interconnected in real-time for seamless front-of-house and back-of-house harmony.
            </p>
          </div>

          {/* Pillar Selector Tabs */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex rounded-2xl glass-panel p-1.5 border border-surface-border text-xs sm:text-sm font-bold">
              <button
                type="button"
                onClick={() => setActivePillarTab("guest")}
                className={`px-4 sm:px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                  activePillarTab === "guest"
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Guest Dining App</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePillarTab("kds")}
                className={`px-4 sm:px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                  activePillarTab === "kds"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ChefHat className="w-4 h-4" />
                <span>Kitchen Display (KDS)</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePillarTab("admin")}
                className={`px-4 sm:px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                  activePillarTab === "admin"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Operations Center</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Guest Dining Experience */}
          {activePillarTab === "guest" && (
            <div className="rounded-3xl glass-panel border border-brand-500/30 p-8 sm:p-12 shadow-2xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-fade-in">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-500/15 text-brand-300 text-xs font-black">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Dine-In Guest Experience • Scan to Order</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Zero-Install Collaborative Table Ordering
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Guests scan an acrylic tabletop QR stand with their native smartphone camera.
                  Multiple diners join the same live table session simultaneously, seeing dishes
                  added by their companions in real-time with per-diner avatar badges.
                </p>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Secure table QR codes ensure orders are placed exclusively by seated diners</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Interactive modifier choices (spice levels, portion sizes, add-ons)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Full bilingual English & Urdu RTL support with high-resolution food photography</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Live order tracking timeline showing preparation progress from station to table</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Link
                    href="/r/demo-bistro/t/table-4"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/25 transition-all"
                  >
                    <span>Launch Live Guest Table 4</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Guest App Visual Card */}
              <div className="rounded-2xl bg-surface-card border border-surface-border p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white">Table 4 • Main Dining</span>
                  </div>
                  <span className="text-[11px] font-bold text-brand-400">Live Kitchen Link</span>
                </div>
                <div className="flex -space-x-2 overflow-hidden py-1">
                  <div className="w-7 h-7 rounded-full bg-amber-500 border-2 border-surface-card flex items-center justify-center text-[10px] font-black text-slate-950">
                    K
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-surface-card flex items-center justify-center text-[10px] font-black text-white">
                    T
                  </div>
                  <div className="w-7 h-7 rounded-full bg-blue-500 border-2 border-surface-card flex items-center justify-center text-[10px] font-black text-white">
                    S
                  </div>
                  <span className="pl-3 text-xs text-slate-300 self-center font-medium">
                    3 diners sharing this cart
                  </span>
                </div>
                <div className="rounded-xl bg-surface-dark p-3 border border-surface-border space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white">Seekh Kebab Platter</span>
                    <span className="font-black text-brand-400">PKR 1,650</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Added by Khizar • Medium Spice, Mint Raita
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Kitchen Display System (KDS) */}
          {activePillarTab === "kds" && (
            <div className="rounded-3xl glass-panel border border-blue-500/30 p-8 sm:p-12 shadow-2xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-fade-in">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-black">
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Kitchen Display System • Paperless Cook Queue</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Paperless Real-Time Kitchen Production
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Eliminate noisy ticket printers and lost paper chits. The MezFlow KDS runs on
                  any tablet or touch monitor, providing cooks with instant order dispatch,
                  station routing, and urgency countdowns.
                </p>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Intelligent multi-station routing (Grill, Hot Kitchen, Fry, Drinks)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Color-coded urgency alerts (&lt;5m Normal, 5–10m Warning, &gt;10m Flashing Red)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>One-tap bump bar with a 60-second accidental bump recall countdown</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pleasant audio chime alerts on new incoming tickets</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Link
                    href="/kds"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/25 transition-all"
                  >
                    <span>Open Kitchen KDS Queue</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* KDS App Visual Card */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white">#102</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold">
                      Table 2
                    </span>
                  </div>
                  <span className="text-xs font-black text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded animate-pulse">
                    12:45 • DELAYED
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                    <span className="text-white font-bold">1x Smash Beef Burger</span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">Ready</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                    <span className="text-white font-bold">1x Peri Peri Wings</span>
                    <span className="text-[10px] text-amber-400 font-bold uppercase">Cooking</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider shadow"
                >
                  Mark Order Complete (Bump)
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Operations Command Center */}
          {activePillarTab === "admin" && (
            <div className="rounded-3xl glass-panel border border-purple-500/30 p-8 sm:p-12 shadow-2xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-fade-in">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-black">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Manager Portal • Real-Time Floor Control</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Total Visibility Over Floor, Menu, & Staff
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Empower general managers with an interactive floor occupancy map, real-time
                  dish availability controls, print-ready acrylic QR stands, and role-based staff management.
                </p>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Real-time floor occupancy visualizer (Available vs Seated vs Billed)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Real-time availability toggles that update sold-out dishes for diners in &lt;2s</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Professional acrylic QR stand generator with high-resolution print exports</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Role-based permissions across managers, chefs, servers, and cashiers</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-600/25 transition-all"
                  >
                    <span>Enter Operations Admin</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Admin App Visual Card */}
              <div className="rounded-2xl bg-surface-card border border-surface-border p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-xs font-bold text-white">Live Floor Visualizer</span>
                  <span className="text-[11px] font-bold text-emerald-400">10 Tables Active</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => (
                    <div
                      key={t}
                      className={`p-2.5 rounded-xl text-center text-xs font-black border ${
                        t === 4 || t === 2
                          ? "bg-brand-500/20 text-brand-400 border-brand-500/40"
                          : "bg-surface-dark text-slate-400 border-surface-border"
                      }`}
                    >
                      T{t}
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex justify-between items-center text-xs border-t border-surface-border">
                  <span className="text-slate-400">Live Availability Control</span>
                  <span className="text-emerald-400 font-bold">16 / 16 Dishes Available</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: HOW IT WORKS (The 4-Step Collaborative Loop)
         ========================================================================= */}
      <section id="how-it-works" className="py-20 md:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black text-brand-400 uppercase tracking-widest block mb-2">
              Workflow Lifecycle
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              A Seamless 4-Step Dining Loop
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              From the moment guests sit down to the moment their hot dishes are plated and served.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="rounded-3xl glass-panel border border-surface-border p-6 relative overflow-hidden group hover:border-brand-500/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 font-black text-lg mb-5 group-hover:scale-110 transition-transform">
                01
              </div>
              <h3 className="text-base font-extrabold text-white mb-2">
                Scan Table QR Stand
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Guests scan the tabletop acrylic QR code with their phone camera to instantly open
                the interactive digital menu and start ordering.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl glass-panel border border-surface-border p-6 relative overflow-hidden group hover:border-amber-500/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-lg mb-5 group-hover:scale-110 transition-transform">
                02
              </div>
              <h3 className="text-base font-extrabold text-white mb-2">
                Collaborative Cart
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Friends at the same table join in real-time. Everyone adds dishes, selects spice
                levels, and watches cart items synchronize live with avatar colors.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-3xl glass-panel border border-surface-border p-6 relative overflow-hidden group hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-lg mb-5 group-hover:scale-110 transition-transform">
                03
              </div>
              <h3 className="text-base font-extrabold text-white mb-2">
                Instant Order Confirmation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tapping &quot;Send to Kitchen&quot; immediately submits the order to cook lines with
                guaranteed price accuracy and protection against duplicate submissions.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-3xl glass-panel border border-surface-border p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-lg mb-5 group-hover:scale-110 transition-transform">
                04
              </div>
              <h3 className="text-base font-extrabold text-white mb-2">
                Station Dispatch & Bump
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tickets split automatically across kitchen stations (Grill, Hot Kitchen). Once cooks
                bump items as ready, diner phones notify &quot;Plated & Ready&quot;.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: OPERATOR BENEFITS & ADVANTAGES (Why MezFlow Wins)
         ========================================================================= */}
      <section id="benefits" className="py-20 md:py-28 bg-surface-dark/95 border-t border-surface-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black text-brand-400 uppercase tracking-widest block mb-2">
              Operator Advantages
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              Built for Reliability, Speed, and Simplicity
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Why modern restaurant operators choose MezFlow over rigid, expensive legacy POS terminals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-3xl glass-panel border border-surface-border hover:border-brand-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-base font-extrabold text-white">
                Independent Table & Order Flow
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Orders move through preparation stages while tables manage guest seating separately, eliminating front-of-house logjams and confusing bill handoffs.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-3xl glass-panel border border-surface-border hover:border-blue-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Monitor className="w-5 h-5" />
              </div>
              <h4 className="text-base font-extrabold text-white">
                Zero Hardware Leases
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Runs on standard iPads, Android tablets, monitors, or phones through modern web browsers. Save \$5,000+ upfront on proprietary hardware lock-ins.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-3xl glass-panel border border-surface-border hover:border-amber-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Radio className="w-5 h-5" />
              </div>
              <h4 className="text-base font-extrabold text-white">
                Live Sold-Out Sync in &lt; 2s
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ran out of steaks or burgers? 1-tap in the Manager portal instantly marks the dish sold out across every customer phone without page reloads.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-3xl glass-panel border border-surface-border hover:border-emerald-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-base font-extrabold text-white">
                Guaranteed Price Accuracy
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every dish, modification, and tax calculation is verified automatically on the cloud to prevent menu discrepancies and billing mistakes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: LIVE WALKTHROUGH SANDBOX & ENTERPRISE FOOTER
         ========================================================================= */}
      <section id="live-demo" className="py-20 md:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* High-Impact CTA Box */}
          <div className="rounded-3xl bg-gradient-to-tr from-surface-card via-surface-card to-surface-card/60 border border-brand-500/40 p-8 sm:p-14 shadow-2xl text-center relative overflow-hidden mb-20">
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/20 text-brand-300 text-xs font-black border border-brand-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Experience the Live System Right Now</span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Ready to See MezFlow in Action?
              </h2>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Launch any of the three interconnected portals in your browser. Place a test
                order from the guest menu and watch it pop up on the kitchen screen in real time.
              </p>

              {/* 3 Direct Quick-Launch Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                <Link
                  href="/r/demo-bistro/t/table-4"
                  className="p-5 rounded-2xl glass-panel border border-brand-500/30 hover:border-brand-500 hover:bg-brand-500/10 text-left transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-black uppercase text-brand-400 tracking-wider">
                    Diner View
                  </div>
                  <div className="text-base font-extrabold text-white mt-1">
                    Guest Table 4
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Collaborative menu, modifiers & shared cart.
                  </p>
                </Link>

                <Link
                  href="/kds"
                  className="p-5 rounded-2xl glass-panel border border-blue-500/30 hover:border-blue-500 hover:bg-blue-500/10 text-left transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-black uppercase text-blue-400 tracking-wider">
                    Kitchen View
                  </div>
                  <div className="text-base font-extrabold text-white mt-1">
                    Kitchen KDS Queue
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Paperless station routing & bump bar.
                  </p>
                </Link>

                <Link
                  href="/admin"
                  className="p-5 rounded-2xl glass-panel border border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10 text-left transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-black uppercase text-purple-400 tracking-wider">
                    Manager View
                  </div>
                  <div className="text-base font-extrabold text-white mt-1">
                    Operations Center
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Floor visualizer, menu controls & QR print stands.
                  </p>
                </Link>
              </div>
            </div>
          </div>

          {/* Enterprise SaaS Footer */}
          <footer className="border-t border-surface-border/80 pt-12 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              {/* Brand Column */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-white font-black text-sm">
                    M
                  </div>
                  <span className="font-extrabold text-white text-lg tracking-tight">
                    MezFlow
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Real-time restaurant dining and kitchen operations management platform.
                  Connecting diners, cooks, and managers into one continuous synchronized flow.
                </p>
                <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>All Operational Systems Live & Online</span>
                </div>
              </div>

              {/* Product Links */}
              <div className="space-y-2.5 text-xs">
                <span className="font-bold text-white uppercase tracking-wider block mb-2">
                  Solutions
                </span>
                <Link href="/r/demo-bistro/t/table-4" className="text-slate-400 hover:text-white block">
                  Collaborative Table Ordering
                </Link>
                <Link href="/kds" className="text-slate-400 hover:text-white block">
                  Paperless Kitchen Display (KDS)
                </Link>
                <Link href="/admin" className="text-slate-400 hover:text-white block">
                  Restaurant Operations Command
                </Link>
                <Link href="/admin/tables" className="text-slate-400 hover:text-white block">
                  Custom Table QR Stands
                </Link>
              </div>

              {/* Key Features Column */}
              <div className="space-y-2.5 text-xs">
                <span className="font-bold text-white uppercase tracking-wider block mb-2">
                  Key Features
                </span>
                <span className="text-slate-400 block">Contactless Mobile Ordering</span>
                <span className="text-slate-400 block">Collaborative Group Cart</span>
                <span className="text-slate-400 block">Multi-Station Kitchen Routing</span>
                <span className="text-slate-400 block">Real-Time Menu Availability</span>
                <span className="text-slate-400 block">Live Floor Plan & Occupancy</span>
              </div>

              {/* Security & Access */}
              <div className="space-y-2.5 text-xs">
                <span className="font-bold text-white uppercase tracking-wider block mb-2">
                  Staff Access
                </span>
                <Link href="/login" className="text-brand-400 hover:underline block font-semibold">
                  Manager Sign-In ➔
                </Link>
                <Link href="/login" className="text-blue-400 hover:underline block font-semibold">
                  Kitchen Chef Sign-In ➔
                </Link>
                <span className="text-slate-500 block text-[11px] pt-2">
                  Enterprise-grade security, instant kitchen synchronization, and 99.9% uptime.
                </span>
              </div>
            </div>

            <div className="border-t border-surface-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
              <span>MezFlow Hospitality Platform © 2026. All rights reserved.</span>
              <span>The Complete Restaurant Operations Solution</span>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
