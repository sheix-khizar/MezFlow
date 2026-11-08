"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/lib/cartStore";
import { useMenuRealtime, RealtimeMenuEvent } from "@/hooks/useMenuRealtime";
import { useTableSession } from "@/hooks/useTableSession";
import { DishCard } from "@/components/customer/DishCard";
import { ModifierModal } from "@/components/customer/ModifierModal";
import { DinerJoinModal } from "@/components/customer/DinerJoinModal";
import { DinerBadge } from "@/components/customer/DinerBadge";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { SharedCartDrawer } from "@/components/customer/SharedCartDrawer";
import { SubmitOrderModal } from "@/components/customer/SubmitOrderModal";
import {
  PublicMenuResponse,
  MenuItem,
  TableLookup,
  SelectedModifier,
} from "@/types/menu";
import {
  ArrowLeft,
  ShoppingBag,
  Sparkles,
  Wifi,
  WifiOff,
  Languages,
  AlertTriangle,
  Loader2,
  Utensils,
  Search,
  Users,
  Check,
  Bell,
  X,
  Flame,
} from "lucide-react";

export default function CustomerTablePage() {
  const params = useParams();
  const router = useRouter();
  const restaurantSlugOrId = params.restaurantId as string;
  const tableTokenOrId = params.tableId as string;

  const { language, setLanguage } = useAuthStore();
  const isUrdu = language === "ur";

  // Collaborative Cart Zustand Store
  const {
    session,
    currentDiner,
    cart,
    activeDiners,
    isDrawerOpen,
    isSubmitModalOpen,
    isDinerModalOpen,
    isSubmitting,
    notification,
    joinSession,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    submitOrder,
    setIsDrawerOpen,
    setIsSubmitModalOpen,
    setIsDinerModalOpen,
    loadSavedIdentity,
    clearNotification,
  } = useCartStore();

  // Local Page States
  const [tableInfo, setTableInfo] = useState<TableLookup | null>(null);
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Category & Search
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State for dish customization
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load Table Lookup & Menu
  useEffect(() => {
    let isMounted = true;

    async function loadDiningSession() {
      setLoading(true);
      setError(null);
      try {
        // 1. Resolve table QR token
        const tableRes = await apiClient.get<TableLookup>(
          `/tables/lookup/${tableTokenOrId}`
        );
        if (!isMounted) return;
        setTableInfo(tableRes.data);

        // 2. Load public menu for this restaurant
        const menuRes = await apiClient.get<PublicMenuResponse>(
          `/restaurants/${tableRes.data.restaurant_id}/menu?lang=${language}`
        );
        if (!isMounted) return;
        setMenu(menuRes.data);

        if (menuRes.data.categories.length > 0) {
          setActiveCategory(menuRes.data.categories[0].id);
        }

        // 3. Auto-join session if saved identity exists, else open Onboarding modal
        const { savedDisplayName, savedAvatarColor } = loadSavedIdentity();
        if (savedDisplayName) {
          try {
            await joinSession(
              tableTokenOrId,
              savedDisplayName,
              savedAvatarColor || "#F59E0B"
            );
          } catch (joinErr) {
            console.warn("Auto-join session error:", joinErr);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(
          err.message ||
            "Unable to verify table QR code. Please ask the waiter for assistance."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDiningSession();
    return () => {
      isMounted = false;
    };
  }, [tableTokenOrId, language, joinSession, loadSavedIdentity]);

  // Real-time WebSocket hook for Menu 86ing & price changes (< 2s)
  const handleRealtimeMenuEvent = useCallback((evt: RealtimeMenuEvent) => {
    if (evt.event === "ITEM_AVAILABILITY_CHANGED" && evt.item_id) {
      setMenu((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          categories: prev.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((item) =>
              item.id === evt.item_id
                ? { ...item, is_available: evt.is_available ?? item.is_available }
                : item
            ),
          })),
        };
      });
    } else if (evt.event === "MENU_ITEM_UPDATED" && evt.item_id) {
      setMenu((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          categories: prev.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((item) =>
              item.id === evt.item_id
                ? {
                    ...item,
                    name: evt.name ?? item.name,
                    price: evt.price !== undefined ? evt.price : item.price,
                    is_available: evt.is_available ?? item.is_available,
                  }
                : item
            ),
          })),
        };
      });
    }
  }, []);

  const { isConnected: isMenuConnected } = useMenuRealtime(
    tableInfo?.restaurant_id,
    handleRealtimeMenuEvent
  );

  // Real-time Collaborative Session WebSocket hook (< 2s sync)
  const handleOrderSubmitted = useCallback(
    (evt: any) => {
      if (evt.order_id) {
        router.push(
          `/r/${restaurantSlugOrId}/t/${tableTokenOrId}/order/${evt.order_id}`
        );
      }
    },
    [router, restaurantSlugOrId, tableTokenOrId]
  );

  const { isConnected: isSessionConnected } = useTableSession(
    session?.id,
    currentDiner?.id,
    handleOrderSubmitted
  );

  // Scrollspy observer for active category
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const element = categoryRefs.current[catId];
    if (element) {
      const headerOffset = 130;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  // Filtered dishes
  const filteredCategories = useMemo(() => {
    if (!menu) return [];
    if (!searchQuery.trim()) return menu.categories;

    const q = searchQuery.toLowerCase().trim();
    return menu.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.name_ur && i.name_ur.includes(q)) ||
            (i.description && i.description.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [menu, searchQuery]);

  // Open Dish Modal or prompt Join Table
  const handleOpenDish = (dish: MenuItem) => {
    if (!currentDiner) {
      setIsDinerModalOpen(true);
      return;
    }
    setSelectedDish(dish);
    setIsModalOpen(true);
  };

  // Add Item to Shared Cart via server-authoritative endpoint
  const handleAddToCart = async (payload: {
    item: MenuItem;
    selectedModifiers: SelectedModifier[];
    specialInstructions: string;
    quantity: number;
    calculatedTotal: number;
  }) => {
    if (!session || !currentDiner) {
      setIsDinerModalOpen(true);
      return;
    }

    try {
      const modifierOptionIds = payload.selectedModifiers.map(
        (m) => m.option_id
      );

      await addItem(session.id, currentDiner.id, {
        item_id: payload.item.id,
        quantity: payload.quantity,
        selected_modifier_option_ids: modifierOptionIds,
        special_instructions: payload.specialInstructions || undefined,
      });

      setIsModalOpen(false);
    } catch {
      // Toast handles error message
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <h2 className="text-base font-bold text-white mb-1">
          {isUrdu ? "ٹیبل مینو لوڈ ہو رہا ہے..." : "Loading Digital Menu..."}
        </h2>
        <p className="text-xs text-slate-400 max-w-xs">
          {isUrdu
            ? "ہم کچن کے لائیو مینو اور دستیابی کو سنک کر رہے ہیں"
            : "Connecting to live kitchen availability and prices"}
        </p>
      </div>
    );
  }

  // Error State (e.g. Invalid QR Code)
  if (error || !tableInfo) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          {isUrdu ? "کیو آر کوڈ تصدیق ناکام" : "Table Access Failed"}
        </h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          {error ||
            "We could not verify this tabletop QR code. It may have expired or been regenerated by restaurant staff."}
        </p>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2.5 rounded-xl glass-panel text-xs text-slate-300 hover:text-white"
          >
            {isUrdu ? "مرکزی صفحہ" : "Back to Home"}
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl bg-brand-500 text-xs font-bold text-white hover:bg-brand-600"
          >
            {isUrdu ? "دوبارہ کوشش کریں" : "Retry Scan"}
          </button>
        </div>
      </div>
    );
  }

  const tableNameDisplay = tableInfo.table_name || `Table ${tableInfo.table_number}`;
  const totalCartCount = cart?.item_count || 0;

  return (
    <div
      className="min-h-screen bg-surface-dark text-slate-100 pb-28 relative"
      dir={isUrdu ? "rtl" : "ltr"}
    >
      {/* Real-time Collaborative Toast Notification Pill */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div
            onClick={clearNotification}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shadow-xl flex items-center gap-2 cursor-pointer transition-all border ${
              notification.type === "success"
                ? "bg-emerald-600/90 text-white border-emerald-400/40 backdrop-blur-md"
                : notification.type === "warn"
                ? "bg-rose-600/90 text-white border-rose-400/40 backdrop-blur-md"
                : "bg-surface-card/95 text-brand-300 border-surface-border backdrop-blur-md"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Top App Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-surface-border px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-1.5 rounded-lg glass-panel text-slate-400 hover:text-white transition-colors"
            aria-label="Home"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          </Link>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                {tableInfo.restaurant_name}
              </h1>
              {isSessionConnected || isMenuConnected ? (
                <span
                  title="Live kitchen sync active (< 2s)"
                  className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                />
              ) : (
                <span
                  title="Connecting to table live sync..."
                  className="w-2 h-2 rounded-full bg-amber-400"
                />
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-400">
              <span className="bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20">
                {tableNameDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Diner Presence Pill, Language Switch & Cart Icon */}
        <div className="flex items-center gap-2">
          {/* Active Diner Presence / Onboarding Pill (WP3.12) */}
          {currentDiner ? (
            <button
              type="button"
              onClick={() => setIsDinerModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl glass-panel text-xs border border-surface-border flex items-center gap-1.5 hover:border-brand-500/40 transition-colors"
              title="Click to edit your diner name or color"
            >
              <DinerBadge
                name={currentDiner.display_name}
                avatarColor={currentDiner.avatar_color}
                isYou
                size="xs"
                showLabel={true}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsDinerModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center gap-1 hover:bg-brand-500/25 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isUrdu ? "شامل ہوں" : "Join Table"}</span>
            </button>
          )}

          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setLanguage(isUrdu ? "en" : "ur")}
            className="px-2 py-1.5 rounded-xl glass-panel text-xs font-semibold text-slate-300 hover:text-white border border-surface-border flex items-center gap-1"
            aria-label="Toggle Language"
          >
            <Languages className="w-3.5 h-3.5 text-brand-400" />
            <span>{isUrdu ? "EN" : "اردو"}</span>
          </button>

          {/* Cart Icon / Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open Cart Drawer"
            className="relative p-2.5 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-300 hover:bg-brand-500/25 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-brand-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-scale-in">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 pt-3">
        {/* Restaurant Brand & Table Hero Card (me&u / Sunday App Benchmark) */}
        <div className="relative rounded-3xl overflow-hidden mb-4 border border-surface-border shadow-2xl group">
          <div className="h-44 sm:h-52 w-full relative">
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
              alt={tableInfo.restaurant_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.72]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-dark via-surface-dark/50 to-black/30" />

            {/* Top Corner Floating Badges */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{isUrdu ? "کچن لائیو لنک" : "Live Kitchen Link"}</span>
              </span>

              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow-lg">
                ⭐ 4.9 (480+)
              </span>
            </div>

            {/* Bottom Restaurant & Table Info */}
            <div className="absolute bottom-3.5 left-3.5 right-3.5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
                  {tableInfo.restaurant_name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-brand-500 text-white text-[11px] font-black uppercase tracking-wider shadow">
                  {tableNameDisplay}
                </span>
              </div>
              <p className="text-xs text-slate-200 line-clamp-1 drop-shadow font-medium">
                {isUrdu
                  ? "چارکول باربی کیو، تازہ کڑاہی اور خصوصی موک ٹیلز • لائیو ٹیبل شیئرنگ"
                  : "Artisanal Charcoal Grills, Handcrafted Karahis & Signature Mocktails"}
              </p>
            </div>
          </div>
        </div>

        {/* Table Collaborative Presence Bar (WP3.12) */}
        {activeDiners.length > 0 && (
          <div className="flex items-center justify-between text-xs glass-panel px-3.5 py-2.5 rounded-2xl border border-surface-border mb-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5 rtl:space-x-reverse overflow-hidden">
                {activeDiners.slice(0, 5).map((d) => (
                  <div
                    key={d.id}
                    className="w-5 h-5 rounded-full border border-surface-dark flex items-center justify-center text-[9px] font-black text-white"
                    style={{ backgroundColor: d.avatar_color }}
                    title={d.display_name}
                  >
                    {d.display_name.slice(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>

              <span className="text-[11px] text-slate-300 font-medium">
                {isUrdu
                  ? `${activeDiners.length} افراد ٹیبل پر آرڈر شامل کر رہے ہیں`
                  : `${activeDiners.length} diners collaborating at table`}
              </span>
            </div>

            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isUrdu ? "لائیو سنک" : "Live Sync"}</span>
            </span>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute top-3.5 left-3.5 text-slate-400 rtl:right-3.5 rtl:left-auto" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isUrdu
                ? "ڈش تلاش کریں (مثلاً: کباب، کڑاہی، برگر)..."
                : "Search dishes (e.g. kebab, wings, karahi)..."
            }
            className="w-full text-xs pl-10 pr-9 rtl:pr-10 rtl:pl-9 py-3 rounded-2xl glass-panel border border-surface-border focus:border-brand-500 focus:outline-none text-white placeholder-slate-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-3 right-3 rtl:left-3 rtl:right-auto text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sticky Category Pill Bar with Scrollspy (WP2.8) */}
        {menu && menu.categories.length > 0 && (
          <div className="sticky top-[57px] z-30 -mx-4 px-4 py-2.5 bg-surface-dark/95 backdrop-blur-md border-b border-surface-border/60 overflow-x-auto scrollbar-none flex gap-2">
            {menu.categories.map((cat) => {
              const catName = isUrdu && cat.name_ur ? cat.name_ur : cat.name;
              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToCategory(cat.id)}
                  className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-brand-500 text-white shadow-md shadow-brand-500/20 scale-105"
                      : "glass-panel border-surface-border text-slate-400 hover:text-white"
                  }`}
                >
                  {catName}
                </button>
              );
            })}
          </div>
        )}

        {/* Categories & Dishes Section */}
        <div className="space-y-8 mt-5">
          {filteredCategories.map((category) => {
            const catName =
              isUrdu && category.name_ur ? category.name_ur : category.name;
            const catDesc =
              isUrdu && category.description_ur
                ? category.description_ur
                : category.description;

            return (
              <section
                key={category.id}
                ref={(el) => {
                  categoryRefs.current[category.id] = el;
                }}
                className="space-y-3 scroll-mt-36"
              >
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-brand-400" />
                    <span>{catName}</span>
                  </h2>
                  {catDesc && (
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {catDesc}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {category.items.map((item) => (
                    <DishCard
                      key={item.id}
                      item={item}
                      currency={menu?.currency || "PKR"}
                      language={language}
                      onSelect={handleOpenDish}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {filteredCategories.length === 0 && (
            <div className="glass-panel p-8 rounded-2xl text-center border border-dashed border-slate-700 my-8">
              <Search className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white mb-1">
                {isUrdu ? "کوئی ڈش نہیں ملی" : "No Dishes Found"}
              </h3>
              <p className="text-xs text-slate-400">
                {isUrdu
                  ? "براہ کرم کوئی دوسرا لفظ تلاش کریں"
                  : "Try searching with a different term"}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar (WP3.11) */}
      <FloatingCartBar
        cart={cart}
        activeDiners={activeDiners}
        currentDinerId={currentDiner?.id}
        isUrdu={isUrdu}
        onOpenDrawer={() => setIsDrawerOpen(true)}
      />

      {/* Shared Cart Full-Height Drawer (WP3.11) */}
      <SharedCartDrawer
        isOpen={isDrawerOpen}
        cart={cart}
        activeDiners={activeDiners}
        currentDinerId={currentDiner?.id}
        tableName={tableNameDisplay}
        isUrdu={isUrdu}
        onClose={() => setIsDrawerOpen(false)}
        onUpdateQuantity={async (cartItemId, newQty) => {
          if (!session || !currentDiner) return;
          await updateItemQuantity(session.id, cartItemId, currentDiner.id, newQty);
        }}
        onRemoveItem={async (cartItemId) => {
          if (!session || !currentDiner) return;
          await removeItem(session.id, cartItemId, currentDiner.id);
        }}
        onClearCart={async () => {
          if (!session || !currentDiner) return;
          await clearCart(session.id, currentDiner.id);
        }}
        onSubmitOrder={() => {
          setIsDrawerOpen(false);
          setIsSubmitModalOpen(true);
        }}
      />

      {/* Order Submission Confirmation Dialog (WP3.13) */}
      <SubmitOrderModal
        isOpen={isSubmitModalOpen}
        cart={cart}
        tableName={tableNameDisplay}
        isUrdu={isUrdu}
        isSubmitting={isSubmitting}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={async (notes) => {
          if (!session || !currentDiner) return;
          const createdOrder = await submitOrder(
            session.id,
            currentDiner.id,
            notes
          );
          router.push(
            `/r/${restaurantSlugOrId}/t/${tableTokenOrId}/order/${createdOrder.id}`
          );
        }}
      />

      {/* Diner Onboarding Modal (WP3.9) */}
      <DinerJoinModal
        isOpen={isDinerModalOpen}
        tableName={tableNameDisplay}
        restaurantName={tableInfo.restaurant_name}
        isUrdu={isUrdu}
        initialName={currentDiner?.display_name || ""}
        initialColor={currentDiner?.avatar_color}
        onJoin={async (name, color) => {
          await joinSession(tableTokenOrId, name, color);
        }}
      />

      {/* Interactive Dish Customization Bottom Sheet Modal (WP2.10) */}
      <ModifierModal
        item={selectedDish}
        currency={menu?.currency || "PKR"}
        language={language}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
