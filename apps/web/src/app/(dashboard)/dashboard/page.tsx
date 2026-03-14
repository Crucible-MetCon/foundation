"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Scale,
  DollarSign,
  Landmark,
  Shield,
  TrendingUp,
  BookOpen,
  FileText,
  ArrowRightLeft,
  Wallet,
  Download,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { fmt } from "@/lib/utils";

// ── Types ──

interface BalancesResponse {
  ok: boolean;
  balances: {
    xau: { balanceOz: number; balanceG: number; label: string };
    usd: { balance: number; label: string };
    zar: { balance: number; label: string };
  };
  stats: {
    totalTrades: number;
    uniqueTrades: number;
    lastTradeDate: string | null;
    xauTradeCount: number;
    fxTradeCount: number;
    openPositions: number;
    closedPositions: number;
  };
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
  rows: unknown[];
  summary: HedgingSummary;
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
  months: unknown[];
  summary: ProfitSummary;
}

interface SystemStatusResponse {
  ok: boolean;
  isLive: boolean;
  checkedAt: string;
  pmx: {
    ok: boolean;
    allPass: boolean;
    error: string | null;
    checks: { label: string; pass: boolean }[];
  };
  tmc: {
    ok: boolean;
    fresh: boolean;
    error: string | null;
    lastSyncedAt: string | null;
    minutesAgo: number | null;
    tradeCount: number;
    thresholdHours: number;
  };
}

// ── Helpers ──

function balanceColor(val: number): string {
  if (val > 0.001) return "text-green-600";
  if (val < -0.001) return "text-red-600";
  return "text-[var(--color-text-primary)]";
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Skeleton Components ──

function BalanceCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-[var(--color-border)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 rounded bg-[var(--color-border)]" />
          <div className="h-7 w-32 rounded bg-[var(--color-border)]" />
          <div className="h-3 w-20 rounded bg-[var(--color-border)]" />
        </div>
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 animate-pulse">
      <div className="h-3 w-20 rounded bg-[var(--color-border)]" />
      <div className="mt-2 h-6 w-16 rounded bg-[var(--color-border)]" />
    </div>
  );
}

// ── System Status Banner ──

function SystemStatusBanner({
  data,
  isLoading,
  isFetching,
  error,
  onRefresh,
}: {
  data: SystemStatusResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  onRefresh: () => void;
}) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
        <Loader2 size={18} className="animate-spin text-[var(--color-text-muted)]" />
        <span className="text-sm text-[var(--color-text-secondary)]">
          Checking system status...
        </span>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
        <div className="flex items-center gap-3">
          <AlertCircle size={18} className="text-amber-600" />
          <div>
            <span className="text-sm font-medium text-amber-800">
              Unable to determine system status
            </span>
            {error && (
              <p className="text-xs text-amber-600">
                {error.message}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Retry
        </button>
      </div>
    );
  }

  const { isLive, pmx, tmc, checkedAt } = data;
  const failedPmxChecks = pmx.checks.filter((c) => !c.pass);

  return (
    <div
      className={`rounded-xl border px-5 py-3 ${
        isLive
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Left: Status badge + details */}
        <div className="flex items-center gap-3">
          {/* Pulsing dot + label */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLive ? "bg-green-500 animate-ping" : "bg-red-500"
                }`}
              />
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  isLive ? "bg-green-500" : "bg-red-500"
                }`}
              />
            </span>
            <span
              className={`text-sm font-semibold ${
                isLive ? "text-green-800" : "text-red-800"
              }`}
            >
              {isLive ? "System Live" : "System Offline"}
            </span>
          </div>

          {/* Divider */}
          <span
            className={`hidden sm:block h-4 w-px ${
              isLive ? "bg-green-200" : "bg-red-200"
            }`}
          />

          {/* Detail chips */}
          <div className="hidden sm:flex items-center gap-2">
            {/* PMX Status */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                pmx.ok && pmx.allPass
                  ? "bg-green-100 text-green-700"
                  : pmx.ok && !pmx.allPass
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {pmx.ok && pmx.allPass ? (
                <CheckCircle2 size={11} />
              ) : pmx.ok && !pmx.allPass ? (
                <XCircle size={11} />
              ) : (
                <AlertCircle size={11} />
              )}
              {pmx.ok && pmx.allPass
                ? "PMX Verified"
                : pmx.ok && !pmx.allPass
                  ? `PMX Mismatch (${failedPmxChecks.map((c) => c.label).join(", ")})`
                  : "PMX Error"}
            </span>

            {/* TradeMC Status */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                tmc.ok && tmc.fresh
                  ? "bg-green-100 text-green-700"
                  : tmc.ok && !tmc.fresh
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {tmc.ok && tmc.fresh ? (
                <CheckCircle2 size={11} />
              ) : (
                <AlertCircle size={11} />
              )}
              {tmc.ok
                ? tmc.fresh
                  ? `TradeMC Synced${tmc.minutesAgo !== null ? ` (${tmc.minutesAgo}m ago)` : ""}`
                  : `TradeMC Stale${tmc.minutesAgo !== null ? ` (${tmc.minutesAgo}m ago)` : ""}`
                : "TradeMC Error"}
            </span>
          </div>
        </div>

        {/* Right: Checked time + refresh */}
        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${
              isLive ? "text-green-600" : "text-red-600"
            }`}
          >
            Checked {timeAgo(checkedAt)}
          </span>
          <button
            onClick={onRefresh}
            disabled={isFetching}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              isLive
                ? "text-green-700 hover:bg-green-100"
                : "text-red-700 hover:bg-red-100"
            }`}
          >
            <RefreshCw
              size={12}
              className={isFetching ? "animate-spin" : ""}
            />
            {isFetching ? "Checking" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Mobile detail row (visible on small screens) */}
      <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            pmx.ok && pmx.allPass
              ? "bg-green-100 text-green-700"
              : pmx.ok && !pmx.allPass
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
          }`}
        >
          {pmx.ok && pmx.allPass ? (
            <CheckCircle2 size={11} />
          ) : pmx.ok && !pmx.allPass ? (
            <XCircle size={11} />
          ) : (
            <AlertCircle size={11} />
          )}
          {pmx.ok && pmx.allPass
            ? "PMX Verified"
            : pmx.ok && !pmx.allPass
              ? "PMX Mismatch"
              : "PMX Error"}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            tmc.ok && tmc.fresh
              ? "bg-green-100 text-green-700"
              : tmc.ok && !tmc.fresh
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {tmc.ok && tmc.fresh ? (
            <CheckCircle2 size={11} />
          ) : (
            <AlertCircle size={11} />
          )}
          {tmc.ok
            ? tmc.fresh
              ? "TradeMC OK"
              : "TradeMC Stale"
            : "TradeMC Error"}
        </span>
      </div>
    </div>
  );
}

// ── Quick Link Data ──

const quickLinks = [
  {
    href: "/pmx-ledger",
    icon: BookOpen,
    title: "PMX Ledger",
    description: "View all PMX trades and transaction history.",
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  {
    href: "/trading-ticket",
    icon: FileText,
    title: "Trading Ticket",
    description: "Create new trade entries and tickets.",
    color: "text-violet-600",
    bg: "bg-violet-100",
  },
  {
    href: "/hedging",
    icon: Scale,
    title: "Hedging",
    description: "Monitor hedge positions against metal bookings.",
    color: "text-amber-600",
    bg: "bg-amber-100",
  },
  {
    href: "/profit",
    icon: ArrowRightLeft,
    title: "Profit Report",
    description: "Monthly profit analysis by metal and exchange.",
    color: "text-green-600",
    bg: "bg-green-100",
  },
  {
    href: "/reconciliation",
    icon: Wallet,
    title: "Reconciliation",
    description: "Reconcile trades across PMX and TradeMC.",
    color: "text-rose-600",
    bg: "bg-rose-100",
  },
  {
    href: "/export-trades",
    icon: Download,
    title: "Export Trades",
    description: "Download trade data in various formats.",
    color: "text-cyan-600",
    bg: "bg-cyan-100",
  },
];

// ── Page Component ──

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // Fetch system status (polls every 5 minutes)
  const {
    data: statusData,
    isLoading: statusLoading,
    isFetching: statusFetching,
    error: statusError,
  } = useQuery<SystemStatusResponse>({
    queryKey: ["system-status"],
    queryFn: async () => {
      const resp = await fetch("/api/system-status");
      if (!resp.ok) throw new Error("Failed to check system status");
      return resp.json();
    },
    refetchInterval: 5 * 60_000, // 5 minutes
    staleTime: 4 * 60_000, // 4 minutes
    retry: 1,
  });

  // Fetch account balances
  const {
    data: balancesData,
    isLoading: balancesLoading,
    error: balancesError,
  } = useQuery<BalancesResponse>({
    queryKey: ["dashboard-balances"],
    queryFn: async () => {
      const resp = await fetch("/api/pmx/account-balances");
      if (!resp.ok) throw new Error("Failed to load account balances");
      return resp.json();
    },
  });

  // Fetch hedging summary
  const {
    data: hedgingData,
    isLoading: hedgingLoading,
    error: hedgingError,
  } = useQuery<HedgingResponse>({
    queryKey: ["dashboard-hedging"],
    queryFn: async () => {
      const resp = await fetch("/api/hedging");
      if (!resp.ok) throw new Error("Failed to load hedging data");
      return resp.json();
    },
  });

  // Fetch profit summary
  const {
    data: profitData,
    isLoading: profitLoading,
    error: profitError,
  } = useQuery<ProfitResponse>({
    queryKey: ["dashboard-profit"],
    queryFn: async () => {
      const resp = await fetch("/api/profit/monthly");
      if (!resp.ok) throw new Error("Failed to load profit data");
      return resp.json();
    },
  });

  const balances = balancesData?.balances;
  const stats = balancesData?.stats;
  const hedgingSummary = hedgingData?.summary;
  const profitSummary = profitData?.summary;

  // Computed metrics
  const hedgeRate =
    hedgingSummary && hedgingSummary.totalTrades > 0
      ? ((hedgingSummary.fullyHedged / hedgingSummary.totalTrades) * 100).toFixed(1)
      : "0.0";

  const anyError = balancesError || hedgingError || profitError;

  return (
    <PageShell
      title="Dashboard"
      description="Overview of your trading positions and key metrics."
    >
      {/* ── System Status Banner ── */}
      <SystemStatusBanner
        data={statusData}
        isLoading={statusLoading}
        isFetching={statusFetching}
        error={statusError as Error | null}
        onRefresh={() =>
          queryClient.invalidateQueries({ queryKey: ["system-status"] })
        }
      />

      {/* Error banner */}
      {anyError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Some data failed to load. Individual sections may be incomplete.
        </div>
      )}

      {/* ── Account Balances Row ── */}
      {balancesLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
        </div>
      ) : balances ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Gold (XAU) */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Scale size={18} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Gold (XAU)
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-600">
                  {fmt(balances.xau.balanceOz, 4)}
                  <span className="ml-1 text-sm font-medium text-amber-500">oz</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)] tabular-nums">
                  {fmt(balances.xau.balanceG, 2)} g
                </p>
              </div>
            </div>
          </div>

          {/* US Dollar (USD) */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100">
                <DollarSign size={18} className="text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  US Dollar (USD)
                </p>
                <p
                  className={`mt-0.5 text-2xl font-bold tabular-nums ${balanceColor(balances.usd.balance)}`}
                >
                  ${fmt(Math.abs(balances.usd.balance), 2)}
                  {balances.usd.balance < -0.001 && (
                    <span className="ml-1 text-sm font-medium">DR</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  US Dollars
                </p>
              </div>
            </div>
          </div>

          {/* South African Rand (ZAR) */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <Landmark size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  South African Rand (ZAR)
                </p>
                <p
                  className={`mt-0.5 text-2xl font-bold tabular-nums ${balanceColor(balances.zar.balance)}`}
                >
                  R{fmt(Math.abs(balances.zar.balance), 2)}
                  {balances.zar.balance < -0.001 && (
                    <span className="ml-1 text-sm font-medium">DR</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  South African Rand
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Key Metrics Row ── */}
      {balancesLoading && hedgingLoading && profitLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Open Positions */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-[var(--color-text-muted)]" />
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Open Positions
              </p>
            </div>
            <p
              className={`mt-1 text-xl font-semibold ${
                stats && stats.openPositions > 0
                  ? "text-amber-600"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {stats ? stats.openPositions.toLocaleString() : "-"}
            </p>
          </div>

          {/* Hedge Rate */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-[var(--color-text-muted)]" />
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Hedge Rate
              </p>
            </div>
            <p
              className={`mt-1 text-xl font-semibold ${
                hedgingSummary
                  ? parseFloat(hedgeRate) >= 80
                    ? "text-green-600"
                    : parseFloat(hedgeRate) >= 50
                      ? "text-amber-600"
                      : "text-red-600"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {hedgingSummary ? `${hedgeRate}%` : "-"}
            </p>
          </div>

          {/* Total Profit */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-[var(--color-text-muted)]" />
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Total Profit
              </p>
            </div>
            <p
              className={`mt-1 text-xl font-semibold ${
                profitSummary
                  ? profitSummary.totalProfitZar > 0
                    ? "text-green-600"
                    : profitSummary.totalProfitZar < 0
                      ? "text-red-600"
                      : "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {profitSummary
                ? `R ${fmt(profitSummary.totalProfitZar, 0)}`
                : "-"}
            </p>
          </div>

          {/* Total Trades */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-[var(--color-text-muted)]" />
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Total Trades
              </p>
            </div>
            <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
              {stats ? stats.totalTrades.toLocaleString() : "-"}
            </p>
          </div>
        </div>
      )}

      {/* ── Hedging Status Row ── */}
      {hedgingLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : hedgingSummary ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
            Hedging Status
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Total Trades
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
                {hedgingSummary.totalTrades.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Fully Hedged
              </p>
              <p className="mt-1 text-xl font-semibold text-green-600">
                {hedgingSummary.fullyHedged.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Partially Hedged
              </p>
              <p className="mt-1 text-xl font-semibold text-amber-600">
                {hedgingSummary.partiallyHedged.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Unhedged
              </p>
              <p className="mt-1 text-xl font-semibold text-red-600">
                {hedgingSummary.unhedged.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Quick Links Section ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Quick Links
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all hover:border-[var(--color-primary)] hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${link.bg}`}
                  >
                    <Icon size={18} className={link.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]">
                      {link.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {link.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
