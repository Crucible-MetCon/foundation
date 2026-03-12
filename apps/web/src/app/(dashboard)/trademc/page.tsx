"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { RefreshCw, DollarSign, Weight, TrendingUp } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell, statusBadge } from "@/components/ui/data-table";
import { fmt, fmtDate, fmtDateTime } from "@/lib/utils";

// ── Constants ──
const GRAMS_PER_TROY_OUNCE = 31.1035;

// ── Types ──
interface Trade {
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

interface TradesResponse {
  ok: boolean;
  trades: Trade[];
  error?: string;
}

interface Company {
  id: number;
  name: string;
}

interface CompaniesResponse {
  ok: boolean;
  companies: Company[];
}

interface LivePrices {
  xauUsd: number;
  zarUsd: number;
  xauZar: number;
  lastUpdated: string;
}

interface LivePricesResponse {
  ok: boolean;
  xauUsd: number;
  zarUsd: number;
  xauZar: number;
  lastUpdated: string;
}

interface SyncResponse {
  ok: boolean;
  [key: string]: unknown;
  error?: string;
}

// ── Filters ──
interface Filters {
  status: string;
  companyId: string;
  refFilter: string;
  startDate: string;
  endDate: string;
}

const INITIAL_FILTERS: Filters = {
  status: "",
  companyId: "",
  refFilter: "",
  startDate: "",
  endDate: "",
};

// ── Summary Card ──
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</p>
      )}
    </div>
  );
}

// ── Status badge variant helper ──
function statusVariant(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
      return "danger";
    case "draft":
    default:
      return "neutral";
  }
}

// ── Page Component ──
export default function TradeMCPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.companyId) params.set("companyId", filters.companyId);
    if (filters.refFilter) params.set("refFilter", filters.refFilter);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    return params.toString();
  }, [filters]);

  // ── Queries ──

  // Live prices (auto-refresh every 60s)
  const { data: livePrices } = useQuery<LivePricesResponse>({
    queryKey: ["trademc-live-prices"],
    queryFn: async () => {
      const resp = await fetch("/api/trademc/live-prices");
      if (!resp.ok) throw new Error("Failed to load live prices");
      return resp.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Companies dropdown
  const { data: companiesData } = useQuery<CompaniesResponse>({
    queryKey: ["trademc-companies"],
    queryFn: async () => {
      const resp = await fetch("/api/trademc/companies");
      if (!resp.ok) throw new Error("Failed to load companies");
      return resp.json();
    },
    staleTime: 5 * 60_000,
  });

  // Trades
  const {
    data: tradesData,
    isLoading,
    error,
  } = useQuery<TradesResponse>({
    queryKey: ["trademc-trades", queryParams],
    queryFn: async () => {
      const resp = await fetch(`/api/trademc/trades?${queryParams}`);
      if (!resp.ok) throw new Error("Failed to load trades");
      return resp.json();
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/trademc/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeWeight: true }),
      });
      if (!resp.ok) throw new Error("Sync failed");
      return resp.json() as Promise<SyncResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trademc-trades"] });
      queryClient.invalidateQueries({ queryKey: ["trademc-companies"] });
      queryClient.invalidateQueries({ queryKey: ["trademc-live-prices"] });
    },
  });

  // ── Derived data ──
  const trades = tradesData?.trades ?? [];
  const companies = companiesData?.companies ?? [];

  const confirmedTrades = useMemo(
    () => trades.filter((t) => t.status?.toLowerCase() === "confirmed"),
    [trades]
  );

  const totalWeightGrams = useMemo(
    () =>
      confirmedTrades.reduce(
        (sum, t) => sum + (parseFloat(t.weight) || 0),
        0
      ),
    [confirmedTrades]
  );

  const totalWeightOz = totalWeightGrams / GRAMS_PER_TROY_OUNCE;

  // ── Table columns ──
  const columns = useMemo<ColumnDef<Trade, any>[]>(
    () => [
      {
        accessorKey: "trade_timestamp",
        header: "Trade Date",
        size: 100,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "company_name",
        header: "Company",
        size: 140,
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "ref_number",
        header: "Ref #",
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">
            {(getValue() as string) || (
              <span className="text-[var(--color-text-muted)]">-</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 90,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return statusBadge(status, statusVariant(status));
        },
      },
      {
        accessorKey: "weight",
        header: "Weight (g)",
        size: 100,
        cell: ({ getValue }) => numCell(getValue() as string, 2),
      },
      {
        id: "weight_oz",
        header: "Weight (oz)",
        size: 100,
        accessorFn: (row) => {
          const g = parseFloat(row.weight);
          return isNaN(g) ? null : g / GRAMS_PER_TROY_OUNCE;
        },
        cell: ({ getValue }) => numCell(getValue() as number, 4),
      },
      {
        id: "zar_oz",
        header: "ZAR/oz",
        size: 110,
        accessorFn: (row) =>
          row.zar_per_troy_ounce_confirmed ?? row.zar_per_troy_ounce,
        cell: ({ getValue }) => numCell(getValue() as string, 2),
      },
      {
        id: "zar_usd",
        header: "ZAR/USD",
        size: 100,
        accessorFn: (row) => row.zar_to_usd_confirmed ?? row.zar_to_usd,
        cell: ({ getValue }) => numCell(getValue() as string, 6),
      },
      {
        accessorKey: "usd_per_troy_ounce_confirmed",
        header: "USD/oz",
        size: 100,
        cell: ({ getValue }) => numCell(getValue() as string, 2),
      },
      {
        accessorKey: "requested_zar_per_gram",
        header: "ZAR/g Req",
        size: 100,
        cell: ({ getValue }) => numCell(getValue() as string, 2),
      },
      {
        accessorKey: "evo_exported",
        header: "EVO",
        size: 60,
        cell: ({ getValue }) => {
          const exported = getValue() as boolean;
          return statusBadge(
            exported ? "Yes" : "No",
            exported ? "success" : "neutral"
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        size: 160,
        enableSorting: false,
        cell: ({ getValue }) => {
          const notes = getValue() as string | null;
          if (!notes) return <span className="text-[var(--color-text-muted)]">-</span>;
          return (
            <span className="text-xs" title={notes}>
              {notes.length > 30 ? `${notes.slice(0, 30)}...` : notes}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <PageShell
      title="TradeMC Trades"
      description="View and manage TradeMC client metal bookings."
      actions={
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
        >
          {syncMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Sync TradeMC
            </>
          )}
        </button>
      }
    >
      {/* Sync result banner */}
      {syncMutation.isSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Sync completed successfully.
        </div>
      )}
      {syncMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Sync failed: {syncMutation.error?.message ?? "Unknown error"}
        </div>
      )}

      {/* Live Prices Bar */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            XAU/USD
          </span>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {livePrices?.xauUsd ? fmt(livePrices.xauUsd, 2) : "-"}
          </span>
        </div>
        <div className="h-4 w-px bg-[var(--color-border)]" />
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            ZAR/USD
          </span>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {livePrices?.zarUsd ? fmt(livePrices.zarUsd, 4) : "-"}
          </span>
        </div>
        <div className="h-4 w-px bg-[var(--color-border)]" />
        <div className="flex items-center gap-2">
          <Weight className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            XAU/ZAR
          </span>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {livePrices?.xauZar ? fmt(livePrices.xauZar, 2) : "-"}
          </span>
        </div>
        <div className="ml-auto text-xs text-[var(--color-text-muted)]">
          {livePrices?.lastUpdated
            ? `Last updated: ${fmtDateTime(livePrices.lastUpdated)}`
            : "Prices loading..."}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Trades"
          value={trades.length.toLocaleString()}
          sub={`Across ${new Set(trades.map((t) => t.company_id)).size} companies`}
        />
        <StatCard
          label="Confirmed Trades"
          value={confirmedTrades.length.toLocaleString()}
          sub={`${trades.length > 0 ? ((confirmedTrades.length / trades.length) * 100).toFixed(1) : "0"}% of total`}
        />
        <StatCard
          label="Total Weight (g)"
          value={fmt(totalWeightGrams, 2)}
          sub="Confirmed trades only"
        />
        <StatCard
          label="Total Weight (oz)"
          value={fmt(totalWeightOz, 4)}
          sub={`${fmt(totalWeightGrams / 1000, 3)} kg`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Company
          </label>
          <select
            value={filters.companyId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, companyId: e.target.value }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Ref #
          </label>
          <input
            type="text"
            value={filters.refFilter}
            onChange={(e) =>
              setFilters((f) => ({ ...f, refFilter: e.target.value }))
            }
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
          onClick={() => setFilters(INITIAL_FILTERS)}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={trades}
        loading={isLoading}
        compact
        paginate
        pageSize={50}
        stickyHeader
        maxHeight="calc(100vh - 480px)"
        emptyMessage={
          error
            ? "Failed to load trades. Try syncing first."
            : "No trades found. Click 'Sync TradeMC' to fetch trade data."
        }
        initialSorting={[{ id: "trade_timestamp", desc: true }]}
      />
    </PageShell>
  );
}
