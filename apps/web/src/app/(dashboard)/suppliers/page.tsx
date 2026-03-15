"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell, statusBadge } from "@/components/ui/data-table";
import { fmt, fmtDateTime } from "@/lib/utils";

// ── Types ──
interface Company {
  id: number;
  directus_id: number;
  company_name: string;
  status: string;
  registration_number: string;
  contact_number: string;
  email_address: string;
  trade_limit: string;
  blocked: boolean;
  vat_number: string;
  evo_customer_code: string;
  refining_rate: string;
  synced_at: string | null;
  created_at: string;
}

interface CompaniesResponse {
  ok: boolean;
  companies: Company[];
  error?: string;
}

interface SyncResponse {
  ok: boolean;
  companies?: { fetched: number; synced: number };
  trades?: { fetched: number; synced: number };
  error?: string;
}

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

// ── Page Component ──
export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);

  // Fetch companies
  const {
    data: companiesData,
    isLoading,
    error,
  } = useQuery<CompaniesResponse>({
    queryKey: ["trademc-companies"],
    queryFn: async () => {
      const resp = await fetch("/api/trademc/companies");
      if (!resp.ok) throw new Error("Failed to load suppliers");
      return resp.json();
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/trademc/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeWeight: false }),
      });
      if (!resp.ok) throw new Error("Sync failed");
      return resp.json() as Promise<SyncResponse>;
    },
    onSuccess: (data) => {
      setSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ["trademc-companies"] });
    },
    onError: (err) => {
      setSyncResult({ ok: false, error: err.message });
    },
  });

  // Computed summaries
  const companies = companiesData?.companies ?? [];

  const summary = useMemo(() => {
    const total = companies.length;
    const active = companies.filter((c) => !c.blocked).length;
    const totalTradeLimit = companies.reduce((sum, c) => {
      const val = parseFloat(c.trade_limit);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    return { total, active, totalTradeLimit };
  }, [companies]);

  // Table columns
  const columns = useMemo<ColumnDef<Company, any>[]>(
    () => [
      {
        accessorKey: "company_name",
        header: "Company Name",
        size: 220,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-text-primary)]">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 100,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const variant =
            status === "published"
              ? "success"
              : status === "blocked"
                ? "danger"
                : "neutral";
          return statusBadge(status, variant);
        },
      },
      {
        accessorKey: "registration_number",
        header: "Registration #",
        size: 140,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">
            {(getValue() as string) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "contact_number",
        header: "Contact",
        size: 130,
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
      {
        accessorKey: "email_address",
        header: "Email",
        size: 200,
        cell: ({ getValue }) => (
          <span className="text-xs">
            {(getValue() as string) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "trade_limit",
        header: "Trade Limit",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as string),
      },
      {
        accessorKey: "refining_rate",
        header: "Refining Rate",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => numCell(getValue() as string, 4),
      },
      {
        accessorKey: "evo_customer_code",
        header: "EVO Code",
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">
            {(getValue() as string) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "blocked",
        header: "Blocked",
        size: 80,
        cell: ({ getValue }) => {
          const blocked = getValue() as boolean;
          return statusBadge(
            blocked ? "Yes" : "No",
            blocked ? "danger" : "success"
          );
        },
      },
      {
        accessorKey: "synced_at",
        header: "Last Synced",
        size: 150,
        cell: ({ getValue }) => fmtDateTime(getValue() as string),
      },
    ],
    []
  );

  return (
    <PageShell
      title="Suppliers"
      description="TradeMC supplier companies and their trading details."
      actions={
        <button
          onClick={() => {
            setSyncResult(null);
            syncMutation.mutate();
          }}
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M2 8a6 6 0 0 1 10.3-4.2M14 8a6 6 0 0 1-10.3 4.2" />
                <path d="M12 2v4h-4M4 14v-4h4" />
              </svg>
              Sync Suppliers
            </>
          )}
        </button>
      }
    >
      {/* Sync result banner */}
      {syncResult && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            syncResult.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {syncResult.ok
            ? `Synced ${syncResult.companies?.synced ?? 0} companies, ${syncResult.trades?.synced ?? 0} trades`
            : syncResult.error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Suppliers"
          value={String(summary.total)}
          sub={`${companies.length} companies loaded`}
        />
        <StatCard
          label="Active Suppliers"
          value={String(summary.active)}
          sub={`${summary.total - summary.active} blocked`}
        />
        <StatCard
          label="Total Trade Limit"
          value={fmt(summary.totalTradeLimit)}
        />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={companies}
        loading={isLoading}
        compact
        paginate
        pageSize={50}
        searchable
        searchColumn="company_name"
        searchPlaceholder="Search by company name..."
        stickyHeader
        maxHeight="calc(100vh - 420px)"
        emptyMessage={
          error
            ? "Failed to load supplier data. Try syncing first."
            : "No suppliers found. Click 'Sync Suppliers' to fetch data."
        }
        initialSorting={[{ id: "company_name", desc: false }]}
      />
    </PageShell>
  );
}
