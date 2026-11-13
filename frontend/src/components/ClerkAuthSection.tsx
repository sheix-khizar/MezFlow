"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { useAuthStore } from "@/lib/authStore";
import apiClient from "@/lib/api";
import { Loader2, Mail, Sparkles, KeyRound, ExternalLink } from "lucide-react";

interface ClerkAuthSectionProps {
  onRoleRedirect: (role: string) => void;
  isUrdu?: boolean;
}

export function ClerkAuthSection({ onRoleRedirect, isUrdu = false }: ClerkAuthSectionProps) {
  const router = useRouter();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { setAuth } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // When Clerk signs in, sync the token and user identity to PostgreSQL
  useEffect(() => {
    let isMounted = true;

    async function syncClerkUser() {
      if (!isSignedIn || !user) return;
      setSyncing(true);
      setSyncError(null);

      try {
        const token = await getToken();
        if (!token) throw new Error("Could not retrieve Clerk session token.");

        // Store token in localStorage for apiClient interceptor
        if (typeof window !== "undefined") {
          localStorage.setItem("mezflow_token", token);
        }

        // Fetch / auto-provision PostgreSQL record via /api/v1/auth/me
        const res = await apiClient.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const me = res.data;
        if (!isMounted) return;

        setAuth(token, {
          id: me.id,
          restaurant_id: me.restaurant_id,
          role: me.role,
          is_active: me.is_active,
          is_verified: me.is_verified,
          profile: {
            id: me.id,
            display_name:
              me.profile?.display_name || user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "User",
            preferred_language: me.profile?.preferred_language || "en",
            push_notifications_enabled: true,
          },
        });

        // Redirect based on role
        onRoleRedirect(me.role);
      } catch (err: any) {
        if (!isMounted) return;
        setSyncError(err.message || "Failed to synchronize Clerk account with database.");
        setSyncing(false);
      }
    }

    syncClerkUser();

    return () => {
      isMounted = false;
    };
  }, [isSignedIn, user, getToken, setAuth, onRoleRedirect]);

  if (syncing) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-3" />
        <h3 className="text-sm font-bold text-white mb-1">
          {isUrdu ? "اکاؤنٹ کی توثیق ہو رہی ہے..." : "Synchronizing Authentication..."}
        </h3>
        <p className="text-xs text-slate-400">
          {isUrdu ? "ڈیٹا بیس کے ساتھ تصدیق جاری ہے" : "Verifying credentials with MezFlow multi-tenant engine"}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {syncError && (
        <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs w-full text-center">
          {syncError}
        </div>
      )}

      <div className="w-full flex justify-center">
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-surface-dark/80 border border-surface-border text-white shadow-xl rounded-2xl backdrop-blur-md",
              headerTitle: "text-white text-base font-bold text-center",
              headerSubtitle: "text-slate-400 text-xs text-center",
              socialButtonsBlockButton:
                "border-surface-border bg-surface-card hover:bg-surface-border/50 text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors",
              socialButtonsBlockButtonText: "text-slate-200 text-xs font-semibold",
              dividerLine: "bg-surface-border",
              dividerText: "text-slate-500 text-[11px] uppercase tracking-wider",
              formFieldLabel: "text-slate-300 text-xs font-medium",
              formFieldInput:
                "bg-surface-dark border-surface-border text-white text-xs rounded-xl py-2.5 focus:border-brand-500",
              formButtonPrimary:
                "bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-brand-500/20 active:scale-[0.99] transition-all",
              footerActionLink: "text-brand-400 hover:text-brand-300 text-xs font-semibold",
              identityPreviewText: "text-slate-300 text-xs",
              identityPreviewEditButtonIcon: "text-brand-400",
            },
          }}
        />
      </div>
    </div>
  );
}

