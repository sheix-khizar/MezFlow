import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-black text-xl mb-4">
        404
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
      <p className="text-sm text-slate-400 mb-6 max-w-sm">
        The table or console page you are looking for does not exist or has expired.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-lg shadow-brand-500/25"
      >
        Return Home
      </Link>
    </div>
  );
}
