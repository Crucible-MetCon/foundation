"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Scale, Shield, AlertTriangle, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell, statusBadge } from "@/components/ui/data-table";
import { fmt } from "@/lib/utils";

// ── Types ──

interface HedgingRow {
  tradeNum: string;
  tmWeightG: number;
  tmWeightOz: number;
  companyName: string;
  stonexBuyOz: number;
  stonexSellOz: number;
  stonexNetOz: number;
  stonexHedgeG: number;
  pmxNetUsd: number;
  hedgeNeedG: number;
  metalNeedOz: number;
  usdNeed: number;
  metalHedged: boolean;
  usdHedged: boolean;
  hedged: boolean;
  hedgeStatus: "Hedged" | "USD to cut" | "Metal to hedge" | "Metal + USD";
}

interface HedgingSummary {
  totalTrades: number;
  fullyHedged: number;
  partiallyHedged: number;
  unhedged: number;
  totalMetalGapG: number;
  totalMetalGapOz: number;
  totalUsdRemaining: number;
}

interface HedgingResponse {
  ok: boolean;
  rows: HedgingRow[];
  summary: HedgingSummary;
}

// ── Filter type ──

type FilterTab = "all" | "hedged" | "partial" | "unhedged";

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

export default function HedgingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Fetch hedging data
  const { data, isLoading, error, isFetching } = useQuery<HedgingResponse>({
    queryKey: ["hedging"],
    queryFn: async () => {
      const resp = await fetch("/api/hedging");
      if (!resp.ok) throw new Error("Failed to load hedging data");
      return resp.json();
    },
  });

  // Client-side filtering based on active tab
  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    switch (activeTab) {
      case "hedged":
        return rows.filter((r) => r.hedged);
      case "partial":
        return rows.filter((r) => !r.hedged && r.metalHedged);
      case "unhedged":
        return rows.filter((r) => !r.hedged && !r.metalHedged);
      default:
        return rows;
    }
  }, [data?.rows, activeTab]);

  // Table columns
  const columns = useMemo<ColumnDef<HedgingRow, any>[]>(
    () => [
      {
        accessorKey: "tradeNum",
        header: "Trade #",
        size: 100,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "companyName",
        header: "Company",
        size: 180,
      },
      {
        accessorKey: "tmWeightG",
        header: "TradeMC Weight (g)",
        size: 130,
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "tmWeightOz",
        header: "TradeMC Weight (oz)",
        size: 140,
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "stonexBuyOz",
        header: "StoneX Buy (oz)",
        size: 120,
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "stonexSellOz",
        header: "StoneX Sell (oz)",
        size: 120,
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "stonexNetOz",
        header: "StoneX Net (oz)",
        size: 120,
        cell: ({ getValue }) => numCell(getValue() as number, 4),
      },
      {
        accessorKey: "hedgeNeedG",
        header: "Metal Gap (g)",
        size: 110,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          if (val == null || val === 0)
            return <span className="num-neutral">-</span>;
          const formatted = val.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          // Positive value > 32g means needs hedging: show red
          if (val > 32) {
            return <span className="num-negative">{formatted}</span>;
          }
          return (
            <span className={val > 0 ? "num-positive" : "num-negative"}>
              {formatted}
            </span>
          );
        },
      },
      {
        accessorKey: "pmxNetUsd",
        header: "USD Position",
        size: 120,
        cell: ({ getValue }) => numCell(getValue() as number, 2),
      },
      {
        accessorKey: "hedgeStatus",
        header: "Status",
        size: 120,
        cell: ({ getValue }) => {
          const status = getValue() as HedgingRow["hedgeStatus"];
          const variantMap: Record<
            HedgingRow["hedgeStatus"],
            "success" | "warning" | "danger"
          > = {
            Hedged: "success",
            "USD to cut": "warning",
            "Metal to hedge": "danger",
            "Metal + USD": "danger",
          };
          return statusBadge(status, variantMap[status]);
        },
      },
    ],
    []
  );

  const summary = data?.summary;
  const hedgeRate =
    summary && summary.totalTrades > 0
      ? ((summary.fullyHedged / summary.totalTrades) * 100).toFixed(1)
      : "0.0";

  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "All", count: summary?.totalTrades },
    { key: "hedged", label: "Hedged", count: summary?.fullyHedged },
    {
      key: "partial",
      label: "Partially Hedged",
      count: summary?.partiallyHedged,
    },
    { key: "unhedged", label: "Unhedged", count: summary?.unhedged },
  ];

  return (
    <PageShell
      title="Metal Hedging"
      description="Compare TradeMC metal bookings against PMX hedge trades."
      actions={
        <button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["hedging"] })
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
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load hedging data: {error.message}
        </div>
      )}

      {/* Primary summary stat cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Trades"
            value={summary.totalTrades.toLocaleString()}
          />
          <StatCard
            label="Fully Hedged"
            value={summary.fullyHedged.toLocaleString()}
            className="text-green-600"
          />
          <StatCard
            label="Partially Hedged"
            value={summary.partiallyHedged.toLocaleString()}
            className="text-amber-600"
          />
          <StatCard
            label="Unhedged"
            value={summary.unhedged.toLocaleString()}
            className="text-red-600"
          />
        </div>
      )}

      {/* Secondary stats row */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Metal Gap"
            value={`${fmt(summary.totalMetalGapG, 2)} g`}
            sub={`${fmt(summary.totalMetalGapOz, 4)} oz`}
          />
          <StatCard
            label="USD Remaining"
            value={`$${fmt(summary.totalUsdRemaining, 2)}`}
          />
          <StatCard
            label="Hedge Rate"
            value={`${hedgeRate}%`}
            sub={`${summary.fullyHedged} of ${summary.totalTrades} trades`}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-[var(--color-background)] text-[var(--color-text-muted)]"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredRows}
        loading={isLoading}
        compact
        paginate
        pageSize={50}
        searchable
        searchColumn="tradeNum"
        searchPlaceholder="Search trade number..."
        stickyHeader
        maxHeight="calc(100vh - 480px)"
        emptyMessage={
          error
            ? "Failed to load hedging data."
            : activeTab !== "all"
              ? "No trades match the selected filter."
              : "No hedging data available."
        }
        initialSorting={[{ id: "tradeNum", desc: false }]}
        rowClassName={(row) => {
          if (row.hedged) return "";
          if (row.metalHedged) return "bg-amber-50/50";
          return "bg-red-50/30";
        }}
      />
    </PageShell>
  );
}
