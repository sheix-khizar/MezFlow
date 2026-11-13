"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-xl mb-4">
        !
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-sm text-slate-400 mb-6 max-w-sm">
        An unexpected error occurred while loading this page.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-lg shadow-brand-500/25"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl glass-panel text-slate-300 hover:text-white text-xs font-bold transition-all"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
