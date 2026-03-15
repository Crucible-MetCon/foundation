"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  TableProperties,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable } from "@/components/ui/data-table";
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

/** Lightweight ticket summary from /api/trading-summary */
interface TradingSummaryTicket {
  tradeNum: string;
  earliestTradeDate: string;
  buyWeightG: number;
  buyWeightOz: number;
  sellWeightOz: number;
  varianceOz: number;
  goldWaUsdOz: number;
  fxWaUsdzar: number;
  spotZarPerG: number;
  profitUsd: number;
  profitZar: number;
  profitPct: number;
  controlAccountOz: number;
  buySideZar: number;
  sellSideZar: number;
  buySideUsd: number;
  sellSideUsd: number;
  stonexZarFlow: number;
  controlAccountG: number;
  controlAccountZar: number;
}

interface TradingSummaryResponse {
  ok: boolean;
  tickets: TradingSummaryTicket[];
  error?: string;
}

/** Detail response from /api/ticket/[tradeNum] */
interface TicketDetailResponse {
  ok: boolean;
  ticket: {
    tradeNum: string;
    tmRows: TicketTmRow[];
    stonexRows: TicketStonexRow[];
    summary: Record<string, number>;
  };
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

function profitColorClass(val: number): string {
  if (val > 0) return "text-[var(--color-positive)]";
  if (val < 0) return "text-[var(--color-negative)]";
  return "text-[var(--color-text-primary)]";
}

function varianceColorClass(absOz: number): string {
  if (absOz <= 1) return "text-[var(--color-positive)]";
  if (absOz <= 5) return "text-amber-500";
  return "text-[var(--color-negative)]";
}

function marginBadge(pct: number) {
  let bg: string;
  let text: string;
  if (pct >= 2) {
    bg = "bg-green-50 border-green-200";
    text = "text-green-700";
  } else if (pct >= 0) {
    bg = "bg-amber-50 border-amber-200";
    text = "text-amber-700";
  } else {
    bg = "bg-red-50 border-red-200";
    text = "text-red-700";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${bg} ${text}`}
    >
      {fmt(pct, 2)}%
    </span>
  );
}

// ── Sub-table columns ──

const tmColumns: ColumnDef<TicketTmRow, any>[] = [
  {
    accessorKey: "companyName",
    header: "Company",
    size: 160,
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "weightG",
    header: "Weight (g)",
    size: 100,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 2)}</span>
    ),
  },
  {
    accessorKey: "weightOz",
    header: "Weight (oz)",
    size: 100,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 4)}</span>
    ),
  },
  {
    accessorKey: "usdPerOzBooked",
    header: "$/oz",
    size: 100,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 2)}</span>
    ),
  },
  {
    accessorKey: "fxRate",
    header: "FX Rate",
    size: 100,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 4)}</span>
    ),
  },
  {
    accessorKey: "usdValue",
    header: "USD Value",
    size: 120,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 2)}</span>
    ),
  },
  {
    accessorKey: "zarValue",
    header: "ZAR Value",
    size: 120,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 2)}</span>
    ),
  },
  {
    accessorKey: "refiningRate",
    header: "Ref %",
    size: 70,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 2)}%</span>
    ),
  },
  {
    accessorKey: "zarValueLessRefining",
    header: "ZAR Net",
    size: 120,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums font-medium">
        {fmt(getValue() as number, 2)}
      </span>
    ),
  },
  {
    id: "zarMargin",
    header: "ZAR Margin",
    size: 120,
    meta: { align: "right" },
    accessorFn: (row: TicketTmRow) => row.zarValue * (row.refiningRate / 100),
    cell: ({ getValue }) => (
      <span className="tabular-nums font-medium">
        {fmt(getValue() as number, 2)}
      </span>
    ),
  },
];

const pmxColumns: ColumnDef<TicketStonexRow, any>[] = [
  {
    accessorKey: "docNumber",
    header: "Doc #",
    size: 100,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "fncNumber",
    header: "FNC #",
    size: 100,
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
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-medium">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "side",
    header: "Side",
    size: 60,
    cell: ({ getValue }) => {
      const side = getValue() as string;
      return (
        <span
          className={`font-medium ${side === "BUY" ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}
        >
          {side}
        </span>
      );
    },
  },
  {
    accessorKey: "quantity",
    header: "Qty",
    size: 100,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 4)}</span>
    ),
  },
  {
    accessorKey: "price",
    header: "Price",
    size: 110,
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{fmt(getValue() as number, 4)}</span>
    ),
  },
  {
    accessorKey: "narration",
    header: "Narration",
    size: 200,
    cell: ({ getValue }) => (
      <span className="text-xs text-[var(--color-text-secondary)]">
        {getValue() as string}
      </span>
    ),
  },
];

// ── Metal / Currency split helpers ──

const METAL_PREFIXES = ["XAU", "XAG", "XPT", "XPD"];
const isMetalSymbol = (sym: string) =>
  METAL_PREFIXES.some((p) => sym.toUpperCase().startsWith(p));

const metalColumns: ColumnDef<TicketStonexRow, any>[] = [
  pmxColumns[0], // Doc #
  pmxColumns[1], // FNC # (hidden via initialColumnVisibility)
  pmxColumns[2], // Trade Date
  pmxColumns[3], // Value Date
  pmxColumns[4], // Symbol
  pmxColumns[5], // Side
  pmxColumns[6], // Qty
  pmxColumns[7], // Price
  {
    id: "usdValue",
    header: "USD Value",
    size: 130,
    meta: { align: "right" },
    accessorFn: (row: TicketStonexRow) => row.quantity * row.price,
    cell: ({ getValue }) => (
      <span className="tabular-nums font-medium">
        {fmt(getValue() as number, 2)}
      </span>
    ),
  },
  pmxColumns[8], // Narration
];

const currencyColumns: ColumnDef<TicketStonexRow, any>[] = [
  pmxColumns[0], // Doc #
  pmxColumns[1], // FNC # (hidden via initialColumnVisibility)
  pmxColumns[2], // Trade Date
  pmxColumns[3], // Value Date
  pmxColumns[4], // Symbol
  pmxColumns[5], // Side
  pmxColumns[6], // Qty
  pmxColumns[7], // Price
  {
    id: "zarValue",
    header: "ZAR Value",
    size: 130,
    meta: { align: "right" },
    accessorFn: (row: TicketStonexRow) => row.quantity * row.price,
    cell: ({ getValue }) => (
      <span className="tabular-nums font-medium">
        {fmt(getValue() as number, 2)}
      </span>
    ),
  },
  pmxColumns[8], // Narration
];

// ── Page size ──
const PAGE_SIZE = 50;

// ── Month names ──
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Main table column visibility ──

const MAIN_TABLE_COLUMNS = [
  { key: "buyWeightG", label: "Buy (g)", defaultVisible: false, align: "right" as const },
  { key: "buyWeightOz", label: "Buy (oz)", defaultVisible: true, align: "right" as const },
  { key: "sellWeightOz", label: "Sell (oz)", defaultVisible: true, align: "right" as const },
  { key: "varianceOz", label: "Variance", defaultVisible: true, align: "right" as const },
  { key: "goldWaUsdOz", label: "Gold WA", defaultVisible: true, align: "right" as const },
  { key: "fxWaUsdzar", label: "FX WA", defaultVisible: true, align: "right" as const },
  { key: "spotZarPerG", label: "Spot (R/g)", defaultVisible: true, align: "right" as const },
  { key: "profitUsd", label: "USD P&L", defaultVisible: true, align: "right" as const },
  { key: "profitZar", label: "ZAR P&L", defaultVisible: true, align: "right" as const },
  { key: "profitPct", label: "Margin", defaultVisible: true, align: "center" as const },
  { key: "controlAccountOz", label: "Ctrl Acc (oz)", defaultVisible: true, align: "right" as const },
];

const DEFAULT_VISIBILITY: Record<string, boolean> = {};
for (const col of MAIN_TABLE_COLUMNS) {
  DEFAULT_VISIBILITY[col.key] = col.defaultVisible;
}

// ── Page Component ──

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1; // 1-based

export default function TradingSummaryPage() {
  const { data, isLoading, error, refetch, isFetching } =
    useQuery<TradingSummaryResponse>({
      queryKey: ["trading-summary"],
      queryFn: async () => {
        const resp = await fetch("/api/trading-summary");
        if (!resp.ok) throw new Error("Failed to load trading summary");
        return resp.json();
      },
    });

  const tickets = data?.tickets ?? [];

  // Filter state: year/month dropdowns default to current year/month
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>(String(CURRENT_YEAR));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(CURRENT_MONTH));

  // Pagination
  const [page, setPage] = useState(0);

  // Expanded rows
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(
    new Set(),
  );

  const toggleTicket = useCallback((tradeNum: string) => {
    setExpandedTickets((prev) => {
      const next = new Set(prev);
      if (next.has(tradeNum)) {
        next.delete(tradeNum);
      } else {
        next.add(tradeNum);
      }
      return next;
    });
  }, []);

  // Column visibility
  const [mainColumnVisibility, setMainColumnVisibility] = useState<Record<string, boolean>>(
    () => ({ ...DEFAULT_VISIBILITY })
  );
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const columnSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        columnSettingsRef.current &&
        !columnSettingsRef.current.contains(e.target as Node)
      ) {
        setShowColumnSettings(false);
      }
    }
    if (showColumnSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showColumnSettings]);

  const isColVisible = useCallback(
    (key: string) => mainColumnVisibility[key] !== false,
    [mainColumnVisibility]
  );

  const visibleColumnCount = useMemo(() => {
    return 3 + MAIN_TABLE_COLUMNS.filter((c) => mainColumnVisibility[c.key] !== false).length;
  }, [mainColumnVisibility]);

  // Build available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(CURRENT_YEAR);
    for (const t of tickets) {
      if (t.earliestTradeDate && t.earliestTradeDate.length >= 4) {
        const y = parseInt(t.earliestTradeDate.slice(0, 4), 10);
        if (!isNaN(y)) years.add(y);
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [tickets]);

  // Filter tickets
  const filteredTickets = useMemo(() => {
    const filtered = tickets.filter((t) => {
      // Search filter
      if (
        searchQuery &&
        !t.tradeNum.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      // Year/month filter
      if (selectedYear !== "all" && t.earliestTradeDate) {
        const dateYear = t.earliestTradeDate.slice(0, 4);
        if (dateYear !== selectedYear) return false;

        if (selectedMonth !== "all") {
          const dateMonth = t.earliestTradeDate.slice(5, 7);
          if (dateMonth !== selectedMonth.padStart(2, "0")) return false;
        }
      }
      // Tickets without a date: only show when "All" is selected
      if (selectedYear !== "all" && !t.earliestTradeDate) {
        return false;
      }
      return true;
    });
    return filtered;
  }, [tickets, searchQuery, selectedYear, selectedMonth]);

  // Reset page when filters change
  const handleFilterChange = useCallback(
    (setter: (v: string) => void, value: string) => {
      setter(value);
      setPage(0);
    },
    [],
  );

  // Paginated slice
  const totalPages = Math.ceil(filteredTickets.length / PAGE_SIZE);
  const pagedTickets = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredTickets.slice(start, start + PAGE_SIZE);
  }, [filteredTickets, page]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const list = filteredTickets;
    const totalWeightG = list.reduce((s, t) => s + t.buyWeightG, 0);
    const totalProfitZar = list.reduce((s, t) => s + t.profitZar, 0);
    const totalProfitUsd = list.reduce((s, t) => s + t.profitUsd, 0);
    const totalBuySideZar = list.reduce((s, t) => s + t.buySideZar, 0);
    const avgMargin =
      totalBuySideZar > 0.01
        ? (totalProfitZar / totalBuySideZar) * 100
        : 0;
    return {
      ticketCount: list.length,
      totalWeightG,
      totalProfitZar,
      totalProfitUsd,
      avgMargin,
    };
  }, [filteredTickets]);

  return (
    <PageShell
      title="Trading Summary"
      description="Consolidated view of all trading tickets with buy/sell weight matching and profit analysis."
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
          Failed to load trading summary:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-text-muted)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          Loading trading summary...
        </div>
      )}

      {/* Filter bar */}
      {!isLoading && tickets.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search ticket #..."
              value={searchQuery}
              onChange={(e) =>
                handleFilterChange(setSearchQuery, e.target.value)
              }
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleFilterChange(setSelectedYear, e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="all">All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => handleFilterChange(setSelectedMonth, e.target.value)}
              disabled={selectedYear === "all"}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50"
            >
              <option value="all">All Months</option>
              {MONTH_LABELS.map((label, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {(searchQuery || selectedYear !== String(CURRENT_YEAR) || selectedMonth !== String(CURRENT_MONTH)) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedYear(String(CURRENT_YEAR));
                setSelectedMonth(String(CURRENT_MONTH));
                setPage(0);
              }}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              Reset filters
            </button>
          )}
          {/* Column visibility dropdown */}
          <div className="relative ml-auto" ref={columnSettingsRef}>
            <button
              onClick={() => setShowColumnSettings((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Columns
            </button>
            {showColumnSettings && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-lg">
                {MAIN_TABLE_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-background)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={mainColumnVisibility[col.key] !== false}
                      onChange={() =>
                        setMainColumnVisibility((prev) => ({
                          ...prev,
                          [col.key]: !prev[col.key],
                        }))
                      }
                      className="rounded border-[var(--color-border)]"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary stat cards */}
      {!isLoading && tickets.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard
            label="Total Tickets"
            value={String(summaryStats.ticketCount)}
            sub={`${tickets.length} total in system`}
          />
          <StatCard
            label="Total Weight"
            value={`${fmt(summaryStats.totalWeightG, 0)}g`}
            sub="Buy-side grams"
          />
          <StatCard
            label="Total Profit (ZAR)"
            value={`R ${fmt(summaryStats.totalProfitZar)}`}
            className={profitColorClass(summaryStats.totalProfitZar)}
          />
          <StatCard
            label="Total Profit (USD)"
            value={`$ ${fmt(summaryStats.totalProfitUsd)}`}
            className={profitColorClass(summaryStats.totalProfitUsd)}
          />
          <StatCard
            label="Avg Margin"
            value={`${fmt(summaryStats.avgMargin)}%`}
            className={profitColorClass(summaryStats.avgMargin)}
            sub="Weighted average"
          />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && tickets.length === 0 && !error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <TableProperties className="mx-auto h-10 w-10 text-[var(--color-text-muted)]" />
          <h3 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
            No trading data available
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Trading tickets will appear here once trades have been confirmed in
            TradeMC.
          </p>
        </div>
      )}

      {/* Main table */}
      {!isLoading && filteredTickets.length > 0 && (
        <>
          <div className="overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                  <th className="w-10 px-2 py-2" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
                    Ticket #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
                    Date
                  </th>
                  {MAIN_TABLE_COLUMNS.map((col) =>
                    isColVisible(col.key) ? (
                      <th
                        key={col.key}
                        className={`px-3 py-2 text-${col.align} text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap`}
                      >
                        {col.label}
                      </th>
                    ) : null
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedTickets.map((ticket) => {
                  const isExpanded = expandedTickets.has(ticket.tradeNum);
                  const absVariance = Math.abs(ticket.varianceOz);

                  return (
                    <TicketRow
                      key={ticket.tradeNum}
                      ticket={ticket}
                      isExpanded={isExpanded}
                      absVariance={absVariance}
                      onToggle={() => toggleTicket(ticket.tradeNum)}
                      isColVisible={isColVisible}
                      visibleColumnCount={visibleColumnCount}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
              <div>
                Showing {page * PAGE_SIZE + 1} -{" "}
                {Math.min((page + 1) * PAGE_SIZE, filteredTickets.length)} of{" "}
                {filteredTickets.length} tickets
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-background)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 text-sm">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-background)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Filtered empty state */}
      {!isLoading &&
        tickets.length > 0 &&
        filteredTickets.length === 0 && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              No tickets match your filter criteria.
            </p>
          </div>
        )}
    </PageShell>
  );
}

// ── Expanded detail component (fetches on demand) ──

function TicketDetail({ tradeNum }: { tradeNum: string }) {
  const { data, isLoading, error } = useQuery<TicketDetailResponse>({
    queryKey: ["ticket-detail", tradeNum],
    queryFn: async () => {
      const resp = await fetch(`/api/ticket/${encodeURIComponent(tradeNum)}`);
      if (!resp.ok) throw new Error("Failed to load ticket");
      return resp.json();
    },
    staleTime: 5 * 60_000,
  });

  const tmRows = data?.ticket?.tmRows ?? [];
  const stonexRows = data?.ticket?.stonexRows ?? [];

  // ── TradeMC totals ──
  const tmTotals = useMemo(() => {
    if (tmRows.length === 0) return null;
    let totalWeightG = 0;
    let totalWeightOz = 0;
    let totalUsdValue = 0;
    let totalZarValue = 0;
    let sumOzTimesUsd = 0;
    let sumOzTimesFx = 0;
    let sumZarTimesRef = 0;
    let totalZarMargin = 0;

    for (const r of tmRows) {
      totalWeightG += r.weightG;
      totalWeightOz += r.weightOz;
      totalUsdValue += r.usdValue;
      totalZarValue += r.zarValue;
      sumOzTimesUsd += r.weightOz * r.usdPerOzBooked;
      sumOzTimesFx += r.weightOz * r.fxRate;
      sumZarTimesRef += r.zarValue * r.refiningRate;
      totalZarMargin += r.zarValue * (r.refiningRate / 100);
    }

    return {
      totalWeightG,
      totalWeightOz,
      waUsdPerOz: totalWeightOz > 0 ? sumOzTimesUsd / totalWeightOz : 0,
      waFx: totalWeightOz > 0 ? sumOzTimesFx / totalWeightOz : 0,
      totalUsdValue,
      totalZarValue,
      waRefPct: totalZarValue > 0 ? sumZarTimesRef / totalZarValue : 0,
      totalZarMargin,
    };
  }, [tmRows]);

  // ── StoneX split into metal / currency ──
  const metalRows = useMemo(
    () => stonexRows.filter((r) => isMetalSymbol(r.symbol)),
    [stonexRows]
  );
  const currencyRows = useMemo(
    () => stonexRows.filter((r) => !isMetalSymbol(r.symbol)),
    [stonexRows]
  );

  // ── Metal totals (SELL adds, BUY subtracts) ──
  const metalTotals = useMemo(() => {
    if (metalRows.length === 0) return null;
    let totalQty = 0;
    let totalUsdValue = 0;
    for (const r of metalRows) {
      const sign = r.side === "BUY" ? -1 : 1;
      totalQty += sign * r.quantity;
      totalUsdValue += sign * r.quantity * r.price;
    }
    return {
      totalQty,
      waPrice: totalQty !== 0 ? totalUsdValue / totalQty : 0,
      totalUsdValue,
    };
  }, [metalRows]);

  // ── Currency totals (SELL adds, BUY subtracts) ──
  const currencyTotals = useMemo(() => {
    if (currencyRows.length === 0) return null;
    let totalQty = 0;
    let totalZarValue = 0;
    for (const r of currencyRows) {
      const sign = r.side === "BUY" ? -1 : 1;
      totalQty += sign * r.quantity;
      totalZarValue += sign * r.quantity * r.price;
    }
    return {
      totalQty,
      waPrice: totalQty !== 0 ? totalZarValue / totalQty : 0,
      totalZarValue,
    };
  }, [currencyRows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--color-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading ticket details...
      </div>
    );
  }

  if (error || !data?.ok || !data.ticket) {
    return (
      <div className="py-4 text-center text-xs text-[var(--color-negative)]">
        Failed to load ticket details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* TradeMC Bookings */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          TradeMC Bookings
        </h4>
        {tmRows.length > 0 ? (
          <DataTable
            columns={tmColumns}
            data={tmRows}
            loading={false}
            compact
            paginate={false}
            emptyMessage="No TradeMC bookings."
            initialColumnVisibility={{ zarValueLessRefining: false }}
            footer={
              tmTotals ? (
                <tr>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                    Totals
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalWeightG, 2)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalWeightOz, 4)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.waUsdPerOz, 2)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.waFx, 4)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalUsdValue, 2)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalZarValue, 2)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.waRefPct, 2)}%
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalZarMargin, 2)}
                  </td>
                </tr>
              ) : undefined
            }
          />
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] italic">
            No TradeMC bookings for this ticket.
          </p>
        )}
      </div>

      {/* Metal Trades */}
      {metalRows.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Metal Trades
          </h4>
          <DataTable
            columns={metalColumns}
            data={metalRows}
            loading={false}
            compact
            paginate={false}
            emptyMessage="No metal trades."
            initialColumnVisibility={{ fncNumber: false }}
            footer={
              metalTotals ? (
                <tr>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                    Totals
                  </td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(metalTotals.totalQty, 4)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(metalTotals.waPrice, 4)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(metalTotals.totalUsdValue, 2)}
                  </td>
                  <td className="px-2 py-1.5" />
                </tr>
              ) : undefined
            }
          />
        </div>
      )}

      {/* Currency Trades */}
      {currencyRows.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Currency Trades
          </h4>
          <DataTable
            columns={currencyColumns}
            data={currencyRows}
            loading={false}
            compact
            paginate={false}
            emptyMessage="No currency trades."
            initialColumnVisibility={{ fncNumber: false }}
            footer={
              currencyTotals ? (
                <tr>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                    Totals
                  </td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(currencyTotals.totalQty, 4)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(currencyTotals.waPrice, 4)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(currencyTotals.totalZarValue, 2)}
                  </td>
                  <td className="px-2 py-1.5" />
                </tr>
              ) : undefined
            }
          />
        </div>
      )}

      {/* Fallback if no stonex rows at all */}
      {stonexRows.length === 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            StoneX / PMX Trades
          </h4>
          <p className="text-xs text-[var(--color-text-muted)] italic">
            No PMX trades for this ticket.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Ticket Row ──

function TicketRow({
  ticket,
  isExpanded,
  absVariance,
  onToggle,
  isColVisible,
  visibleColumnCount,
}: {
  ticket: TradingSummaryTicket;
  isExpanded: boolean;
  absVariance: number;
  onToggle: () => void;
  isColVisible: (key: string) => boolean;
  visibleColumnCount: number;
}) {
  return (
    <>
      {/* Summary row */}
      <tr
        className="border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-background)] transition-colors"
        onClick={onToggle}
      >
        <td className="px-2 py-2 text-center">
          {isExpanded ? (
            <ChevronDown className="mx-auto h-4 w-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="mx-auto h-4 w-4 text-[var(--color-text-muted)]" />
          )}
        </td>
        <td className="px-3 py-2">
          <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">
            {ticket.tradeNum}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-[var(--color-text-primary)]">
          {fmtDate(ticket.earliestTradeDate)}
        </td>
        {isColVisible("buyWeightG") && (
          <td className="px-3 py-2 text-right tabular-nums text-xs text-[var(--color-text-primary)]">
            {fmt(ticket.buyWeightG, 2)}
          </td>
        )}
        {isColVisible("buyWeightOz") && (
          <td className="px-3 py-2 text-right tabular-nums text-xs text-[var(--color-text-primary)]">
            {fmt(ticket.buyWeightOz, 4)}
          </td>
        )}
        {isColVisible("sellWeightOz") && (
          <td className="px-3 py-2 text-right tabular-nums text-xs text-[var(--color-text-primary)]">
            {fmt(ticket.sellWeightOz, 4)}
          </td>
        )}
        {isColVisible("varianceOz") && (
          <td className="px-3 py-2 text-right">
            <span
              className={`tabular-nums text-xs font-medium ${varianceColorClass(absVariance)}`}
            >
              {fmt(ticket.varianceOz, 4)}
            </span>
          </td>
        )}
        {isColVisible("goldWaUsdOz") && (
          <td className="px-3 py-2 text-right tabular-nums text-xs text-[var(--color-text-primary)]">
            {fmt(ticket.goldWaUsdOz, 2)}
          </td>
        )}
        {isColVisible("fxWaUsdzar") && (
          <td className="px-3 py-2 text-right tabular-nums text-xs text-[var(--color-text-primary)]">
            {fmt(ticket.fxWaUsdzar, 4)}
          </td>
        )}
        {isColVisible("spotZarPerG") && (
          <td className="px-3 py-2 text-right tabular-nums text-xs text-[var(--color-text-primary)]">
            {fmt(ticket.spotZarPerG, 2)}
          </td>
        )}
        {isColVisible("profitUsd") && (
          <td className="px-3 py-2 text-right">
            <span
              className={`tabular-nums text-xs font-medium ${profitColorClass(ticket.profitUsd)}`}
            >
              {fmt(ticket.profitUsd, 2)}
            </span>
          </td>
        )}
        {isColVisible("profitZar") && (
          <td className="px-3 py-2 text-right">
            <span
              className={`tabular-nums text-xs font-medium ${profitColorClass(ticket.profitZar)}`}
            >
              {fmt(ticket.profitZar, 2)}
            </span>
          </td>
        )}
        {isColVisible("profitPct") && (
          <td className="px-3 py-2 text-center">
            {marginBadge(ticket.profitPct)}
          </td>
        )}
        {isColVisible("controlAccountOz") && (
          <td className="px-3 py-2 text-right tabular-nums text-xs text-[var(--color-text-primary)]">
            {fmt(ticket.controlAccountOz, 4)}
          </td>
        )}
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="border-b border-[var(--color-border)]">
          <td colSpan={visibleColumnCount} className="bg-[var(--color-background)] p-0">
            <div className="space-y-4 p-4">
              {/* On-demand detail fetch */}
              <TicketDetail tradeNum={ticket.tradeNum} />

              {/* Summary metrics from the parent data */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:grid-cols-4 lg:grid-cols-7">
                <div>
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">
                    Buy Side (ZAR)
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(ticket.buySideZar, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">
                    Sell Side (ZAR)
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(ticket.sellSideZar, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">
                    StoneX ZAR Flow
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(ticket.stonexZarFlow, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">
                    Control Acc (g)
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(ticket.controlAccountG, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">
                    Control Acc (ZAR)
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(ticket.controlAccountZar, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">
                    USD P&L
                  </p>
                  <p
                    className={`text-xs font-semibold tabular-nums ${profitColorClass(ticket.profitUsd)}`}
                  >
                    {fmt(ticket.profitUsd, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">
                    ZAR P&L
                  </p>
                  <p
                    className={`text-xs font-semibold tabular-nums ${profitColorClass(ticket.profitZar)}`}
                  >
                    {fmt(ticket.profitZar, 2)}
                  </p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
