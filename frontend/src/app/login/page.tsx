"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Mail,
  Phone,
  KeyRound,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChefHat,
  LayoutDashboard,
  UtensilsCrossed,
} from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuthStore } from "@/lib/authStore";
import apiClient, { warmupBackend } from "@/lib/api";

// Demo Restaurant ID from database seed
const DEMO_RESTAURANT_ID = "52dc0556-c8c6-4131-be96-6643f9cc35b0";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, language } = useAuthStore();

  useEffect(() => {
    warmupBackend();
  }, []);

  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRoleRedirect = (role: string) => {
    switch (role) {
      case "manager":
        router.push("/admin");
        break;
      case "kitchen_staff":
        router.push("/kds");
        break;
      case "customer":
      default:
        router.push("/r/demo-bistro/t/table-4");
        break;
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.post("/auth/login", {
        username: email.trim(),
        password: password,
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
          display_name: data.display_name || "User",
          preferred_language: data.preferred_language || "en",
          push_notifications_enabled: true,
        },
      });

      setSuccessMsg("Authentication successful! Redirecting...");
      setTimeout(() => {
        handleRoleRedirect(data.role);
      }, 700);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Please enter a valid phone number.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.post("/auth/request-otp", {
        destination: phone.trim(),
      });
      setOtpSent(true);
      const code = res.data.debug_otp;
      setSuccessMsg(
        code
          ? `OTP generated: ${code} (Auto-filled for testing)`
          : "OTP sent to your number!"
      );
      if (code) {
        setOtpCode(code);
      }
    } catch (err: any) {
      setError(err.message || "Failed to dispatch OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.post("/auth/verify-otp", {
        destination: phone.trim(),
        code: otpCode.trim(),
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
          display_name: data.display_name || "Guest Diner",
          preferred_language: data.preferred_language || "en",
          push_notifications_enabled: true,
        },
      });

      setSuccessMsg("OTP verified! Redirecting to your table...");
      setTimeout(() => {
        handleRoleRedirect(data.role);
      }, 700);
    } catch (err: any) {
      setError(err.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // Quick preset helper for evaluator demo
  const fillPreset = (roleEmail: string, rolePass: string) => {
    setAuthMode("password");
    setEmail(roleEmail);
    setPassword(rolePass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-surface-dark flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Bar */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full mb-6">
        <Link
          href="/"
          className="text-base font-extrabold text-white tracking-tight flex items-center gap-2 hover:opacity-90"
        >
          <span className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm">
            M
          </span>
          <span>MezFlow</span>
        </Link>
        <LanguageToggle />
      </header>

      {/* Main Authentication Card */}
      <main className="max-w-md mx-auto w-full my-auto">
        <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-semibold mb-3 border border-brand-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Staff & Operations Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {language === "ur" ? "سسٹم میں لاگ ان کریں" : "Sign In to MezFlow"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "ur"
                ? "انتظامیہ اور کچن عملے کے لیے محفوظ لاگ ان"
                : "Secure role-based portal for restaurant managers and kitchen staff."}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-dark/60 border border-white/5 mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode("password");
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                authMode === "password"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Staff Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("otp");
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                authMode === "otp"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Phone OTP
            </button>
          </div>

          {/* Error & Success Alerts */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form 1: Password Login */}
          {authMode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@mezflow.com"
                    className="w-full bg-surface-card border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-card border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Form 2: OTP Verification */}
          {authMode === "otp" && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full bg-surface-card border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send 6-Digit OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-medium text-slate-300">
                        Enter Verification Code
                      </label>
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="text-[11px] text-brand-400 hover:underline"
                      >
                        Change Number
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="w-full bg-surface-card border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm tracking-widest text-center font-mono font-bold text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Verify & Proceed</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Quick Role Switcher Bar */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Quick Role Switcher
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillPreset("manager@mezflow.com", "manager123")}
                className="p-2.5 rounded-xl bg-surface-card border border-surface-border hover:border-purple-500/50 text-left transition-all flex items-center gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">Manager</div>
                  <div className="text-[10px] text-slate-400">Admin Console</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fillPreset("kitchen@mezflow.com", "kitchen123")}
                className="p-2.5 rounded-xl bg-surface-card border border-surface-border hover:border-blue-500/50 text-left transition-all flex items-center gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <ChefHat className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">Kitchen Chef</div>
                  <div className="text-[10px] text-slate-400">KDS Display</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 mt-6">
        <span>MezFlow Hospitality Intelligence Platform © 2026 • Enterprise Real-Time Operations</span>
      </footer>
    </div>
  );
}
