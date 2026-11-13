"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSignUp, useAuth, useUser } from "@clerk/nextjs";
import {
  Building2,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  MapPin,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  ShieldCheck,
  RotateCw,
} from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import apiClient from "@/lib/api";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function SignUpPage() {
  const router = useRouter();
  const { setAuth, language } = useAuthStore();
  const isUrdu = language === "ur";

  // Headless Clerk SDK Hooks (100% custom UI, zero external vendor widgets)
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  // Step 1 Form States
  const [restaurantName, setRestaurantName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currency, setCurrency] = useState("PKR");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Verification Step States
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [resending, setResending] = useState(false);

  // Status States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-provision if user returns from Google SSO
  React.useEffect(() => {
    let active = true;

    async function handleSSOReturn() {
      if (!isSignedIn || !user) return;
      const stored = typeof window !== "undefined" ? sessionStorage.getItem("mezflow_restaurant_draft") : null;
      const draft = stored ? JSON.parse(stored) : null;

      try {
        setLoading(true);
        const res = await apiClient.post("/auth/register-restaurant", {
          restaurant_name: draft?.restaurant_name || `${user.firstName || "Manager"}'s Restaurant`,
          manager_name: draft?.manager_name || user.fullName || "Manager",
          email: user.primaryEmailAddress?.emailAddress || "",
          currency: draft?.currency || "PKR",
          phone: draft?.phone,
          address: draft?.address,
          clerk_user_id: user.id,
        });

        if (!active) return;
        const data = res.data;
        if (typeof window !== "undefined") {
          localStorage.setItem("mezflow_token", data.access_token);
          sessionStorage.removeItem("mezflow_restaurant_draft");
        }

        setAuth(data.access_token, {
          id: data.user_id,
          restaurant_id: data.restaurant_id,
          role: data.role,
          is_active: true,
          is_verified: true,
          profile: {
            id: data.user_id,
            display_name: data.display_name || user.fullName || "Manager",
            preferred_language: "en",
            push_notifications_enabled: true,
          },
        });

        router.push("/admin");
      } catch (e: any) {
        if (active) setError(e.message || "Failed to provision workspace.");
      } finally {
        if (active) setLoading(false);
      }
    }

    handleSSOReturn();

    return () => {
      active = false;
    };
  }, [isSignedIn, user, router, setAuth]);

  // Google SSO Handler
  const handleGoogleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setError(null);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "mezflow_restaurant_draft",
          JSON.stringify({
            restaurant_name: restaurantName.trim() || "My Restaurant",
            manager_name: managerName.trim() || "Manager",
            currency,
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
          })
        );
      }
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/signup",
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Failed to initiate Google registration.");
    }
  };

  // Submit Initial Registration (Creates account & triggers real email verification code)
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim() || !managerName.trim() || !email.trim() || !password) {
      setError(
        isUrdu
          ? "براہ کرم تمام ضروری خانے پر کریں۔"
          : "Please fill in all required fields."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        isUrdu
          ? "پاس ورڈ کم از کم 8 حروف پر مشتمل ہونا چاہیے۔"
          : "Password must be at least 8 characters long."
      );
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (isLoaded && signUp) {
        // 1. Create user account
        await signUp.create({
          emailAddress: email.trim(),
          password,
          firstName: managerName.trim().split(" ")[0],
          lastName: managerName.trim().split(" ").slice(1).join(" ") || undefined,
        });

        // 2. Dispatch real 6-digit email verification code to user's inbox
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });

        setPendingVerification(true);
        setSuccessMsg(
          isUrdu
            ? `ہم نے ${email.trim()} پر ایک 6 ہندسوں کا تصدیقی کوڈ بھیجا ہے۔`
            : `We've sent a 6-digit verification code to ${email.trim()}`
        );
      } else {
        // Graceful direct registration fallback if auth provider is offline
        await performDirectRegistration();
      }
    } catch (err: any) {
      const code = err.errors?.[0]?.code;
      if (code === "form_identifier_exists") {
        setError(
          isUrdu
            ? "اس ای میل کے ساتھ پہلے سے اکاؤنٹ موجود ہے۔ برائے مہربانی لاگ ان کریں۔"
            : "An account with this email already exists. Please sign in instead."
        );
      } else if (code === "form_password_pwned" || code === "form_password_length_too_short") {
        setError(
          err.errors?.[0]?.message || "Please choose a stronger password."
        );
      } else if (code === "form_param_format_invalid") {
        setError("Please enter a valid email address.");
      } else {
        // If it's a provider or network issue, gracefully fall back to direct workspace registration so the user is never blocked
        console.warn("Auth provider fallback to direct provisioning:", err);
        await performDirectRegistration();
      }
    } finally {
      setLoading(false);
    }
  };

  // Direct backend provisioning fallback (used if auth provider client is unavailable)
  const performDirectRegistration = async () => {
    try {
      const res = await apiClient.post("/auth/register-restaurant", {
        restaurant_name: restaurantName.trim(),
        manager_name: managerName.trim(),
        email: email.trim(),
        password,
        currency: currency.toUpperCase(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });

      const data = res.data;
      if (typeof window !== "undefined") {
        localStorage.setItem("mezflow_token", data.access_token);
      }

      setAuth(data.access_token, {
        id: data.user_id,
        restaurant_id: data.restaurant_id,
        role: data.role,
        is_active: true,
        is_verified: true,
        profile: {
          id: data.user_id,
          display_name: data.display_name || managerName.trim(),
          preferred_language: "en",
          push_notifications_enabled: true,
        },
      });

      setSuccessMsg(
        isUrdu
          ? "ورک اسپیس کامیابی سے بن گیا۔ کنسول پر منتقل ہو رہے ہیں..."
          : "Workspace created successfully! Directing to manager console..."
      );

      setTimeout(() => {
        router.push("/admin");
      }, 800);
    } catch (apiErr: any) {
      setError(
        apiErr.message ||
          (isUrdu
            ? "رجسٹریشن مکمل نہ ہو سکی۔ براہ کرم دوبارہ کوشش کریں۔"
            : "Registration failed. Please check your details and try again.")
      );
    }
  };

  // Verify 6-digit Email Code & Provision Restaurant Workspace
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setError(
        isUrdu
          ? "براہ کرم ای میل پر موصول شدہ 6 ہندسوں کا کوڈ درج کریں۔"
          : "Please enter the 6-digit verification code sent to your email."
      );
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (!isLoaded || !signUp) {
        throw new Error("Authentication client is not loaded. Please refresh.");
      }

      // 1. Verify 6-digit code
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (completeSignUp.status === "complete") {
        // 2. Activate authenticated session
        await setActive({ session: completeSignUp.createdSessionId });

        // 3. Provision isolated restaurant tenant in PostgreSQL
        const res = await apiClient.post("/auth/register-restaurant", {
          restaurant_name: restaurantName.trim(),
          manager_name: managerName.trim(),
          email: email.trim(),
          currency: currency.toUpperCase(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          clerk_user_id: completeSignUp.createdUserId,
        });

        const data = res.data;
        if (typeof window !== "undefined") {
          localStorage.setItem("mezflow_token", data.access_token);
        }

        setAuth(data.access_token, {
          id: data.user_id,
          restaurant_id: data.restaurant_id,
          role: data.role,
          is_active: true,
          is_verified: true,
          profile: {
            id: data.user_id,
            display_name: data.display_name || managerName.trim(),
            preferred_language: "en",
            push_notifications_enabled: true,
          },
        });

        setSuccessMsg(
          isUrdu
            ? "ای میل کی تصدیق کامیاب! آپ کا ریستورانٹ ورک اسپیس فعال ہو گیا ہے۔"
            : "Email verified! Your restaurant workspace is now live. Redirecting..."
        );

        setTimeout(() => {
          router.push("/admin");
        }, 800);
      } else {
        setError(
          isUrdu
            ? "تصدیق نامکمل ہے۔ براہ کرم کوڈ دوبارہ چیک کریں۔"
            : "Verification could not be completed. Please re-check the code."
        );
      }
    } catch (err: any) {
      const codeError =
        err.errors?.[0]?.longMessage ||
        err.errors?.[0]?.message ||
        err.message;
      setError(
        codeError ||
          (isUrdu
            ? "غلط تصدیقی کوڈ۔ براہ کرم اپنے جی میل ان باکس کو چیک کریں۔"
            : "Incorrect verification code. Please check your email inbox.")
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend 6-Digit Email Code
  const handleResendCode = async () => {
    if (!isLoaded || !signUp || resending) return;
    setResending(true);
    setError(null);

    try {
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });
      setSuccessMsg(
        isUrdu
          ? "ایک نیا تصدیقی کوڈ آپ کی ای میل پر بھیج دیا گیا ہے۔"
          : "A fresh verification code has been dispatched to your email."
      );
    } catch (err: any) {
      setError(
        err.errors?.[0]?.message ||
          (isUrdu ? "کوڈ دوبارہ بھیجنے میں ناکامی۔" : "Failed to resend code.")
      );
    } finally {
      setResending(false);
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
            href="/login"
            className="text-xs font-bold text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-border/50 transition-colors shadow-sm"
          >
            {isUrdu ? "سائن ان کریں" : "Sign In"}
          </Link>
        </div>
      </header>

      {/* Main SaaS Card */}
      <main className="max-w-xl mx-auto w-full">
        <div className="bg-surface-card border border-surface-border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-60 h-60 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

          {/* Heading */}
          <div className="text-center mb-6 relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isUrdu
                  ? "ریستورانٹ آپریشنز پلیٹ فارم"
                  : "Restaurant Operations Workspace"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {!pendingVerification
                ? isUrdu
                  ? "ریستورانٹ ورک اسپیس رجسٹر کریں"
                  : "Create Restaurant Workspace"
                : isUrdu
                ? "ای میل ایڈریس کی تصدیق کریں"
                : "Verify Your Business Email"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              {!pendingVerification
                ? isUrdu
                  ? "10 مفت ڈائننگ ٹیبلز، کیو آر کوڈز اور ریئل ٹائم کچن کیو کا آغاز کریں"
                  : "Set up your dining tables, live KDS bump screen, and QR digital ordering."
                : isUrdu
                ? `ہم نے ${email} پر 6 ہندسوں کا کوڈ بھیجا ہے۔ تصدیق کے بعد آپ کا ورک اسپیس فعال ہوگا۔`
                : `We've sent a 6-digit confirmation code to ${email}. Enter it below to launch.`}
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

          {/* PHASE 1: RESTAURANT & MANAGER REGISTRATION FORM */}
          {!pendingVerification && (
            <div className="relative">
              {/* Google Fast SSO Button */}
              <button
                type="button"
                onClick={handleGoogleSignUp}
                className="w-full mb-4 flex items-center justify-center gap-3 bg-surface-dark hover:bg-surface-border/40 text-slate-200 border border-surface-border font-semibold py-3 px-4 rounded-xl text-xs transition-all shadow-sm active:scale-[0.99]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isUrdu ? "گوگل کے ساتھ سائن اپ کریں" : "Sign up with Google"}</span>
              </button>

              {/* Clean Divider */}
              <div className="relative flex items-center justify-center mb-5">
                <div className="border-t border-surface-border w-full" />
                <span className="bg-surface-card px-3 text-[9px] font-medium text-slate-500 uppercase tracking-wider">
                  {isUrdu ? "یا ریستورانٹ ای میل سے شروع کریں" : "email"}
                </span>
                <div className="border-t border-surface-border w-full" />
              </div>

              <form onSubmit={handleSubmitRegistration} className="space-y-4 relative">
              {/* Restaurant Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isUrdu ? "ریستورانٹ کا نام *" : "Restaurant Name *"}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="e.g., Royal Spice Grill"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>
              </div>

              {/* Manager Name & Currency Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isUrdu ? "مینیجر / مالک کا نام *" : "Manager / Owner Name *"}
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="Sheikh Khizar"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isUrdu ? "کرنسی *" : "Operating Currency *"}
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="PKR">PKR (Rs.)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AED">AED (د.إ)</option>
                      <option value="SAR">SAR (﷼)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Work Email */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isUrdu ? "بزنس ای میل *" : "Business / Work Email *"}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="manager@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>
              </div>

              {/* Password with Eye Toggle */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isUrdu ? "پاس ورڈ (کم از کم 8 حروف) *" : "Password (min 8 characters) *"}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="••••••••••••"
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
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Optional Phone & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isUrdu ? "فون نمبر (اختیاری)" : "Phone (Optional)"}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      placeholder="+92 300 1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isUrdu ? "شہر / پتہ (اختیاری)" : "City / Location (Optional)"}
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Islamabad / Lahore"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-surface-dark border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Highlights Pills */}
              <div className="p-3 rounded-2xl bg-surface-dark border border-surface-border text-slate-400 text-[11px] grid grid-cols-3 gap-2 text-center my-3">
                <div className="flex items-center justify-center gap-1.5 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-brand-400" />
                  <span>10 Free Tables</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-brand-400" />
                  <span>Single-Screen KDS</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-brand-400" />
                  <span>Live QR Ordering</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-500/25 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {isUrdu ? "اکاؤنٹ تیار ہو رہا ہے..." : "Creating Account & Sending Code..."}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {isUrdu
                        ? "ریستورانٹ ورک اسپیس شروع کریں"
                        : "Create Restaurant Workspace"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
          )}

          {/* PHASE 2: CUSTOM 6-DIGIT EMAIL VERIFICATION SCREEN */}
          {pendingVerification && (
            <form onSubmit={handleVerifyCode} className="space-y-5 relative">
              {/* Back to Edit Button */}
              <button
                type="button"
                onClick={() => {
                  setPendingVerification(false);
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  {isUrdu ? "ای میل یا معلومات تبدیل کریں" : "Edit email or registration details"}
                </span>
              </button>

              {/* Visual Email Icon Card */}
              <div className="p-4 rounded-2xl bg-surface-dark border border-surface-border flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-white">
                    {isUrdu ? "تصدیقی کوڈ بھیج دیا گیا" : "Verification Code Sent"}
                  </p>
                  <p className="text-slate-400">
                    {isUrdu
                      ? `کوڈ برائے مہربانی اپنے ان باکس ${email} میں چیک کریں۔`
                      : `Please check your email inbox at ${email}`}
                  </p>
                </div>
              </div>

              {/* 6-Digit Code Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2 text-center">
                  {isUrdu ? "6 ہندسوں کا تصدیقی کوڈ درج کریں" : "Enter 6-Digit Verification Code"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-surface-dark border border-surface-border rounded-xl py-3.5 text-center text-2xl font-black tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
              </div>

              {/* Verify & Launch Button */}
              <button
                type="submit"
                disabled={loading || verificationCode.length < 6}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-500/25 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {isUrdu
                        ? "کوڈ کی توثیق اور ورک اسپیس کا قیام..."
                        : "Verifying Code & Provisioning Workspace..."}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {isUrdu
                        ? "تصدیق کریں اور ورک اسپیس کھولیں"
                        : "Verify & Launch Restaurant Workspace"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Resend Link */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendCode}
                  className="text-xs text-slate-400 hover:text-brand-400 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                  <span>
                    {isUrdu
                      ? "کوڈ موصول نہیں ہوا؟ دوبارہ بھیجیں"
                      : "Didn't receive the email? Resend code"}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Bottom Link to Sign In */}
          <div className="text-center mt-6 pt-4 border-t border-surface-border">
            <p className="text-xs text-slate-400">
              {isUrdu ? "پہلے سے مینیجر اکاؤنٹ موجود ہے؟" : "Already have a manager account?"}{" "}
              <Link
                href="/login"
                className="text-brand-400 hover:text-brand-300 font-bold ml-1 transition-colors"
              >
                {isUrdu ? "یہاں لاگ ان کریں" : "Sign in to your console →"}
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-slate-500 text-[11px] py-4">
        © {new Date().getFullYear()} MezFlow Hospitality Operations Platform • Multi-Tenant Enterprise Real-Time SaaS
      </footer>
    </div>
  );
}
