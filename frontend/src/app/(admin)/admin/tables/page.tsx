"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api";
import { TableItem, TableQRGraphic } from "@/types/menu";
import {
  ArrowLeft,
  QrCode,
  Plus,
  RefreshCw,
  Printer,
  Download,
  X,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function AdminTablesPage() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Table Form Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [newCapacity, setNewCapacity] = useState("4");
  const [submitting, setSubmitting] = useState(false);

  // QR Modal
  const [selectedQR, setSelectedQR] = useState<TableQRGraphic | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Load tables
  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<TableItem[]>("/tables");
      setTables(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to load tables. Ensure you are logged in as Manager.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // Handle Add Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber) return;

    try {
      setSubmitting(true);
      await apiClient.post("/tables", {
        table_number: parseInt(newTableNumber, 10),
        name: newTableName || `Table ${newTableNumber}`,
        capacity: parseInt(newCapacity, 10) || 4,
      });
      setIsAddOpen(false);
      setNewTableNumber("");
      setNewTableName("");
      setNewCapacity("4");
      await fetchTables();
    } catch (err: any) {
      alert(err.message || "Failed to create table");
    } finally {
      setSubmitting(false);
    }
  };

  // View QR Card
  const handleViewQR = async (tableId: string) => {
    try {
      setQrLoading(true);
      const res = await apiClient.get<TableQRGraphic>(`/tables/${tableId}/qr`);
      setSelectedQR(res.data);
    } catch (err: any) {
      alert(err.message || "Failed to load table QR graphic");
    } finally {
      setQrLoading(false);
    }
  };

  // Regenerate Token
  const handleRegenerateQR = async (tableId: string, tableNumber: number) => {
    if (
      !confirm(
        `Are you sure you want to regenerate the QR code for Table ${tableNumber}? Any existing printed physical stands for this table will stop working immediately.`
      )
    ) {
      return;
    }

    try {
      await apiClient.post(`/tables/${tableId}/regenerate-qr`);
      await fetchTables();
      if (selectedQR && selectedQR.table_id === tableId) {
        await handleViewQR(tableId);
      }
      alert(`QR code for Table ${tableNumber} regenerated successfully.`);
    } catch (err: any) {
      alert(err.message || "Failed to regenerate QR code");
    }
  };

  const handleDownloadSVG = () => {
    if (!selectedQR) return;
    const blob = new Blob([selectedQR.svg_data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mezflow-table-${selectedQR.table_number}-qr.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-surface-dark text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 glass-panel border-b border-surface-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl glass-panel text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-purple-400" />
              <span>Tables & Physical QR Codes</span>
            </h1>
            <p className="text-xs text-slate-400">
              Table Management • QR Stand Generation, Floor Setup & Real-Time Status
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-purple-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Table</span>
        </button>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {loading && (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading restaurant tables...
          </div>
        )}

        {error && (
          <div className="glass-panel p-6 rounded-2xl border border-rose-500/30 text-center max-w-md mx-auto mb-8">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Access Restricted</h3>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold inline-block"
            >
              Sign In as Manager
            </Link>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((tbl) => {
              const isAvailable = tbl.status === "available";
              const isOccupied = tbl.status === "occupied";

              return (
                <div
                  key={tbl.id}
                  className="glass-panel p-5 rounded-2xl border border-surface-border hover:border-purple-500/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-black text-white">
                        #{tbl.table_number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isAvailable
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : isOccupied
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}
                      >
                        {tbl.status.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-200 mb-1">
                      {tbl.name || `Table ${tbl.table_number}`}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>{tbl.capacity} Seats</span>
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="font-mono text-[11px] text-slate-500 truncate max-w-[120px]">
                        {tbl.qr_code_token}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-surface-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewQR(tbl.id)}
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>View & Print</span>
                    </button>
                    <button
                      type="button"
                      title="Regenerate QR Code"
                      onClick={() => handleRegenerateQR(tbl.id, tbl.table_number)}
                      className="p-2 rounded-xl glass-panel text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Table Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-card border border-surface-border rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Add New Dining Table</h2>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Table Number *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="500"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="e.g. 11"
                  className="w-full text-xs p-3 rounded-xl bg-surface-dark border border-surface-border text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Table Name / Section (Optional)
                </label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g. Rooftop 2 or Patio Booth"
                  className="w-full text-xs p-3 rounded-xl bg-surface-dark border border-surface-border text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Seating Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl bg-surface-dark border border-surface-border text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl glass-panel text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Save Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Acrylic Stand QR Card Modal (WP2.13) */}
      {selectedQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-surface-card border border-surface-border rounded-3xl p-6 shadow-2xl relative text-center">
            <button
              type="button"
              onClick={() => setSelectedQR(null)}
              className="absolute top-4 right-4 p-2 rounded-full glass-panel text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Acrylic Stand Card Template */}
            <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-lg border-2 border-slate-200 my-4 text-center">
              <div className="text-[11px] font-black uppercase tracking-widest text-purple-700 mb-1">
                MezFlow Smart Dining
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
                Table {selectedQR.table_number}
              </h2>

              {/* QR Image */}
              <div className="p-3 bg-white rounded-xl inline-block border border-slate-200 shadow-inner mb-3">
                <img
                  src={selectedQR.png_data_url}
                  alt={`QR Code for Table ${selectedQR.table_number}`}
                  className="w-44 h-44 mx-auto"
                />
              </div>

              <p className="text-[11px] font-bold text-slate-600 max-w-[200px] mx-auto leading-tight mb-2">
                Scan with phone camera to view digital menu and place orders
              </p>
              <span className="text-[9px] font-mono text-slate-400 block truncate">
                {selectedQR.diner_url}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={handleDownloadSVG}
                className="flex-1 py-2.5 px-3 rounded-xl glass-panel text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save SVG</span>
              </button>
              <button
                type="button"
                onClick={handlePrintCard}
                className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Card</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
