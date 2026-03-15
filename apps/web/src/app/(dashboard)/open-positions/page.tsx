"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell } from "@/components/ui/data-table";
import { fmt, fmtDate } from "@/lib/utils";

// ── Types ──

interface PositionSummary {
  tradeNumber: string;
  balanceUsd: number;
  balanceZar: number;
  tradeCount: number;
  lastTradeDate: string;
  symbol: string;
}

interface OpenRow {
  tradeNumber: string;
  docNumber: string;
  tradeDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  debitUsd: number;
  creditUsd: number;
  balanceUsd: number;
  debitZar: number;
  creditZar: number;
  balanceZar: number;
}

interface OpenPositionsSummary {
  openTrades: number;
  totalOpenUsd: number;
  totalOpenZar: number;
}

interface OpenPositionsResponse {
  ok: boolean;
  positions: PositionSummary[];
  openRows: OpenRow[];
  summary: OpenPositionsSummary;
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

// ── Helpers ──

function balanceColorClass(val: number): string {
  if (val > 0.01) return "text-[var(--color-positive)]";
  if (val < -0.01) return "text-[var(--color-negative)]";
  return "text-[var(--color-text-primary)]";
}

// ── Page Component ──

export default function OpenPositionsPage() {
  const [showDetails, setShowDetails] = useState(false);

  const { data, isLoading, error, refetch, isFetching } =
    useQuery<OpenPositionsResponse>({
      queryKey: ["pmx-open-positions"],
      queryFn: async () => {
        const resp = await fetch("/api/pmx/open-positions");
        if (!resp.ok) throw new Error("Failed to load open positions");
        return resp.json();
      },
    });

  const positions = data?.positions ?? [];
  const openRows = data?.openRows ?? [];
  const summary = data?.summary;

  // ── Positions Summary Columns ──
  const positionColumns = useMemo<ColumnDef<PositionSummary, any>[]>(
    () => [
      {
        accessorKey: "tradeNumber",
        header: "Trade #",
        size: 120,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-primary)]">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 100,
      },
      {
        accessorKey: "tradeCount",
        header: "Legs",
        size: 70,
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "lastTradeDate",
        header: "Last Trade",
        size: 110,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "balanceUsd",
        header: "USD Balance",
        size: 130,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "balanceZar",
        header: "ZAR Balance",
        size: 130,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
    ],
    []
  );

  // ── Detailed Open Trades Columns ──
  const detailColumns = useMemo<ColumnDef<OpenRow, any>[]>(
    () => [
      {
        accessorKey: "tradeNumber",
        header: "Trade #",
        size: 110,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-primary)]">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "docNumber",
        header: "Doc #",
        size: 120,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "tradeDate",
        header: "Trade Date",
        size: 100,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 90,
      },
      {
        accessorKey: "side",
        header: "Side",
        size: 70,
        cell: ({ getValue }) => {
          const side = getValue() as string;
          return (
            <span
              className={`text-xs font-medium ${
                side?.toUpperCase() === "BUY"
                  ? "text-[var(--color-positive)]"
                  : side?.toUpperCase() === "SELL"
                    ? "text-[var(--color-negative)]"
                    : "text-[var(--color-text-primary)]"
              }`}
            >
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
        cell: ({ getValue }) => numCell(getValue() as number, 4),
      },
      {
        accessorKey: "price",
        header: "Price",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number, 4),
      },
      {
        accessorKey: "debitUsd",
        header: "Debit $",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "creditUsd",
        header: "Credit $",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "balanceUsd",
        header: "Balance $",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span
              className={`font-semibold ${val > 0.01 ? "num-positive" : val < -0.01 ? "num-negative" : "num-neutral"}`}
            >
              {Math.abs(val) < 0.01 ? "-" : fmt(val)}
            </span>
          );
        },
      },
      {
        accessorKey: "debitZar",
        header: "Debit ZAR",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "creditZar",
        header: "Credit ZAR",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "balanceZar",
        header: "Balance ZAR",
        size: 130,
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span
              className={`font-semibold ${val > 0.01 ? "num-positive" : val < -0.01 ? "num-negative" : "num-neutral"}`}
            >
              {Math.abs(val) < 0.01 ? "-" : fmt(val)}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <PageShell
      title="Open Positions"
      description="PMX trade positions with non-zero running balances."
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
          Failed to load open positions:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* Summary stat cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Open Positions"
            value={String(summary.openTrades)}
            sub={`${positions.length} unique trade${positions.length !== 1 ? "s" : ""}`}
          />
          <StatCard
            label="Total USD Balance"
            value={fmt(summary.totalOpenUsd)}
            className={balanceColorClass(summary.totalOpenUsd)}
          />
          <StatCard
            label="Total ZAR Balance"
            value={fmt(summary.totalOpenZar)}
            className={balanceColorClass(summary.totalOpenZar)}
          />
        </div>
      )}

      {/* Positions Summary Table */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">
          Positions Summary
        </h2>
        <DataTable
          columns={positionColumns}
          data={positions}
          loading={isLoading}
          compact
          paginate={false}
          emptyMessage={
            error
              ? "Failed to load positions."
              : "No open positions found."
          }
          initialSorting={[{ id: "tradeNumber", desc: false }]}
        />
      </div>

      {/* Detailed Open Trades (collapsible) */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Detailed Open Trades
          </h2>
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
          >
            {showDetails ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show Details
              </>
            )}
          </button>
          {showDetails && openRows.length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {openRows.length} row{openRows.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {showDetails && (
          <DataTable
            columns={detailColumns}
            data={openRows}
            loading={isLoading}
            compact
            paginate
            pageSize={50}
            stickyHeader
            maxHeight="calc(100vh - 480px)"
            emptyMessage="No detailed open trade rows."
            initialSorting={[{ id: "tradeDate", desc: true }]}
          />
        )}
      </div>
    </PageShell>
  );
}
