"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { RefreshCw, TrendingUp, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell } from "@/components/ui/data-table";
import { fmt, fmtDate } from "@/lib/utils";

// ── Types ──

interface ForwardRow {
  id: number;
  tradeNum: string;
  docNumber: string;
  tradeDate: string;
  valueDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  usdNet: number;
  goldNetOz: number;
  zarFlow: number;
  daysFromSpot: number;
}

interface CalendarRow {
  valueDate: string;
  daysFromSpot: number;
  tradeCount: number;
  tradeNumbers: number;
  usdNet: number;
  goldNetOz: number;
  zarFlow: number;
}

interface ForwardSummary {
  rows: number;
  tradeNumbers: number;
  usdNet: number;
  goldNetOz: number;
  zarFlow: number;
}

interface ForwardExposureResponse {
  ok: boolean;
  rows: ForwardRow[];
  calendar: CalendarRow[];
  summary: ForwardSummary;
  error?: string;
}

// ── Filters ──

interface Filters {
  symbol: string;
  startDate: string;
  endDate: string;
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

function exposureColorClass(val: number): string {
  if (val > 0.01) return "text-[var(--color-positive)]";
  if (val < -0.01) return "text-[var(--color-negative)]";
  return "text-[var(--color-text-primary)]";
}

// ── Page Component ──

export default function ForwardExposurePage() {
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    symbol: "",
    startDate: "",
    endDate: "",
  });

  // Build query params from filter state
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.symbol && filters.symbol !== "All")
      params.set("symbol", filters.symbol);
    if (filters.startDate) params.set("start_date", filters.startDate);
    if (filters.endDate) params.set("end_date", filters.endDate);
    return params.toString();
  }, [filters]);

  // Fetch forward exposure data
  const { data, isLoading, error, refetch, isFetching } =
    useQuery<ForwardExposureResponse>({
      queryKey: ["forward-exposure", queryParams],
      queryFn: async () => {
        const url = queryParams
          ? `/api/pmx/forward-exposure?${queryParams}`
          : "/api/pmx/forward-exposure";
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Failed to load forward exposure");
        return resp.json();
      },
    });

  const rows = data?.rows ?? [];
  const calendar = data?.calendar ?? [];
  const summary = data?.summary;

  // ── Calendar Columns ──
  const calendarColumns = useMemo<ColumnDef<CalendarRow, any>[]>(
    () => [
      {
        accessorKey: "valueDate",
        header: "Value Date",
        size: 110,
        cell: ({ getValue }) => (
          <span className="font-medium">{fmtDate(getValue() as string)}</span>
        ),
      },
      {
        accessorKey: "daysFromSpot",
        header: "Days Fwd",
        size: 80,
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "tradeCount",
        header: "Trades",
        size: 70,
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "tradeNumbers",
        header: "Trade #s",
        size: 80,
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "usdNet",
        header: "USD Net",
        size: 130,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "goldNetOz",
        header: "Gold Net (oz)",
        size: 130,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number, 4),
      },
      {
        accessorKey: "zarFlow",
        header: "ZAR Flow",
        size: 130,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
    ],
    []
  );

  // ── Detail Columns ──
  const detailColumns = useMemo<ColumnDef<ForwardRow, any>[]>(
    () => [
      {
        accessorKey: "tradeNum",
        header: "Trade #",
        size: 110,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium text-[var(--color-primary)]">
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
        accessorKey: "valueDate",
        header: "Value Date",
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
        accessorKey: "usdNet",
        header: "USD Net",
        size: 130,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "goldNetOz",
        header: "Gold (oz)",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number, 4),
      },
      {
        accessorKey: "zarFlow",
        header: "ZAR Flow",
        size: 130,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "daysFromSpot",
        header: "Days Fwd",
        size: 80,
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
    ],
    []
  );

  return (
    <PageShell
      title="Forward Exposure"
      description="Forward-dated PMX trade exposure grouped by settlement date."
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
          Failed to load forward exposure:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Symbol
          </label>
          <select
            value={filters.symbol}
            onChange={(e) =>
              setFilters((f) => ({ ...f, symbol: e.target.value }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">All Symbols</option>
            <option value="XAUUSD">XAU/USD</option>
            <option value="USDZAR">USD/ZAR</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            From
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            To
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <button
          onClick={() =>
            setFilters({ symbol: "", startDate: "", endDate: "" })
          }
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Summary stat cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Forward Trades"
            value={String(summary.rows)}
            sub={`${summary.tradeNumbers} unique trade number${summary.tradeNumbers !== 1 ? "s" : ""}`}
          />
          <StatCard
            label="Net USD Exposure"
            value={fmt(summary.usdNet)}
            className={exposureColorClass(summary.usdNet)}
          />
          <StatCard
            label="Gold Position"
            value={`${fmt(summary.goldNetOz, 4)} oz`}
            className={exposureColorClass(summary.goldNetOz)}
          />
          <StatCard
            label="ZAR Flow"
            value={fmt(summary.zarFlow)}
            className={exposureColorClass(summary.zarFlow)}
          />
        </div>
      )}

      {/* Calendar View */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--color-text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Settlement Calendar
          </h2>
          {calendar.length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {calendar.length} date{calendar.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <DataTable
          columns={calendarColumns}
          data={calendar}
          loading={isLoading}
          compact
          paginate={false}
          emptyMessage={
            error
              ? "Failed to load calendar data."
              : "No forward-dated settlements found."
          }
          initialSorting={[{ id: "valueDate", desc: false }]}
        />
      </div>

      {/* Detail View (collapsible) */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-[var(--color-text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Trade Detail
          </h2>
          <button
            onClick={() => setShowDetail((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
          >
            {showDetail ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Hide Detail
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show Detail
              </>
            )}
          </button>
          {showDetail && rows.length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {rows.length} row{rows.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {showDetail && (
          <DataTable
            columns={detailColumns}
            data={rows}
            loading={isLoading}
            compact
            paginate
            pageSize={50}
            stickyHeader
            maxHeight="calc(100vh - 480px)"
            emptyMessage="No forward trade detail rows."
            initialSorting={[{ id: "valueDate", desc: false }]}
          />
        )}
      </div>
    </PageShell>
  );
}
