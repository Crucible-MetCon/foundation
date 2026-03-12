"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell, statusBadge } from "@/components/ui/data-table";
import { fmt, fmtDate } from "@/lib/utils";

// ── Types ──
interface LedgerRow {
  id: number;
  tradeNumber: string;
  fncNumber: string;
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
  traderName: string;
  status: "Open" | "Closed";
}

interface LedgerSummary {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalDebitUsd: number;
  totalCreditUsd: number;
  totalDebitZar: number;
  totalCreditZar: number;
}

interface LedgerResponse {
  ok: boolean;
  rows: LedgerRow[];
  summary: LedgerSummary;
  count: number;
  error?: string;
}

interface SyncResponse {
  ok: boolean;
  fetchedRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  error?: string;
}

interface PmxStatus {
  ok: boolean;
  tradeCount: number;
  lastSync: string | null;
  latestTradeDate: string | null;
  symbolBreakdown: { symbol: string; count: number }[];
}

// ── Filters ──
interface Filters {
  symbol: string;
  tradeNum: string;
  fncNumber: string;
  startDate: string;
  endDate: string;
  status: string;
}

// ── Editable cell component ──
function EditableTradeNumber({
  tradeId,
  value,
}: {
  tradeId: number;
  value: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (orderId: string) => {
      const resp = await fetch(`/api/pmx/trade/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!resp.ok) throw new Error("Update failed");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmx-ledger"] });
      setEditing(false);
    },
  });

  if (editing) {
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          if (editValue !== value) {
            mutation.mutate(editValue);
          } else {
            setEditing(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (editValue !== value) {
              mutation.mutate(editValue);
            } else {
              setEditing(false);
            }
          }
          if (e.key === "Escape") {
            setEditValue(value);
            setEditing(false);
          }
        }}
        autoFocus
        className="w-24 rounded border border-[var(--color-primary)] bg-[var(--color-surface)] px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
      />
    );
  }

  return (
    <span
      onClick={() => {
        setEditValue(value);
        setEditing(true);
      }}
      className="cursor-pointer rounded px-1 py-0.5 hover:bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium"
      title="Click to edit trade number"
    >
      {value || <span className="text-[var(--color-text-muted)] italic">—</span>}
    </span>
  );
}

// ── Summary Card ──
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Page Component ──
export default function PmxLedgerPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({
    symbol: "All",
    tradeNum: "",
    fncNumber: "",
    startDate: "",
    endDate: "",
    status: "",
  });

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.symbol && filters.symbol !== "All") params.set("symbol", filters.symbol);
    if (filters.tradeNum) params.set("tradeNum", filters.tradeNum);
    if (filters.fncNumber) params.set("fncNumber", filters.fncNumber);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.status) params.set("status", filters.status);
    return params.toString();
  }, [filters]);

  // Fetch ledger data
  const {
    data: ledgerData,
    isLoading,
    error,
  } = useQuery<LedgerResponse>({
    queryKey: ["pmx-ledger", queryParams],
    queryFn: async () => {
      const resp = await fetch(`/api/pmx/ledger?${queryParams}`);
      if (!resp.ok) throw new Error("Failed to load ledger");
      return resp.json();
    },
  });

  // Fetch PMX status
  const { data: pmxStatus } = useQuery<PmxStatus>({
    queryKey: ["pmx-status"],
    queryFn: async () => {
      const resp = await fetch("/api/pmx/status");
      if (!resp.ok) throw new Error("Failed to load status");
      return resp.json();
    },
    staleTime: 30_000,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/pmx/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error("Sync failed");
      return resp.json() as Promise<SyncResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmx-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["pmx-status"] });
    },
  });

  // Table columns
  const columns = useMemo<ColumnDef<LedgerRow, any>[]>(
    () => [
      {
        accessorKey: "tradeNumber",
        header: "Trade #",
        size: 100,
        cell: ({ row }) => (
          <EditableTradeNumber
            tradeId={row.original.id}
            value={row.original.tradeNumber}
          />
        ),
      },
      {
        accessorKey: "fncNumber",
        header: "FNC #",
        size: 90,
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
        accessorKey: "narration",
        header: "Narration",
        size: 280,
        cell: ({ getValue }) => (
          <span className="text-xs" title={getValue() as string}>
            {(getValue() as string)?.length > 50
              ? `${(getValue() as string).slice(0, 50)}...`
              : (getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "debitUsd",
        header: "Debit $+Au",
        size: 110,
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "creditUsd",
        header: "Credit +$-Au",
        size: 110,
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "balanceUsd",
        header: "Balance $",
        size: 110,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span className={`font-semibold ${val > 0.01 ? "num-positive" : val < -0.01 ? "num-negative" : "num-neutral"}`}>
              {Math.abs(val) < 0.01 ? "-" : fmt(val)}
            </span>
          );
        },
      },
      {
        accessorKey: "debitZar",
        header: "Debit ZAR",
        size: 120,
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "creditZar",
        header: "Credit ZAR",
        size: 120,
        cell: ({ getValue }) => numCell(getValue() as number),
      },
      {
        accessorKey: "balanceZar",
        header: "Balance ZAR",
        size: 120,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span className={`font-semibold ${val > 0.01 ? "num-positive" : val < -0.01 ? "num-negative" : "num-neutral"}`}>
              {Math.abs(val) < 0.01 ? "-" : fmt(val)}
            </span>
          );
        },
      },
      {
        accessorKey: "traderName",
        header: "Trader",
        size: 80,
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 80,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return statusBadge(
            status,
            status === "Open" ? "warning" : "success"
          );
        },
      },
    ],
    []
  );

  const summary = ledgerData?.summary;

  return (
    <PageShell
      title="PMX Ledger"
      description="View and manage PMX/StoneX trading deals with running balances."
      actions={
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
        >
          {syncMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Syncing...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 8a6 6 0 0 1 10.3-4.2M14 8a6 6 0 0 1-10.3 4.2" />
                <path d="M12 2v4h-4M4 14v-4h4" />
              </svg>
              Sync PMX
            </>
          )}
        </button>
      }
    >
      {/* Sync result banner */}
      {syncMutation.isSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Sync complete: {syncMutation.data?.fetchedRows ?? 0} rows fetched,{" "}
          {syncMutation.data?.inserted ?? 0} inserted, {syncMutation.data?.updated ?? 0} updated.
        </div>
      )}
      {syncMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Sync failed: {syncMutation.error?.message ?? "Unknown error"}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Trades"
            value={summary.totalTrades}
            sub={`${summary.openTrades} open, ${summary.closedTrades} closed`}
          />
          <StatCard
            label="DB Records"
            value={pmxStatus?.tradeCount ?? "-"}
            sub={pmxStatus?.lastSync ? `Last sync: ${new Date(pmxStatus.lastSync).toLocaleDateString()}` : "Never synced"}
          />
          <StatCard
            label="Net USD"
            value={fmt(summary.totalCreditUsd - summary.totalDebitUsd)}
            sub={`Debit: ${fmt(summary.totalDebitUsd)} | Credit: ${fmt(summary.totalCreditUsd)}`}
          />
          <StatCard
            label="Net ZAR"
            value={fmt(summary.totalCreditZar - summary.totalDebitZar)}
            sub={`Debit: ${fmt(summary.totalDebitZar)} | Credit: ${fmt(summary.totalCreditZar)}`}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Symbol
          </label>
          <select
            value={filters.symbol}
            onChange={(e) => setFilters((f) => ({ ...f, symbol: e.target.value }))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="All">All Symbols</option>
            <option value="XAUUSD">XAU/USD</option>
            <option value="USDZAR">USD/ZAR</option>
            <option value="XAGUSD">XAG/USD</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Trade #
          </label>
          <input
            type="text"
            value={filters.tradeNum}
            onChange={(e) => setFilters((f) => ({ ...f, tradeNum: e.target.value }))}
            placeholder="Search..."
            className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            FNC #
          </label>
          <input
            type="text"
            value={filters.fncNumber}
            onChange={(e) => setFilters((f) => ({ ...f, fncNumber: e.target.value }))}
            placeholder="Search..."
            className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            From
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
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
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">All</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        <button
          onClick={() =>
            setFilters({
              symbol: "All",
              tradeNum: "",
              fncNumber: "",
              startDate: "",
              endDate: "",
              status: "",
            })
          }
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={ledgerData?.rows ?? []}
        loading={isLoading}
        compact
        paginate
        pageSize={100}
        stickyHeader
        maxHeight="calc(100vh - 420px)"
        emptyMessage={
          error
            ? "Failed to load ledger data. Try syncing first."
            : "No trades found. Click 'Sync PMX' to fetch trade data."
        }
        initialSorting={[{ id: "tradeDate", desc: true }]}
      />
    </PageShell>
  );
}
