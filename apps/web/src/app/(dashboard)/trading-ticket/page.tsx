"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Search, FileText } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell } from "@/components/ui/data-table";
import { fmt, fmtDate } from "@/lib/utils";

// ── Types ──

interface TicketTmRow {
  companyName: string;
  weightG: number;
  weightOz: number;
  usdPerOzBooked: number;
  fxRate: number;
  usdValue: number;
  zarValue: number;
  refiningRate: number;
  zarValueLessRefining: number;
}

interface TicketStonexRow {
  docNumber: string;
  fncNumber: string;
  tradeDate: string;
  valueDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  narration: string;
}

interface TicketSummary {
  goldWaUsdOz: number;
  fxWaUsdzar: number;
  spotZarPerG: number;
  sellSideUsd: number;
  buySideUsd: number;
  sellSideZar: number;
  buySideZar: number;
  totalTradedOz: number;
  totalTradedG: number;
  controlAccountG: number;
  controlAccountOz: number;
  controlAccountZar: number;
  stonexZarFlow: number;
  profitUsd: number;
  profitZar: number;
  profitPct: number;
}

interface TicketResult {
  tradeNum: string;
  tmRows: TicketTmRow[];
  stonexRows: TicketStonexRow[];
  summary: TicketSummary;
}

interface TicketResponse {
  ok: boolean;
  ticket?: TicketResult;
  error?: string;
}

// ── StatCard component ──

function StatCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${className || "text-[var(--color-text-primary)]"}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</p>
      )}
    </div>
  );
}

// ── Page Component ──

export default function TradingTicketPage() {
  const [tradeNum, setTradeNum] = useState("");
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch ticket data
  async function loadTicket() {
    const trimmed = tradeNum.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setTicket(null);

    try {
      const resp = await fetch(`/api/ticket/${encodeURIComponent(trimmed)}`);
      const data: TicketResponse = await resp.json();

      if (!resp.ok || !data.ok) {
        setError(data.error || "Failed to load ticket data");
        return;
      }

      setTicket(data.ticket ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      loadTicket();
    }
  }

  const summary = ticket?.summary;

  // ── TradeMC columns ──
  const tmColumns = useMemo<ColumnDef<TicketTmRow, any>[]>(
    () => [
      {
        accessorKey: "companyName",
        header: "Company",
        size: 200,
      },
      {
        accessorKey: "weightG",
        header: "Weight (g)",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "weightOz",
        header: "Weight (oz)",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "usdPerOzBooked",
        header: "$/oz Booked",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "fxRate",
        header: "FX Rate",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "usdValue",
        header: "USD Value",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "zarValue",
        header: "ZAR Value",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "refiningRate",
        header: "Refining %",
        size: 100,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "zarValueLessRefining",
        header: "ZAR (Net)",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
    ],
    []
  );

  // ── StoneX columns ──
  const stonexColumns = useMemo<ColumnDef<TicketStonexRow, any>[]>(
    () => [
      {
        accessorKey: "docNumber",
        header: "Doc #",
        size: 120,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "fncNumber",
        header: "FNC #",
        size: 120,
      },
      {
        accessorKey: "tradeDate",
        header: "Trade Date",
        size: 110,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "valueDate",
        header: "Value Date",
        size: 110,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 100,
      },
      {
        accessorKey: "side",
        header: "Side",
        size: 80,
        cell: ({ getValue }) => {
          const side = getValue() as string;
          const isBuy = side.toUpperCase() === "BUY";
          return (
            <span className={isBuy ? "num-positive font-medium" : "num-negative font-medium"}>
              {side}
            </span>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "price",
        header: "Price",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "narration",
        header: "Narration",
        size: 220,
      },
    ],
    []
  );

  // ── TradeMC totals row ──
  const tmTotals = useMemo(() => {
    if (!ticket?.tmRows.length) return null;
    const rows = ticket.tmRows;
    const totalWeightG = rows.reduce((s, r) => s + r.weightG, 0);
    const totalWeightOz = rows.reduce((s, r) => s + r.weightOz, 0);
    const totalUsd = rows.reduce((s, r) => s + r.usdValue, 0);
    const totalZarNet = rows.reduce((s, r) => s + r.zarValueLessRefining, 0);
    // Weighted avg $/oz: total USD / total oz
    const waUsdPerOz = totalWeightOz > 0 ? totalUsd / totalWeightOz : 0;
    // Weighted avg FX: total ZAR value / total USD value
    const totalZarGross = rows.reduce((s, r) => s + r.zarValue, 0);
    const waFx = totalUsd > 0 ? totalZarGross / totalUsd : 0;
    return { totalWeightG, totalWeightOz, waUsdPerOz, waFx, totalUsd, totalZarNet };
  }, [ticket?.tmRows]);

  return (
    <PageShell
      title="Trading Ticket"
      description="Generate trading tickets with weighted average pricing."
    >
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="Enter trade number..."
            value={tradeNum}
            onChange={(e) => setTradeNum(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
        <button
          onClick={loadTicket}
          disabled={loading || !tradeNum.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <FileText size={16} />
          )}
          Load Ticket
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Summary stat cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Gold WA"
            value={`$${fmt(summary.goldWaUsdOz, 2)} /oz`}
          />
          <StatCard
            label="FX WA"
            value={`R ${fmt(summary.fxWaUsdzar, 4)}`}
          />
          <StatCard
            label="Spot Rate"
            value={`R ${fmt(summary.spotZarPerG, 2)} /g`}
          />
          <StatCard
            label="Profit"
            value={`R ${fmt(summary.profitZar, 2)}`}
            sub={`(${fmt(summary.profitPct, 1)}%)`}
            className={summary.profitZar >= 0 ? "text-green-600" : "text-red-600"}
          />
        </div>
      )}

      {/* TradeMC Bookings section */}
      {ticket && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            TradeMC Bookings
          </h2>
          <DataTable
            columns={tmColumns}
            data={ticket.tmRows}
            loading={false}
            compact
            paginate={false}
            emptyMessage="No TradeMC bookings found for this trade."
          />
          {/* Totals row */}
          {tmTotals && (
            <div className="overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap" style={{ width: 200 }}>
                      Totals
                    </td>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums" style={{ width: 110 }}>
                      {fmt(tmTotals.totalWeightG, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums" style={{ width: 120 }}>
                      {fmt(tmTotals.totalWeightOz, 4)}
                    </td>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums" style={{ width: 120 }}>
                      {fmt(tmTotals.waUsdPerOz, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums" style={{ width: 110 }}>
                      {fmt(tmTotals.waFx, 4)}
                    </td>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums" style={{ width: 120 }}>
                      {fmt(tmTotals.totalUsd, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right" style={{ width: 120 }}>
                      {/* ZAR Value placeholder — totals row skips this column */}
                    </td>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right" style={{ width: 100 }}>
                      {/* Refining % placeholder */}
                    </td>
                    <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums" style={{ width: 120 }}>
                      {fmt(tmTotals.totalZarNet, 2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* StoneX Trades section */}
      {ticket && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            StoneX / PMX Trades
          </h2>
          <DataTable
            columns={stonexColumns}
            data={ticket.stonexRows}
            loading={false}
            compact
            paginate={false}
            emptyMessage="No StoneX/PMX trades found for this trade."
          />
        </div>
      )}

      {/* Profit Summary section */}
      {summary && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Profit Summary
          </h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* USD column */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                  USD Position
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-[var(--color-background)] px-3 py-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Sell Side (StoneX)</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      ${fmt(summary.sellSideUsd, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[var(--color-background)] px-3 py-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Buy Side (TradeMC)</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      ${fmt(summary.buySideUsd, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">Profit (USD)</span>
                    <span className={`text-sm font-semibold ${summary.profitUsd >= 0 ? "num-positive" : "num-negative"}`}>
                      ${fmt(summary.profitUsd, 2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ZAR column */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                  ZAR Position
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-[var(--color-background)] px-3 py-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Sell Side (StoneX)</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      R {fmt(summary.sellSideZar, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[var(--color-background)] px-3 py-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Buy Side (TradeMC)</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      R {fmt(summary.buySideZar, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">Profit (ZAR)</span>
                    <span className={`text-sm font-semibold ${summary.profitZar >= 0 ? "num-positive" : "num-negative"}`}>
                      R {fmt(summary.profitZar, 2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-[var(--color-border)]" />

            {/* Bottom metrics row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Control Account */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Control Account
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {fmt(summary.controlAccountG, 2)} g
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {fmt(summary.controlAccountOz, 4)} oz
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  R {fmt(summary.controlAccountZar, 2)}
                </p>
              </div>

              {/* Total Traded */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Total Traded
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {fmt(summary.totalTradedG, 2)} g
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {fmt(summary.totalTradedOz, 4)} oz
                </p>
              </div>

              {/* StoneX ZAR Flow */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  StoneX ZAR Flow
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  R {fmt(summary.stonexZarFlow, 2)}
                </p>
              </div>

              {/* Profit % */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Profit Margin
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold ${
                    summary.profitPct >= 0
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {fmt(summary.profitPct, 1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
