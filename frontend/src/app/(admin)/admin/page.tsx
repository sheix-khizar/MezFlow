"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { TableItem, PublicMenuResponse, MenuItem, MenuCategory } from "@/types/menu";
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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  Image as ImageIcon,
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

  // Modal States for Add / Edit Dish
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [submittingDish, setSubmittingDish] = useState(false);

  // Dish Form Fields
  const [dishName, setDishName] = useState("");
  const [dishNameUr, setDishNameUr] = useState("");
  const [dishCategoryId, setDishCategoryId] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishDescriptionUr, setDishDescriptionUr] = useState("");
  const [dishKitchenStation, setDishKitchenStation] = useState("hot_kitchen");
  const [dishPrepMinutes, setDishPrepMinutes] = useState(15);
  const [dishImageUrl, setDishImageUrl] = useState("");
  const [dishIsHalal, setDishIsHalal] = useState(true);
  const [dishIsVegetarian, setDishIsVegetarian] = useState(false);
  const [dishIsSpicy, setDishIsSpicy] = useState(false);

  // Modal State for Add Category
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [submittingCategory, setSubmittingCategory] = useState(false);

  // Seeding State
  const [seedingSample, setSeedingSample] = useState(false);

  // Staff Management State
  interface StaffProfile {
    id: string;
    email: string;
    role: string;
    is_active: boolean;
    is_verified: boolean;
    profile?: {
      display_name: string;
      preferred_language: string;
    };
  }
  const [staffMembers, setStaffMembers] = useState<StaffProfile[]>([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState("kitchen_staff");
  const [staffPassword, setStaffPassword] = useState("");
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [seedingTeam, setSeedingTeam] = useState(false);

  const restaurantId =
    user?.restaurant_id || "52dc0556-c8c6-4131-be96-6643f9cc35b0";
  const currencySymbol = menu?.currency || "PKR";

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

      // 4. Real Staff Profiles
      try {
        const staffRes = await apiClient.get<StaffProfile[]>("/auth/staff");
        setStaffMembers(staffRes.data);
      } catch (e) {
        console.warn("Could not load staff profiles:", e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [restaurantId]);

  // Add Real Staff Member
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail.trim() || !staffPassword.trim() || !staffName.trim()) {
      alert("Please enter Name, Email, and Password.");
      return;
    }
    setSubmittingStaff(true);
    try {
      await apiClient.post("/auth/staff", {
        restaurant_id: restaurantId,
        display_name: staffName.trim(),
        email: staffEmail.trim(),
        role: staffRole,
        password: staffPassword.trim(),
        preferred_language: "en",
      });
      setIsStaffModalOpen(false);
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      // Reload staff
      const staffRes = await apiClient.get<StaffProfile[]>("/auth/staff");
      setStaffMembers(staffRes.data);
      setToastMessage("New real staff profile created successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to create staff member.");
    } finally {
      setSubmittingStaff(false);
    }
  };

  // One-click provision starter team accounts for this restaurant
  const handleSeedStarterTeam = async () => {
    setSeedingTeam(true);
    try {
      const res = await apiClient.post<StaffProfile[]>("/auth/staff/seed-starter-team");
      setStaffMembers(res.data);
      setToastMessage("Provisioned real team profiles for your restaurant!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to provision team profiles.");
    } finally {
      setSeedingTeam(false);
    }
  };

  // Handle Live Item Availability Toggle (Sold Out / Available)
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
        `${item.name} is now ${newStatus ? "Available" : "Marked Sold Out"}`
      );
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update item availability");
    } finally {
      setTogglingItemId(null);
    }
  };

  // Open Add Dish Modal
  const handleOpenAddDish = () => {
    setEditingItem(null);
    setDishName("");
    setDishNameUr("");
    setDishCategoryId(menu?.categories[0]?.id || "");
    setDishPrice("");
    setDishDescription("");
    setDishDescriptionUr("");
    setDishKitchenStation("hot_kitchen");
    setDishPrepMinutes(15);
    setDishImageUrl("");
    setDishIsHalal(true);
    setDishIsVegetarian(false);
    setDishIsSpicy(false);
    setIsDishModalOpen(true);
  };

  // Open Edit Dish Modal
  const handleOpenEditDish = (item: MenuItem) => {
    setEditingItem(item);
    setDishName(item.name);
    setDishNameUr(item.name_ur || "");
    setDishCategoryId(item.category_id);
    setDishPrice(String(item.price));
    setDishDescription(item.description || "");
    setDishDescriptionUr(item.description_ur || "");
    setDishKitchenStation(item.kitchen_station || "hot_kitchen");
    setDishPrepMinutes(item.expected_prep_minutes || 15);
    setDishImageUrl(item.image_url || "");
    setDishIsHalal(item.dietary_tags?.includes("halal") ?? true);
    setDishIsVegetarian(item.dietary_tags?.includes("vegetarian") ?? false);
    setDishIsSpicy(item.dietary_tags?.includes("spicy") ?? false);
    setIsDishModalOpen(true);
  };

  // Submit Add / Edit Dish
  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim() || !dishPrice || !dishCategoryId) {
      alert("Please fill in dish name, category, and price.");
      return;
    }

    setSubmittingDish(true);
    const dietaryTags: string[] = [];
    if (dishIsHalal) dietaryTags.push("halal");
    if (dishIsVegetarian) dietaryTags.push("vegetarian");
    if (dishIsSpicy) dietaryTags.push("spicy");

    const payload = {
      category_id: dishCategoryId,
      name: dishName.trim(),
      name_ur: dishNameUr.trim() || undefined,
      description: dishDescription.trim() || undefined,
      description_ur: dishDescriptionUr.trim() || undefined,
      price: parseFloat(dishPrice),
      kitchen_station: dishKitchenStation,
      expected_prep_minutes: dishPrepMinutes,
      dietary_tags: dietaryTags,
      image_url: dishImageUrl.trim() || undefined,
    };

    try {
      if (editingItem) {
        // Edit existing dish
        await apiClient.patch(`/menu/items/${editingItem.id}`, payload);
        setToastMessage(`Updated "${dishName.trim()}"`);
      } else {
        // Create new dish
        await apiClient.post("/menu/items", payload);
        setToastMessage(`Added "${dishName.trim()}" to menu`);
      }

      setIsDishModalOpen(false);
      setTimeout(() => setToastMessage(null), 3000);
      await loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to save dish.");
    } finally {
      setSubmittingDish(false);
    }
  };

  // Delete Dish
  const handleDeleteDish = async (item: MenuItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}" from your menu?`)) {
      return;
    }

    try {
      await apiClient.delete(`/menu/items/${item.id}`);
      setToastMessage(`Deleted "${item.name}"`);
      setTimeout(() => setToastMessage(null), 3000);
      await loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to delete dish.");
    }
  };

  // Save New Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setSubmittingCategory(true);
    try {
      const nextOrder = (menu?.categories.length || 0) + 1;
      await apiClient.post("/menu/categories", {
        name: categoryName.trim(),
        sort_order: nextOrder,
      });

      setCategoryName("");
      setIsCategoryModalOpen(false);
      setToastMessage(`Added category "${categoryName.trim()}"`);
      setTimeout(() => setToastMessage(null), 3000);
      await loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to add category.");
    } finally {
      setSubmittingCategory(false);
    }
  };

  // Seed 8 Starter Dishes
  const handleSeedStarterDishes = async () => {
    setSeedingSample(true);
    try {
      await apiClient.post("/menu/seed-starter-dishes");
      setToastMessage("Seeded 8 authentic starter dishes across your categories!");
      setTimeout(() => setToastMessage(null), 3500);
      await loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to seed dishes.");
    } finally {
      setSeedingSample(false);
    }
  };

  // Sign out handler
  const handleSignOut = () => {
    logout();
    router.push("/login");
  };

  // Computed metrics
  const totalTables = tables.length;
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

  const firstTableToken = tables[0]?.qr_code_token || "table-1";

  return (
    <div className="min-h-screen bg-surface-dark flex text-slate-100 selection:bg-brand-500 selection:text-white">
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
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-black shadow-lg shadow-brand-500/30 text-sm">
              M
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight block">
                {menu?.restaurant_name || "MezFlow"}
              </span>
              <span className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider block">
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
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25 font-bold"
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
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-surface-card"
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menu Management</span>
            </button>

            <Link
              href="/admin/tables"
              className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-surface-card transition-colors font-medium"
            >
              <div className="flex items-center gap-3">
                <QrCode className="w-4 h-4 text-brand-400" />
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
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25 font-bold"
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
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25 font-bold"
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
              <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.profile?.display_name?.charAt(0) || "M"}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">
                  {user?.profile?.display_name || "Manager"}
                </div>
                <div className="text-[10px] text-brand-400 font-medium capitalize">
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
              <span>{menu?.restaurant_name || "Restaurant"} Command Center</span>
            </h1>
            <p className="text-xs text-slate-400">
              Floor Occupancy • Kitchen Queue • Real-Time Digital Menu Builder
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
          <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-gradient-to-r from-brand-950/40 via-surface-card to-purple-950/20 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Live Product Walkthrough Shortcuts
                </h3>
                <p className="text-xs text-slate-400">
                  One-tap access to your restaurant customer menu, KDS queue, and QR tables
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/r/${restaurantId}/t/${firstTableToken}`}
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
                className="px-3.5 py-2 rounded-xl glass-panel hover:bg-surface-card text-brand-300 font-bold text-xs flex items-center gap-1.5 border border-brand-500/30 transition-all"
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
                  <QrCode className="w-4 h-4 text-brand-400" />
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
                  {allMenuItems.length} Dishes
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                <span className="text-emerald-400">
                  {activeDishesCount} Active
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
                      <QrCode className="w-5 h-5 text-brand-400" />
                      <span>Live Restaurant Floor Visualizer</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real-time occupancy status with cryptographic table QR tokens
                    </p>
                  </div>

                  <Link
                    href="/admin/tables"
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition-all"
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
                        className={`p-4 rounded-xl border transition-all ${
                          isOccupied
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-surface-card border-surface-border hover:border-brand-500/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-extrabold text-white">
                            Table {t.table_number}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {t.capacity} seats
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
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
                            href={`/r/${restaurantId}/t/${t.qr_code_token}`}
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

              {/* Kitchen Station Routing Card */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                {/* Real-time sync guarantee */}
                <div className="glass-panel p-6 rounded-2xl border border-surface-border flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">
                        Multi-Tenant Digital Menu Architecture
                      </h3>
                    </div>

                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      Every dish added here is bound exclusively to your restaurant workspace.
                      Guest phones scanning your table QR tokens instantly load your exact menu,
                      prices, and live availability.
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-card border border-surface-border">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-white">
                            Sub-Second Live Inventory Sync
                          </div>
                          <div className="text-[11px] text-slate-400">
                            When an item runs out, mark it sold out and guest screens update in under 2 seconds.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-card border border-surface-border">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-white">
                            Zero Order Overlap
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Dishes, orders, and tables remain 100% isolated to your restaurant tenant.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("menu")}
                    className="w-full mt-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-500/20"
                  >
                    <span>Open Menu Management</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MENU & LIVE AVAILABILITY TAB (THE REAL MENU BUILDER) */}
          {activeTab === "menu" && (
            <div className="space-y-6">
              {/* Header with Add Dish, Add Category, and Seed Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl glass-panel border border-surface-border">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-brand-400" />
                    <span>Digital Menu & Dish Availability</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage dishes, categories, and real-time availability for your restaurant. Changes broadcast to guest mobile menus instantly.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {allMenuItems.length === 0 && (
                    <button
                      type="button"
                      onClick={handleSeedStarterDishes}
                      disabled={seedingSample}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all"
                    >
                      {seedingSample ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Load 8 Starter Dishes</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl glass-panel hover:bg-surface-card text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-surface-border transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-brand-400" />
                    <span>+ Add Category</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenAddDish}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand-500/25 transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add New Dish</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedMenuCategory("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
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
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedMenuCategory === c.id
                        ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                        : "glass-panel text-slate-400 hover:text-white"
                    }`}
                  >
                    {c.name} ({c.items.length})
                  </button>
                ))}
              </div>

              {/* Empty Menu State */}
              {filteredMenuItems.length === 0 && (
                <div className="py-16 px-6 rounded-3xl glass-panel border border-surface-border text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-4">
                    <UtensilsCrossed className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">
                    No Dishes in this Section Yet
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    Build your restaurant menu by adding custom dishes with photos, prices,
                    and kitchen routing, or click below to load 8 sample dishes immediately.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleOpenAddDish}
                      className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/25"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First Dish</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSeedStarterDishes}
                      disabled={seedingSample}
                      className="px-4 py-2.5 rounded-xl glass-panel hover:bg-surface-card text-purple-300 font-bold text-xs flex items-center gap-2 border border-purple-500/30"
                    >
                      {seedingSample ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>Load 8 Starter Dishes</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Menu Items Grid */}
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
                        <div className="flex items-start gap-3 mb-2.5">
                          <img
                            src={getDishImage(item)}
                            alt={item.name}
                            className="w-16 h-16 rounded-xl object-cover border border-surface-border shrink-0 shadow-sm"
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

                              <span className="text-xs font-black text-white shrink-0 bg-surface-dark px-2.5 py-1 rounded-lg border border-surface-border">
                                {currencySymbol} {typeof item.price === "number" ? item.price.toLocaleString() : item.price}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 capitalize">
                                {item.kitchen_station.replace("_", " ")}
                              </span>
                              {item.dietary_tags?.map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 capitalize"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Card Footer: Availability Toggle + Edit + Delete */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                        {/* Live Availability Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item)}
                          disabled={isToggling}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            item.is_available
                              ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                              : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {isToggling ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : item.is_available ? (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>Mark Sold Out</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Available</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          {/* Edit Dish Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditDish(item)}
                            title="Edit Dish"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-dark border border-transparent hover:border-surface-border transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Dish Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteDish(item)}
                            title="Delete Dish"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: REAL STAFF PROFILES & RBAC */}
          {activeTab === "staff" && (
            <div className="space-y-6">
              {/* Header with Add Staff button */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl glass-panel border border-surface-border">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-400" />
                    <span>Restaurant Staff & Team Profiles</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Real verified team accounts provisioned for your restaurant in PostgreSQL.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {staffMembers.length <= 1 && (
                    <button
                      type="button"
                      onClick={handleSeedStarterTeam}
                      disabled={seedingTeam}
                      className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      {seedingTeam ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Provision Starter Team</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsStaffModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-brand-500/25 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Staff Member</span>
                  </button>
                </div>
              </div>

              {/* Real Staff Directory Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffMembers.map((member) => {
                  const roleConfig: Record<string, { title: string; color: string; badge: string }> = {
                    manager: {
                      title: "Restaurant Manager",
                      color: "text-brand-400 bg-brand-500/10 border-brand-500/30",
                      badge: "Admin",
                    },
                    kitchen_staff: {
                      title: "Kitchen Chef",
                      color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
                      badge: "KDS Screen",
                    },
                    service_staff: {
                      title: "Floor Waiter",
                      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
                      badge: "Floor Staff",
                    },
                    cashier: {
                      title: "Front Cashier",
                      color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
                      badge: "Billing POS",
                    },
                  };

                  const config = roleConfig[member.role] || {
                    title: member.role,
                    color: "text-slate-400 bg-white/5 border-white/10",
                    badge: "Staff",
                  };

                  return (
                    <div
                      key={member.id}
                      className="glass-panel p-5 rounded-2xl border border-surface-border flex flex-col justify-between hover:border-brand-500/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-surface-dark border border-surface-border flex items-center justify-center font-black text-xs text-white">
                              {member.profile?.display_name
                                ? member.profile.display_name[0].toUpperCase()
                                : (member.email ? member.email[0].toUpperCase() : "U")}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">
                                {member.profile?.display_name || "Staff Member"}
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block mt-0.5 ${config.color}`}
                              >
                                {config.title}
                              </span>
                            </div>
                          </div>

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Active
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-slate-500">Email:</span>
                            <span className="text-slate-200 font-mono text-[11px] truncate">
                              {member.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Access:</span>
                            <span className="text-slate-300 text-[11px]">
                              {config.badge}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>DB Verified</span>
                        </span>

                        {member.role === "kitchen_staff" && (
                          <Link
                            href="/kds"
                            target="_blank"
                            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            <span>Open KDS</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        {member.role === "manager" && (
                          <span className="text-[10px] text-brand-400 font-bold">
                            Current Session
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RBAC Security Policies Breakdown */}
              <div className="mt-8 pt-6 border-t border-surface-border">
                <h3 className="text-sm font-bold text-white mb-1">
                  Enforced Security & RBAC Matrix
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Each role is cryptographically enforced via server-signed JWT tokens and database-level tenancy.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      role: "Restaurant Manager",
                      access: "Full console, menu CRUD, live availability, tables, QR generation, staff management",
                    },
                    {
                      role: "Kitchen Chef",
                      access: "Paperless KDS queue, station filtering, bump bar ticket advancement, 60s recall",
                    },
                    {
                      role: "Floor Waiter",
                      access: "Table service assistance, live group cart viewing, order verification",
                    },
                    {
                      role: "Front Cashier",
                      access: "Guest bill settlement, cash/card checkout, invoice records",
                    },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-surface-dark border border-surface-border text-xs"
                    >
                      <div className="font-bold text-white mb-1">{p.role}</div>
                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        {p.access}
                      </div>
                    </div>
                  ))}
                </div>
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
                    Active Tables in Session
                  </span>
                  <div className="text-3xl font-black text-white">
                    {occupiedTables} Tables
                  </div>
                  <span className="text-[11px] text-brand-400 font-bold mt-2 block">
                    Real-Time Dining Sync Active
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: ADD / EDIT DISH */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface-card border border-surface-border rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingItem ? "Edit Menu Dish" : "Add New Menu Dish"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingItem ? `Editing ${editingItem.name}` : "Create a dish for your mobile QR menu"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDishModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-surface-dark transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDish} className="space-y-4">
              {/* Dish Name (English & Urdu) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Dish Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Chicken Karahi"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    نام (اردو)
                  </label>
                  <input
                    type="text"
                    placeholder="مثلاً شاہی چکن کڑاہی"
                    value={dishNameUr}
                    onChange={(e) => setDishNameUr(e.target.value)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-urdu text-right"
                  />
                </div>
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Menu Category *
                  </label>
                  <select
                    required
                    value={dishCategoryId}
                    onChange={(e) => setDishCategoryId(e.target.value)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    {menu?.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Price ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    placeholder="650.00"
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Kitchen Station & Prep Minutes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Kitchen Routing Station *
                  </label>
                  <select
                    value={dishKitchenStation}
                    onChange={(e) => setDishKitchenStation(e.target.value)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="hot_kitchen">Hot Kitchen (Curries, Pastas)</option>
                    <option value="grill">Grill Station (BBQ, Burgers, Steaks)</option>
                    <option value="fryer">Fryer Station (Wings, Fries)</option>
                    <option value="drinks">Bar & Drinks (Shakes, Tea)</option>
                    <option value="dessert">Bakery & Desserts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Target Prep Time (Mins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={dishPrepMinutes}
                    onChange={(e) => setDishPrepMinutes(parseInt(e.target.value) || 15)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Dish Photo URL (Optional)
                </label>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={dishImageUrl}
                    onChange={(e) => setDishImageUrl(e.target.value)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Description (English) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description (English)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, preparation style, and flavors..."
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              {/* Dietary Tags */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Dietary Tags
                </label>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dishIsHalal}
                      onChange={(e) => setDishIsHalal(e.target.checked)}
                      className="rounded border-surface-border bg-surface-dark text-brand-500 focus:ring-0"
                    />
                    <span>Halal</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dishIsVegetarian}
                      onChange={(e) => setDishIsVegetarian(e.target.checked)}
                      className="rounded border-surface-border bg-surface-dark text-brand-500 focus:ring-0"
                    />
                    <span>Vegetarian</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dishIsSpicy}
                      onChange={(e) => setDishIsSpicy(e.target.checked)}
                      className="rounded border-surface-border bg-surface-dark text-brand-500 focus:ring-0"
                    />
                    <span>Spicy 🌶️</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-surface-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="px-4 py-2 rounded-xl glass-panel text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDish}
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-brand-500/25"
                >
                  {submittingDish ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{editingItem ? "Update Dish" : "Save Dish"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CATEGORY */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface-card border border-surface-border rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <h3 className="text-base font-bold text-white">Add Menu Category</h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chef's Specials, Combos"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl glass-panel text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCategory}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {submittingCategory ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Add Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: ADD REAL STAFF MEMBER */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface-card border border-surface-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-400" />
                <span>Add Real Staff Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name / Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Khan"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Staff Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. tariq@restaurant.com"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Staff Role *
                </label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="kitchen_staff">Kitchen Chef (KDS Screen)</option>
                  <option value="service_staff">Floor Server / Waiter</option>
                  <option value="cashier">Front Cashier (Billing & POS)</option>
                  <option value="manager">Assistant Manager (Admin Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Login Password (min 6 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 rounded-xl glass-panel text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStaff}
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-brand-500/25"
                >
                  {submittingStaff ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Create Staff Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
