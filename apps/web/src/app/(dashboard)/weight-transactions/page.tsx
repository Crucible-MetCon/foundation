"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Scale } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell, statusBadge } from "@/components/ui/data-table";
import { fmt, fmtDate } from "@/lib/utils";

// ── Types ──

interface WeightTransaction {
  id: number;
  directus_id: number;
  company_id: number;
  company_name: string;
  trade_id: number | null;
  type: string;
  weight: string;
  gold_percentage: string | null;
  rolling_balance: string;
  notes: string | null;
  pc_code: string | null;
  transaction_timestamp: string;
  synced_at: string;
  created_at: string;
}

interface WeightTxResponse {
  ok: boolean;
  transactions: WeightTransaction[];
}

// ── Filter state ──

interface Filters {
  companyId: string;
  type: string;
  startDate: string;
  endDate: string;
}

const TX_TYPES = ["All", "CREDIT", "DEBIT", "TRADE", "ADJUSTMENT"] as const;

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

export default function WeightTransactionsPage() {
  const [filters, setFilters] = useState<Filters>({
    companyId: "",
    type: "All",
    startDate: "",
    endDate: "",
  });

  // Client-side company name filter (not sent to API)
  const [companySearch, setCompanySearch] = useState("");

  // Build query params for API (server-side filters)
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.companyId) params.set("companyId", filters.companyId);
    if (filters.type && filters.type !== "All") params.set("type", filters.type);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    return params.toString();
  }, [filters]);

  // Fetch weight transactions
  const { data, isLoading, error, isFetching, refetch } =
    useQuery<WeightTxResponse>({
      queryKey: ["weight-transactions", queryParams],
      queryFn: async () => {
        const resp = await fetch(
          `/api/trademc/weight-transactions?${queryParams}`
        );
        if (!resp.ok) throw new Error("Failed to load weight transactions");
        return resp.json();
      },
    });

  // Client-side filter by company name
  const filteredTransactions = useMemo(() => {
    const txns = data?.transactions ?? [];
    if (!companySearch.trim()) return txns;
    const term = companySearch.toLowerCase();
    return txns.filter((t) => t.company_name?.toLowerCase().includes(term));
  }, [data?.transactions, companySearch]);

  // Summary stats computed from filtered data
  const summary = useMemo(() => {
    const txns = filteredTransactions;
    const totalCount = txns.length;
    let totalCredit = 0;
    let totalDebit = 0;

    for (const t of txns) {
      const w = parseFloat(t.weight) || 0;
      if (t.type === "CREDIT") totalCredit += w;
      if (t.type === "DEBIT") totalDebit += Math.abs(w);
    }

    return {
      totalCount,
      totalCredit,
      totalDebit,
      netWeight: totalCredit - totalDebit,
    };
  }, [filteredTransactions]);

  // Pending filters (for Apply button pattern)
  const [pendingFilters, setPendingFilters] = useState<Filters>({
    companyId: "",
    type: "All",
    startDate: "",
    endDate: "",
  });
  const [pendingCompanySearch, setPendingCompanySearch] = useState("");

  function handleApply() {
    setFilters({ ...pendingFilters });
    setCompanySearch(pendingCompanySearch);
  }

  function handleClear() {
    const cleared: Filters = {
      companyId: "",
      type: "All",
      startDate: "",
      endDate: "",
    };
    setPendingFilters(cleared);
    setPendingCompanySearch("");
    setFilters(cleared);
    setCompanySearch("");
  }

  // Table columns
  const columns = useMemo<ColumnDef<WeightTransaction, any>[]>(
    () => [
      {
        accessorKey: "transaction_timestamp",
        header: "Date",
        size: 100,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "company_name",
        header: "Company",
        size: 180,
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 110,
        cell: ({ getValue }) => {
          const type = getValue() as string;
          const variantMap: Record<string, "success" | "danger" | "warning" | "neutral"> = {
            CREDIT: "success",
            DEBIT: "danger",
            TRADE: "warning",
          };
          return statusBadge(type, variantMap[type] ?? "neutral");
        },
      },
      {
        accessorKey: "weight",
        header: "Weight (g)",
        size: 110,
        cell: ({ getValue }) => numCell(getValue() as string, 2),
      },
      {
        accessorKey: "gold_percentage",
        header: "Gold %",
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          if (val == null || val === "") return <span className="num-neutral">-</span>;
          const num = parseFloat(val);
          if (isNaN(num)) return <span className="num-neutral">-</span>;
          return (
            <span className="text-[var(--color-text-primary)]">
              {num.toLocaleString("en-US", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "rolling_balance",
        header: "Rolling Balance",
        size: 130,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          if (val == null || val === "") return <span className="num-neutral">-</span>;
          return (
            <span className="font-semibold text-[var(--color-text-primary)]">
              {fmt(val, 2)}
            </span>
          );
        },
      },
      {
        accessorKey: "pc_code",
        header: "PC Code",
        size: 100,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? (
            <span className="font-mono text-xs">{val}</span>
          ) : (
            <span className="num-neutral">-</span>
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        size: 200,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          if (!val) return <span className="num-neutral">-</span>;
          return (
            <span className="text-xs" title={val}>
              {val.length > 40 ? `${val.slice(0, 40)}...` : val}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <PageShell
      title="Weight Transactions"
      description="TradeMC gold weight transaction ledger."
      actions={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
        >
          <RefreshCw
            size={16}
            className={isFetching ? "animate-spin" : ""}
          />
          Refresh
        </button>
      }
    >
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load weight transactions: {error.message}
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Company
          </label>
          <input
            type="text"
            value={pendingCompanySearch}
            onChange={(e) => setPendingCompanySearch(e.target.value)}
            placeholder="Search company..."
            className="w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Type
          </label>
          <select
            value={pendingFilters.type}
            onChange={(e) =>
              setPendingFilters((f) => ({ ...f, type: e.target.value }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          >
            {TX_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All Types" : t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Start Date
          </label>
          <input
            type="date"
            value={pendingFilters.startDate}
            onChange={(e) =>
              setPendingFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            End Date
          </label>
          <input
            type="date"
            value={pendingFilters.endDate}
            onChange={(e) =>
              setPendingFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
        <button
          onClick={handleApply}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <Scale size={14} />
          Apply
        </button>
        <button
          onClick={handleClear}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Transactions"
          value={summary.totalCount.toLocaleString()}
        />
        <StatCard
          label="Total Credit"
          value={`${fmt(summary.totalCredit, 2)} g`}
          className="text-green-600"
        />
        <StatCard
          label="Total Debit"
          value={`${fmt(summary.totalDebit, 2)} g`}
          className="text-red-600"
        />
        <StatCard
          label="Net Weight"
          value={`${fmt(summary.netWeight, 2)} g`}
          className={
            summary.netWeight > 0
              ? "text-green-600"
              : summary.netWeight < 0
                ? "text-red-600"
                : "text-[var(--color-text-primary)]"
          }
        />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredTransactions}
        loading={isLoading}
        compact
        paginate
        pageSize={50}
        searchable
        searchColumn="company_name"
        searchPlaceholder="Search by company..."
        stickyHeader
        maxHeight="calc(100vh - 520px)"
        emptyMessage={
          error
            ? "Failed to load weight transactions."
            : companySearch
              ? "No transactions match the company filter."
              : "No weight transactions found."
        }
        initialSorting={[{ id: "transaction_timestamp", desc: true }]}
      />
    </PageShell>
  );
}
