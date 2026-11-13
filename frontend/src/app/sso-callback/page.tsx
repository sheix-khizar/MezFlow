"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
      <AuthenticateWithRedirectCallback />
    </div>
  );
}

