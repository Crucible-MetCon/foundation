"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { RefreshCw, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell } from "@/components/ui/data-table";
import { fmt, fmtDate } from "@/lib/utils";

// ── Types ──

interface ProfitTrade {
  tradeNum: string;
  tradeDate: string;
  monthKey: string;
  monthLabel: string;
  clientWeightG: number;
  exchangeProfitZar: number;
  metalProfitZar: number;
  totalProfitZar: number;
  profitPct: number;
  sellSideZar: number;
  buySideZar: number;
  pmxWaGoldUsdOz: number;
  pmxWaUsdzar: number;
  trademcWaGoldUsdOz: number;
  trademcWaUsdzar: number;
  matchedOz: number;
  unmatchedOz: number;
}

interface ProfitMonth {
  monthKey: string;
  monthLabel: string;
  exchangeProfitZar: number;
  metalProfitZar: number;
  totalProfitZar: number;
  tradeCount: number;
  trades: ProfitTrade[];
}

interface ProfitSummary {
  months: number;
  trades: number;
  exchangeProfitZar: number;
  metalProfitZar: number;
  totalProfitZar: number;
  averageProfitMarginPct: number;
}

interface ProfitResponse {
  ok: boolean;
  months: ProfitMonth[];
  summary: ProfitSummary;
  error?: string;
}

// ── StatCard ──

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
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${className || "text-[var(--color-text-primary)]"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</p>}
    </div>
  );
}

// ── Helpers ──

function profitColorClass(val: number): string {
  if (val > 0) return "text-[var(--color-positive)]";
  if (val < 0) return "text-[var(--color-negative)]";
  return "text-[var(--color-text-primary)]";
}

// ── Page Component ──

export default function ProfitPage() {
  const { data, isLoading, error, refetch, isFetching } =
    useQuery<ProfitResponse>({
      queryKey: ["profit-monthly"],
      queryFn: async () => {
        const resp = await fetch("/api/profit/monthly");
        if (!resp.ok) throw new Error("Failed to load profit report");
        return resp.json();
      },
    });

  const months = data?.months ?? [];
  const summary = data?.summary;

  // Most recent month starts expanded, others collapsed
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    return new Set<string>();
  });

  // Initialize expanded state when data loads: expand the first (most recent) month
  const resolvedExpanded = useMemo(() => {
    if (expandedMonths.size > 0) return expandedMonths;
    if (months.length > 0) {
      return new Set([months[0].monthKey]);
    }
    return new Set<string>();
  }, [expandedMonths, months]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev.size > 0 ? prev : resolvedExpanded);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  // ── Trade Columns ──
  const tradeColumns = useMemo<ColumnDef<ProfitTrade, any>[]>(
    () => [
      {
        accessorKey: "tradeNum",
        header: "Trade #",
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium text-[var(--color-primary)]">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "tradeDate",
        header: "Trade Date",
        size: 100,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "clientWeightG",
        header: "Weight (g)",
        size: 100,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmt(getValue() as number, 2)}</span>
        ),
      },
      {
        accessorKey: "matchedOz",
        header: "Matched (oz)",
        size: 110,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmt(getValue() as number, 4)}</span>
        ),
      },
      {
        accessorKey: "metalProfitZar",
        header: "Metal Profit",
        size: 120,
        cell: ({ getValue }) => numCell(getValue() as number, 2),
      },
      {
        accessorKey: "exchangeProfitZar",
        header: "Exchange Profit",
        size: 130,
        cell: ({ getValue }) => numCell(getValue() as number, 2),
      },
      {
        accessorKey: "totalProfitZar",
        header: "Total Profit",
        size: 120,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span className={`font-semibold ${val > 0 ? "num-positive" : val < 0 ? "num-negative" : "num-neutral"}`}>
              {fmt(val, 2)}
            </span>
          );
        },
      },
      {
        accessorKey: "profitPct",
        header: "Margin %",
        size: 90,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span className={profitColorClass(val)}>
              {fmt(val, 2)}%
            </span>
          );
        },
      },
      {
        accessorKey: "pmxWaGoldUsdOz",
        header: "PMX Gold WA",
        size: 120,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmt(getValue() as number, 2)}</span>
        ),
      },
      {
        accessorKey: "pmxWaUsdzar",
        header: "PMX FX WA",
        size: 110,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmt(getValue() as number, 4)}</span>
        ),
      },
      {
        accessorKey: "trademcWaGoldUsdOz",
        header: "TradeMC Gold WA",
        size: 140,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmt(getValue() as number, 2)}</span>
        ),
      },
      {
        accessorKey: "trademcWaUsdzar",
        header: "TradeMC FX WA",
        size: 120,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmt(getValue() as number, 4)}</span>
        ),
      },
    ],
    []
  );

  return (
    <PageShell
      title="Profit Report"
      description="Monthly profit and loss analysis split by metal and exchange gains."
      actions={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load profit report:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-text-muted)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          Loading profit report...
        </div>
      )}

      {/* Summary stat cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard
            label="Total Profit ZAR"
            value={fmt(summary.totalProfitZar)}
            className={profitColorClass(summary.totalProfitZar)}
            sub={`Across ${summary.months} month${summary.months !== 1 ? "s" : ""}`}
          />
          <StatCard
            label="Metal Profit ZAR"
            value={fmt(summary.metalProfitZar)}
            sub="Gold price differential"
          />
          <StatCard
            label="Exchange Profit ZAR"
            value={fmt(summary.exchangeProfitZar)}
            sub="FX rate differential"
          />
          <StatCard
            label="Total Trades"
            value={String(summary.trades)}
            sub={`${summary.months} month${summary.months !== 1 ? "s" : ""} reported`}
          />
          <StatCard
            label="Avg Margin"
            value={`${fmt(summary.averageProfitMarginPct)}%`}
            sub="Weighted average"
          />
        </div>
      )}

      {/* Monthly accordion sections */}
      {!isLoading && months.length === 0 && !error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <TrendingUp className="mx-auto h-10 w-10 text-[var(--color-text-muted)]" />
          <h3 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
            No profit data available
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Profit data will appear here once trades have been matched.
          </p>
        </div>
      )}

      {months.map((month) => {
        const isExpanded = resolvedExpanded.has(month.monthKey);
        const colorClass = profitColorClass(month.totalProfitZar);

        return (
          <div
            key={month.monthKey}
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            {/* Month Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--color-background)] transition-colors"
              onClick={() => toggleMonth(month.monthKey)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
                )}
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {month.monthLabel}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {month.tradeCount} trade{month.tradeCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-[var(--color-text-muted)]">Metal</p>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {fmt(month.metalProfitZar)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--color-text-muted)]">Exchange</p>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {fmt(month.exchangeProfitZar)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--color-text-muted)]">Total</p>
                  <p className={`text-sm font-semibold ${colorClass}`}>
                    {fmt(month.totalProfitZar)}
                  </p>
                </div>
              </div>
            </div>

            {/* Expanded Trade Table */}
            {isExpanded && (
              <div className="border-t border-[var(--color-border)] p-4">
                <DataTable
                  columns={tradeColumns}
                  data={month.trades}
                  loading={false}
                  compact
                  paginate={false}
                  emptyMessage="No trades for this month."
                  initialSorting={[{ id: "tradeDate", desc: true }]}
                />
              </div>
            )}
          </div>
        );
      })}
    </PageShell>
  );
}
