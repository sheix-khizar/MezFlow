"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Building2,
  KeyRound,
  Terminal,
  Check,
  X,
} from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuthStore } from "@/lib/authStore";
import apiClient, { warmupBackend } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, language } = useAuthStore();
  const isUrdu = language === "ur";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  interface SavedProfile {
    email: string;
    displayName: string;
    role: string;
    restaurant_id: string;
  }
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);

  // Forgot Password States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "code">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  useEffect(() => {
    warmupBackend();
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("mezflow_saved_profiles");
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setSavedProfiles(list);
        }
      } catch (e) {}
    }
  }, []);

  const handleRoleRedirect = (role: string) => {
    switch (role) {
      case "manager":
        router.push("/admin");
        break;
      case "kitchen_staff":
        router.push("/kds");
        break;
      case "service_staff":
        router.push("/waiter");
        break;
      case "cashier":
        router.push("/cashier");
        break;
      case "customer":
      default:
        router.push("/r/demo-bistro/t/table-4");
        break;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(
        isUrdu
          ? "براہ کرم ای میل اور پاس ورڈ درج کریں۔"
          : "Please enter your email and password."
      );
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.post("/auth/login", {
        username: email.trim(),
        password,
      });

      const data = res.data;
      setAuth(data.access_token, {
        id: data.user_id,
        restaurant_id: data.restaurant_id,
        role: data.role,
        is_active: true,
        is_verified: true,
        profile: {
          id: data.user_id,
          display_name: data.display_name || "Staff Member",
          preferred_language: data.preferred_language || "en",
          push_notifications_enabled: true,
        },
      });

      // Save real profile for fast multi-tenant switching on this device
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("mezflow_saved_profiles");
          let list: SavedProfile[] = raw ? JSON.parse(raw) : [];
          list = list.filter((p) => p.email.toLowerCase() !== email.trim().toLowerCase());
          list.unshift({
            email: email.trim(),
            displayName: data.display_name || email.trim().split("@")[0],
            role: data.role,
            restaurant_id: data.restaurant_id,
          });
          localStorage.setItem("mezflow_saved_profiles", JSON.stringify(list.slice(0, 4)));
        } catch (e) {}
      }

      setSuccessMsg(
        isUrdu
          ? "لاگ ان کامیاب! کنسول پر منتقل ہو رہے ہیں..."
          : "Welcome back! Directing to your workspace..."
      );

      setTimeout(() => {
        handleRoleRedirect(data.role);
      }, 700);
    } catch (err: any) {
      setError(
        err.message ||
          (isUrdu
            ? "غلط ای میل یا پاس ورڈ۔ براہ کرم دوبارہ کوشش کریں۔"
            : "Invalid credentials. Please verify your email and password.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSavedProfile = (profileEmail: string) => {
    setEmail(profileEmail);
    setPassword("");
    setError(null);
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError(isUrdu ? "براہ کرم ای میل درج کریں۔" : "Please enter your business email.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      await apiClient.post("/auth/forgot-password", {
        email: forgotEmail.trim(),
      });
      setForgotStep("code");
      setForgotSuccess(
        isUrdu
          ? "او ٹی پی کوڈ بیک اینڈ ٹرمینل میں پرنٹ کر دیا گیا ہے!"
          : "6-digit OTP code has been generated and printed in your backend terminal!"
      );
    } catch (err: any) {
      setForgotError(err.message || "Failed to send reset code. Please verify the email exists.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCode.trim() || forgotCode.length !== 6) {
      setForgotError(isUrdu ? "براہ کرم 6 ہندسوں کا درست کوڈ درج کریں۔" : "Please enter the valid 6-digit code.");
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError(isUrdu ? "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔" : "Password must be at least 6 characters.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError(isUrdu ? "پاس ورڈ میچ نہیں کر رہے۔" : "Passwords do not match.");
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await apiClient.post("/auth/reset-password", {
        email: forgotEmail.trim(),
        code: forgotCode.trim(),
        new_password: forgotNewPassword,
      });

      const data = res.data;
      setAuth(data.access_token, {
        id: data.user_id,
        restaurant_id: data.restaurant_id,
        role: data.role,
        is_active: true,
        is_verified: true,
        profile: {
          id: data.user_id,
          display_name: data.display_name || "Staff Member",
          preferred_language: data.preferred_language || "en",
          push_notifications_enabled: true,
        },
      });

      setForgotSuccess(
        isUrdu
          ? "پاس ورڈ کامیابی سے تبدیل ہو گیا! لاگ ان ہو رہے ہیں..."
          : "Password reset successful! Logging you in..."
      );

      setTimeout(() => {
        setIsForgotModalOpen(false);
        handleRoleRedirect(data.role);
      }, 900);
    } catch (err: any) {
      setForgotError(err.message || "Failed to reset password. Please verify the code.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full mb-6">
        <Link
          href="/"
          className="text-base font-extrabold text-white tracking-tight flex items-center gap-2.5 hover:opacity-90 transition-opacity"
        >
          <span className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 text-sm font-black">
            M
          </span>
          <span className="text-lg font-black tracking-tight">MezFlow</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/signup"
            className="text-xs font-bold text-white hover:text-white px-3.5 py-1.5 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-border/50 transition-colors shadow-sm"
          >
            {isUrdu ? "نیا ریستورانٹ رجسٹر کریں" : "Register Restaurant"}
          </Link>
        </div>
      </header>

      {/* Main SaaS Sign In Card */}
      <main className="max-w-md mx-auto w-full">
        <div className="bg-surface-card border border-surface-border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-0 w-60 h-60 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

          {/* Heading */}
          <div className="text-center mb-6 relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isUrdu ? "آپریشنز پورٹل" : "Restaurant Operations Portal"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isUrdu ? "خوش آمدید" : "Welcome Back"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              {isUrdu
                ? "اپنے ٹیبلز، کچن کیو اور آرڈرز کے انتظام کے لیے لاگ ان کریں"
                : "Sign in to manage your tables, kitchen queue, and orders."}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Clean SaaS Sign In Form */}
          <form onSubmit={handleLogin} className="space-y-4 relative">
            {/* Business Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {isUrdu ? "ای میل ایڈریس" : "Business Email"}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="manager@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
            </div>

            {/* Password with Eye Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  {isUrdu ? "پاس ورڈ" : "Password"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email.trim());
                    setForgotStep("email");
                    setForgotError(null);
                    setForgotSuccess(null);
                    setForgotCode("");
                    setForgotNewPassword("");
                    setForgotConfirmPassword("");
                    setIsForgotModalOpen(true);
                  }}
                  className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                >
                  {isUrdu ? "پاس ورڈ بھول گئے؟" : "Forgot password?"}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-surface-border bg-surface-dark text-brand-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                />
                <span>{isUrdu ? "مجھے یاد رکھیں" : "Remember this device"}</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-500/25 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {isUrdu ? "توثیق جاری ہے..." : "Authenticating..."}
                  </span>
                </>
              ) : (
                <>
                  <span>{isUrdu ? "سائن ان کریں" : "Sign In to Workspace"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Saved Real Profiles on this device */}
          {savedProfiles.length > 0 && (
            <div className="mt-5 pt-4 border-t border-surface-border">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isUrdu ? "محفوظ شدہ پروفائلز" : "Saved Profiles on Device"}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Real Accounts</span>
                </span>
              </div>
              <div className="space-y-1.5">
                {savedProfiles.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSavedProfile(p.email)}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-surface-dark/70 hover:bg-surface-dark border border-surface-border/60 hover:border-brand-500/40 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 font-black text-xs flex items-center justify-center shrink-0 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                        {p.displayName ? p.displayName[0].toUpperCase() : p.email[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white group-hover:text-brand-300 transition-colors truncate">
                          {p.displayName || p.email}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {p.email} • <span className="capitalize text-slate-300 font-medium">{p.role.replace("_", " ")}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Security Info */}
          <div className="mt-5 pt-3 border-t border-surface-border/60 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>{isUrdu ? "محفوظ تصدیق شدہ سائن ان" : "Secure multi-tenant workspace login"}</span>
          </div>

          {/* Bottom Link to Register */}
          <div className="text-center mt-4">
            <p className="text-xs text-slate-400">
              {isUrdu ? "نیا ریستورانٹ شروع کرنا چاہتے ہیں؟" : "New to MezFlow?"}{" "}
              <Link
                href="/signup"
                className="text-brand-400 hover:text-brand-300 font-bold ml-1 transition-colors"
              >
                {isUrdu ? "یہاں رجسٹر کریں" : "Create a restaurant workspace →"}
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* MODAL: FORGOT & RESET PASSWORD */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface-card border border-surface-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isUrdu ? "پاس ورڈ ری سیٹ کریں" : "Reset Workspace Password"}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {forgotStep === "email"
                      ? isUrdu
                        ? "مرحلہ 1: اپنا رجسٹرڈ ای میل درج کریں"
                        : "Step 1 of 2: Enter registered business email"
                      : isUrdu
                      ? "مرحلہ 2: ٹرمینل کوڈ اور نیا پاس ورڈ درج کریں"
                      : "Step 2 of 2: Enter terminal OTP & new password"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Terminal Notice */}
            <div className="mb-4 p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-start gap-2.5">
              <Terminal className="w-4 h-4 shrink-0 text-brand-400 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold text-white block mb-0.5">Terminal OTP Delivery:</span>
                Your 6-digit verification code will be printed directly in your backend terminal console!
              </div>
            </div>

            {/* Alerts */}
            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* STEP 1: ENTER EMAIL */}
            {forgotStep === "email" ? (
              <form onSubmit={handleRequestResetCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isUrdu ? "اکاؤنٹ ای میل ایڈریس *" : "Account Email Address *"}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="manager@restaurant.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 rounded-xl glass-panel text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-brand-500/25"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    <span>Send Reset Code ➔</span>
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: ENTER OTP & NEW PASSWORD */
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      {isUrdu ? "6 ہندسوں کا کوڈ (ٹرمینل چیک کریں) *" : "6-Digit Code (Check Terminal) *"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotStep("email")}
                      className="text-[10px] text-slate-400 hover:text-white underline"
                    >
                      Change Email
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl px-4 py-2 text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {isUrdu ? "نیا پاس ورڈ (کم از کم 6 حروف) *" : "New Password (min 6 chars) *"}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showForgotNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showForgotNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {isUrdu ? "نئے پاس ورڈ کی تصدیق کریں *" : "Confirm New Password *"}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showForgotNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 rounded-xl glass-panel text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-brand-500/25"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Reset Password & Sign In</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-slate-500 text-[11px] py-4">
        © {new Date().getFullYear()} MezFlow Hospitality Operations Platform • Multi-Tenant Enterprise Real-Time SaaS
      </footer>
    </div>
  );
}
