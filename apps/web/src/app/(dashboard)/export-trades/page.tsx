"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Database } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { downloadCSV } from "@/lib/export-utils";

// ── Types ──

interface LedgerRow {
  id: number;
  tradeNumber: string;
  docNumber: string;
  tradeDate: string;
  valueDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  narration: string;
  debitUsd: number;
  creditUsd: number;
  balanceUsd: number;
  debitZar: number;
  creditZar: number;
  balanceZar: number;
  netXauOz: number;
  netXauGrams: number;
  netXagOz: number;
  netXagGrams: number;
  netXptOz: number;
  netXptGrams: number;
  netXpdOz: number;
  netXpdGrams: number;
  traderName: string;
  status: "Open" | "Closed";
}

interface TradeMCTradeRow {
  id: number;
  directus_id: number;
  status: string;
  company_id: number;
  weight: string;
  notes: string | null;
  ref_number: string | null;
  trade_timestamp: string;
  zar_per_troy_ounce: string | null;
  zar_to_usd: string | null;
  requested_zar_per_gram: string | null;
  zar_per_troy_ounce_confirmed: string | null;
  zar_to_usd_confirmed: string | null;
  usd_per_troy_ounce_confirmed: string | null;
  evo_exported: boolean;
  synced_at: string | null;
  created_at: string;
  company_name: string;
  company_refining_rate: string | null;
}

// ── PMX Ledger row → flat export object ──

function flattenLedgerRow(row: LedgerRow) {
  return {
    "Trade #": row.tradeNumber,
    "Doc #": row.docNumber,
    "Trade Date": row.tradeDate,
    "Value Date": row.valueDate,
    Symbol: row.symbol,
    Side: row.side,
    Quantity: row.quantity,
    Price: row.price,
    "Debit USD": row.debitUsd,
    "Credit USD": row.creditUsd,
    "Balance USD": row.balanceUsd,
    "Debit ZAR": row.debitZar,
    "Credit ZAR": row.creditZar,
    "Balance ZAR": row.balanceZar,
    "Net Au OZ": row.netXauOz,
    "Net Au G": row.netXauGrams,
    "Net Ag OZ": row.netXagOz,
    "Net Ag G": row.netXagGrams,
    "Net Pt OZ": row.netXptOz,
    "Net Pt G": row.netXptGrams,
    "Net Pd OZ": row.netXpdOz,
    "Net Pd G": row.netXpdGrams,
    Status: row.status,
  };
}

// ── TradeMC row → flat export object ──

function flattenTradeRow(row: TradeMCTradeRow) {
  return {
    "Trade ID": row.directus_id,
    Status: row.status,
    Company: row.company_name,
    "Weight (g)": row.weight,
    "Ref Number": row.ref_number ?? "",
    "Trade Date": row.trade_timestamp
      ? new Date(row.trade_timestamp).toISOString().slice(0, 10)
      : "",
    "ZAR/oz": row.zar_per_troy_ounce_confirmed ?? row.zar_per_troy_ounce ?? "",
    "FX Rate": row.zar_to_usd_confirmed ?? row.zar_to_usd ?? "",
    "USD/oz": row.usd_per_troy_ounce_confirmed ?? "",
    "Requested ZAR/g": row.requested_zar_per_gram ?? "",
  };
}

// ── Page Component ──

export default function ExportTradesPage() {
  // PMX filters
  const [pmxSymbol, setPmxSymbol] = useState("All");
  const [pmxStartDate, setPmxStartDate] = useState("");
  const [pmxEndDate, setPmxEndDate] = useState("");
  const [pmxLoading, setPmxLoading] = useState(false);
  const [pmxRowCount, setPmxRowCount] = useState<number | null>(null);
  const [pmxMessage, setPmxMessage] = useState("");

  // TradeMC filters
  const [tmcStatus, setTmcStatus] = useState("All");
  const [tmcStartDate, setTmcStartDate] = useState("");
  const [tmcEndDate, setTmcEndDate] = useState("");
  const [tmcLoading, setTmcLoading] = useState(false);
  const [tmcRowCount, setTmcRowCount] = useState<number | null>(null);
  const [tmcMessage, setTmcMessage] = useState("");

  // ── PMX export handler ──
  async function handlePmxExport() {
    setPmxLoading(true);
    setPmxMessage("");
    setPmxRowCount(null);
    try {
      const params = new URLSearchParams();
      if (pmxSymbol && pmxSymbol !== "All") params.set("symbol", pmxSymbol);
      if (pmxStartDate) params.set("startDate", pmxStartDate);
      if (pmxEndDate) params.set("endDate", pmxEndDate);

      const resp = await fetch(`/api/pmx/ledger?${params.toString()}`);
      if (!resp.ok) throw new Error("Failed to fetch PMX ledger data");
      const json = await resp.json();
      const rows: LedgerRow[] = json.rows ?? [];

      if (!rows.length) {
        setPmxMessage("No rows found for the selected filters.");
        return;
      }

      const flat = rows.map(flattenLedgerRow);
      const dateSuffix = new Date().toISOString().slice(0, 10);
      downloadCSV(flat, `pmx-ledger-${dateSuffix}.csv`);
      setPmxRowCount(rows.length);
      setPmxMessage(`Exported ${rows.length} rows`);
    } catch (err) {
      setPmxMessage(
        err instanceof Error ? err.message : "Export failed"
      );
    } finally {
      setPmxLoading(false);
    }
  }

  // ── TradeMC export handler ──
  async function handleTmcExport() {
    setTmcLoading(true);
    setTmcMessage("");
    setTmcRowCount(null);
    try {
      const params = new URLSearchParams();
      if (tmcStatus && tmcStatus !== "All") params.set("status", tmcStatus);
      if (tmcStartDate) params.set("startDate", tmcStartDate);
      if (tmcEndDate) params.set("endDate", tmcEndDate);

      const resp = await fetch(`/api/trademc/trades?${params.toString()}`);
      if (!resp.ok) throw new Error("Failed to fetch TradeMC trades");
      const json = await resp.json();
      const rows: TradeMCTradeRow[] = json.trades ?? [];

      if (!rows.length) {
        setTmcMessage("No rows found for the selected filters.");
        return;
      }

      const flat = rows.map(flattenTradeRow);
      const dateSuffix = new Date().toISOString().slice(0, 10);
      downloadCSV(flat, `trademc-trades-${dateSuffix}.csv`);
      setTmcRowCount(rows.length);
      setTmcMessage(`Exported ${rows.length} rows`);
    } catch (err) {
      setTmcMessage(
        err instanceof Error ? err.message : "Export failed"
      );
    } finally {
      setTmcLoading(false);
    }
  }

  return (
    <PageShell
      title="Export Trades"
      description="Export PMX ledger and TradeMC trade data to CSV."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Card 1: PMX Ledger Export ── */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-light)]">
              <FileSpreadsheet className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                PMX Ledger
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Export StoneX/PMX trade ledger with running balances
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3 mb-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                Symbol
              </label>
              <select
                value={pmxSymbol}
                onChange={(e) => setPmxSymbol(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                <option value="All">All Symbols</option>
                <option value="XAUUSD">XAU/USD</option>
                <option value="USDZAR">USD/ZAR</option>
                <option value="XAGUSD">XAG/USD</option>
                <option value="XPTUSD">XPT/USD</option>
                <option value="XPDUSD">XPD/USD</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                  Start Date
                </label>
                <input
                  type="date"
                  value={pmxStartDate}
                  onChange={(e) => setPmxStartDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                  End Date
                </label>
                <input
                  type="date"
                  value={pmxEndDate}
                  onChange={(e) => setPmxEndDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={handlePmxExport}
            disabled={pmxLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {pmxLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download CSV
              </>
            )}
          </button>

          {/* Status message */}
          {pmxMessage && (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                pmxMessage.startsWith("Exported")
                  ? "border border-green-200 bg-green-50 text-green-800"
                  : pmxMessage.startsWith("No rows")
                    ? "border border-amber-200 bg-amber-50 text-amber-800"
                    : "border border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {pmxMessage}
            </div>
          )}

          {/* Row count */}
          {pmxRowCount !== null && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {pmxRowCount} rows in last export
            </p>
          )}
        </div>

        {/* ── Card 2: TradeMC Trades Export ── */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-light)]">
              <Database className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                TradeMC Trades
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Export client metal bookings from TradeMC
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3 mb-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                Status
              </label>
              <select
                value={tmcStatus}
                onChange={(e) => setTmcStatus(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                <option value="All">All</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                  Start Date
                </label>
                <input
                  type="date"
                  value={tmcStartDate}
                  onChange={(e) => setTmcStartDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                  End Date
                </label>
                <input
                  type="date"
                  value={tmcEndDate}
                  onChange={(e) => setTmcEndDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={handleTmcExport}
            disabled={tmcLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {tmcLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download CSV
              </>
            )}
          </button>

          {/* Status message */}
          {tmcMessage && (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                tmcMessage.startsWith("Exported")
                  ? "border border-green-200 bg-green-50 text-green-800"
                  : tmcMessage.startsWith("No rows")
                    ? "border border-amber-200 bg-amber-50 text-amber-800"
                    : "border border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {tmcMessage}
            </div>
          )}

          {/* Row count */}
          {tmcRowCount !== null && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {tmcRowCount} rows in last export
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
