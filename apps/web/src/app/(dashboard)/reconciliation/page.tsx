"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Edit2, Save, X } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell, statusBadge } from "@/components/ui/data-table";
import { fmt, fmtDate } from "@/lib/utils";

// ── Types ──

interface CurrencyRecon {
  openingBalance: number | null;
  transactionTotal: number | null;
  expectedBalance: number | null;
  actualBalance: number | null;
  delta: number | null;
}

interface ReconRow {
  docNumber: string;
  tradeDate: string;
  valueDate: string;
  rowType: string;
  symbol: string;
  side: string;
  narration: string;
  movementXau: number | null;
  movementUsd: number | null;
  movementZar: number | null;
}

interface ReconResponse {
  ok: boolean;
  startDate: string;
  endDate: string;
  month: string;
  currencies: Record<string, CurrencyRecon>;
  actualBalancesOk: boolean;
  transactionsOk: boolean;
  rows: ReconRow[];
  diagnostics?: Record<string, unknown>;
}

// ── Helpers ──

/** Get first day of current month as YYYY-MM-DD */
function getMonthStart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Get today as YYYY-MM-DD */
function getToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format a currency value with appropriate decimals */
function fmtCurrency(
  val: number | null | undefined,
  currency: string
): string {
  if (val == null) return "-";
  const decimals = currency === "XAU" ? 4 : 2;
  return fmt(val, decimals);
}

/** Determine delta color class */
function deltaColorClass(val: number | null, currency: string): string {
  if (val == null) return "text-[var(--color-text-muted)]";
  const threshold = currency === "XAU" ? 0.01 : 1;
  if (Math.abs(val) <= threshold) return "text-emerald-600";
  return "text-red-600";
}

/** Row type badge variant */
function rowTypeBadgeVariant(
  rowType: string
): "success" | "warning" | "neutral" {
  switch (rowType) {
    case "FNC":
      return "success";
    case "JRV":
      return "warning";
    default:
      return "neutral";
  }
}

// ── Editable Opening Balance ──

function EditableOpeningBalance({
  currency,
  value,
  month,
}: {
  currency: string;
  value: number | null;
  month: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(
    value != null ? String(value) : ""
  );
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (openingBalance: number) => {
      const resp = await fetch("/api/pmx/account-recon/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          currency,
          opening_balance: openingBalance,
        }),
      });
      if (!resp.ok) throw new Error("Failed to save opening balance");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-recon"] });
      setEditing(false);
    },
  });

  function handleSave() {
    const num = parseFloat(editValue);
    if (isNaN(num)) return;
    mutation.mutate(num);
  }

  function handleCancel() {
    setEditValue(value != null ? String(value) : "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step="any"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          autoFocus
          className="w-32 rounded border border-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-1 text-sm text-right outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
          title="Save"
        >
          <Save size={14} />
        </button>
        <button
          onClick={handleCancel}
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-background)] transition-colors"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="tabular-nums">
        {value != null ? fmtCurrency(value, currency) : "-"}
      </span>
      <button
        onClick={() => {
          setEditValue(value != null ? String(value) : "");
          setEditing(true);
        }}
        className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
        title="Edit opening balance"
      >
        <Edit2 size={12} />
      </button>
    </div>
  );
}

// ── Currency Reconciliation Card ──

function ReconCard({
  currency,
  recon,
  month,
}: {
  currency: string;
  recon: CurrencyRecon;
  month: string;
}) {
  const decimals = currency === "XAU" ? 4 : 2;

  const rows: {
    label: string;
    content: React.ReactNode;
    className?: string;
  }[] = [
    {
      label: "Opening",
      content: (
        <EditableOpeningBalance
          currency={currency}
          value={recon.openingBalance}
          month={month}
        />
      ),
    },
    {
      label: "Transactions",
      content: (
        <span
          className={`tabular-nums ${
            recon.transactionTotal != null && recon.transactionTotal > 0
              ? "text-emerald-600"
              : recon.transactionTotal != null && recon.transactionTotal < 0
                ? "text-red-600"
                : ""
          }`}
        >
          {recon.transactionTotal != null
            ? `${recon.transactionTotal >= 0 ? "+" : ""}${fmt(recon.transactionTotal, decimals)}`
            : "-"}
        </span>
      ),
    },
    {
      label: "Expected",
      content: (
        <span className="tabular-nums font-medium">
          {fmtCurrency(recon.expectedBalance, currency)}
        </span>
      ),
      className: "border-t border-[var(--color-border)] pt-2 mt-1",
    },
    {
      label: "Actual",
      content:
        recon.actualBalance != null ? (
          <span className="tabular-nums">
            {fmtCurrency(recon.actualBalance, currency)}
          </span>
        ) : (
          <span className="text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
            Not connected
          </span>
        ),
    },
    {
      label: "Delta",
      content: (
        <span
          className={`tabular-nums font-semibold ${deltaColorClass(recon.delta, currency)}`}
        >
          {recon.delta != null ? fmt(recon.delta, decimals) : "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 text-sm font-semibold text-[var(--color-text-primary)] tracking-wide">
        {currency}
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex items-center justify-between text-sm ${row.className ?? ""}`}
          >
            <span className="text-[var(--color-text-secondary)]">
              {row.label}
            </span>
            <div className="text-[var(--color-text-primary)]">
              {row.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page Component ──

export default function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getToday);

  // Fetch recon data
  const { data, isLoading, error, isFetching } = useQuery<ReconResponse>({
    queryKey: ["account-recon", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      const resp = await fetch(`/api/pmx/account-recon?${params}`);
      if (!resp.ok) throw new Error("Failed to load reconciliation data");
      return resp.json();
    },
  });

  // Currency entries
  const currencyEntries = useMemo(() => {
    if (!data?.currencies) return [];
    const order = ["XAU", "USD", "ZAR"];
    return order
      .filter((c) => c in data.currencies)
      .map((c) => ({ currency: c, recon: data.currencies[c] }));
  }, [data?.currencies]);

  // Table columns
  const columns = useMemo<ColumnDef<ReconRow, any>[]>(
    () => [
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
        accessorKey: "rowType",
        header: "Type",
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return statusBadge(val, rowTypeBadgeVariant(val));
        },
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 100,
      },
      {
        accessorKey: "side",
        header: "Side",
        size: 70,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return (
            <span
              className={`text-xs font-semibold ${
                val === "BUY" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {val}
            </span>
          );
        },
      },
      {
        accessorKey: "narration",
        header: "Narration",
        size: 200,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          if (!val) return <span className="text-[var(--color-text-muted)]">-</span>;
          return (
            <span className="text-xs" title={val}>
              {val.length > 30 ? `${val.slice(0, 30)}...` : val}
            </span>
          );
        },
      },
      {
        accessorKey: "movementXau",
        header: "XAU Mvmt",
        size: 110,
        cell: ({ getValue }) => numCell(getValue() as number | null, 4),
      },
      {
        accessorKey: "movementUsd",
        header: "USD Mvmt",
        size: 120,
        cell: ({ getValue }) => numCell(getValue() as number | null, 2),
      },
      {
        accessorKey: "movementZar",
        header: "ZAR Mvmt",
        size: 120,
        cell: ({ getValue }) => numCell(getValue() as number | null, 2),
      },
    ],
    []
  );

  const month = data?.month ?? `${startDate.slice(0, 7)}`;

  return (
    <PageShell
      title="Account Reconciliation"
      description="Monthly account balance reconciliation across currencies."
      actions={
        <button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["account-recon"] })
          }
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
      {/* Warning banner: PMX credentials not configured */}
      {data && !data.actualBalancesOk && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 flex-shrink-0 text-amber-500"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            PMX API credentials not configured. Actual balances and delta cannot
            be computed.
          </span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load reconciliation data: {error.message}
        </div>
      )}

      {/* Date range selector */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <button
          onClick={() => {
            setStartDate(getMonthStart());
            setEndDate(getToday());
          }}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
        >
          Reset to MTD
        </button>
        {data && (
          <div className="ml-auto text-xs text-[var(--color-text-muted)]">
            Period: {fmtDate(data.startDate)} to {fmtDate(data.endDate)}
          </div>
        )}
      </div>

      {/* Reconciliation summary cards */}
      {currencyEntries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {currencyEntries.map(({ currency, recon }) => (
            <ReconCard
              key={currency}
              currency={currency}
              recon={recon}
              month={month}
            />
          ))}
        </div>
      )}

      {/* Transaction detail table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Transaction Details
        </h2>
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          compact
          paginate
          pageSize={50}
          searchable
          searchColumn="docNumber"
          searchPlaceholder="Search doc number..."
          stickyHeader
          maxHeight="calc(100vh - 520px)"
          emptyMessage={
            error
              ? "Failed to load reconciliation data."
              : "No transactions found for the selected period."
          }
          initialSorting={[{ id: "tradeDate", desc: true }]}
        />
      </div>
    </PageShell>
  );
}
