"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Scale, DollarSign, Landmark, Gem, CircleDot, Hexagon } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { fmt, fmtDate } from "@/lib/utils";

// ── Types ──

interface MetalBalance {
  balanceOz: number;
  balanceG: number;
  label: string;
}

interface CurrencyBalance {
  balance: number;
  label: string;
}

interface BalancesResponse {
  ok: boolean;
  balances: {
    xau: MetalBalance;
    xag: MetalBalance;
    xpt: MetalBalance;
    xpd: MetalBalance;
    usd: CurrencyBalance;
    zar: CurrencyBalance;
  };
  stats: {
    totalTrades: number;
    uniqueTrades: number;
    lastTradeDate: string | null;
    xauTradeCount: number;
    xagTradeCount: number;
    xptTradeCount: number;
    xpdTradeCount: number;
    fxTradeCount: number;
    openPositions: number;
    closedPositions: number;
  };
}

// ── Helpers ──

function balanceColor(val: number): string {
  if (val > 0.001) return "text-green-600";
  if (val < -0.001) return "text-red-600";
  return "text-[var(--color-text-primary)]";
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

// ── Metal Balance Card ──

function MetalCard({
  metal,
  badge,
  icon: Icon,
  iconColor,
  badgeBg,
  badgeText,
  iconBg,
}: {
  metal: MetalBalance;
  badge: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
}) {
  return (
    <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 overflow-hidden">
      <span className={`absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeBg} ${badgeText}`}>
        {badge}
      </span>
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            {metal.label}
          </p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${iconColor}`}>
            {fmt(metal.balanceOz, 4)}
            <span className={`ml-1.5 text-base font-medium opacity-70`}>
              oz
            </span>
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)] tabular-nums">
            {fmt(metal.balanceG, 2)} g
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loaders ──

function BalanceCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-3 w-20 rounded bg-[var(--color-border)]" />
          <div className="h-8 w-40 rounded bg-[var(--color-border)]" />
          <div className="h-3 w-28 rounded bg-[var(--color-border)]" />
        </div>
        <div className="h-10 w-10 rounded-lg bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 animate-pulse">
      <div className="h-3 w-24 rounded bg-[var(--color-border)]" />
      <div className="mt-2 h-6 w-16 rounded bg-[var(--color-border)]" />
    </div>
  );
}

// ── Page Component ──

export default function AccountBalancesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, isFetching } =
    useQuery<BalancesResponse>({
      queryKey: ["account-balances"],
      queryFn: async () => {
        const resp = await fetch("/api/pmx/account-balances");
        if (!resp.ok) throw new Error("Failed to load account balances");
        return resp.json();
      },
    });

  const balances = data?.balances;
  const stats = data?.stats;

  return (
    <PageShell
      title="Account Balances"
      description="Current PMX account holdings across metals, USD, and ZAR."
      actions={
        <button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["account-balances"] })
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
          Failed to load account balances:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* ── Metal Balance Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
        </div>
      ) : balances ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetalCard
            metal={balances.xau}
            badge="XAU"
            icon={Scale}
            iconColor="text-amber-600"
            badgeBg="bg-amber-100"
            badgeText="text-amber-700"
            iconBg="bg-amber-100"
          />
          <MetalCard
            metal={balances.xag}
            badge="XAG"
            icon={Gem}
            iconColor="text-slate-500"
            badgeBg="bg-slate-100"
            badgeText="text-slate-600"
            iconBg="bg-slate-100"
          />
          <MetalCard
            metal={balances.xpt}
            badge="XPT"
            icon={CircleDot}
            iconColor="text-cyan-600"
            badgeBg="bg-cyan-100"
            badgeText="text-cyan-700"
            iconBg="bg-cyan-100"
          />
          <MetalCard
            metal={balances.xpd}
            badge="XPD"
            icon={Hexagon}
            iconColor="text-rose-500"
            badgeBg="bg-rose-100"
            badgeText="text-rose-600"
            iconBg="bg-rose-100"
          />
        </div>
      ) : null}

      {/* ── Currency Balance Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
        </div>
      ) : balances ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* US Dollar (USD) */}
          <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 overflow-hidden">
            <span className="absolute top-4 right-4 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              USD
            </span>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {balances.usd.label}
                </p>
                <p
                  className={`mt-1 text-3xl font-bold tabular-nums ${balanceColor(balances.usd.balance)}`}
                >
                  ${fmt(Math.abs(balances.usd.balance), 2)}
                  {balances.usd.balance < -0.001 && (
                    <span className="ml-1 text-base font-medium">DR</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  US Dollars
                </p>
              </div>
            </div>
          </div>

          {/* South African Rand (ZAR) */}
          <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 overflow-hidden">
            <span className="absolute top-4 right-4 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              ZAR
            </span>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <Landmark size={20} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {balances.zar.label}
                </p>
                <p
                  className={`mt-1 text-3xl font-bold tabular-nums ${balanceColor(balances.zar.balance)}`}
                >
                  R{fmt(Math.abs(balances.zar.balance), 2)}
                  {balances.zar.balance < -0.001 && (
                    <span className="ml-1 text-base font-medium">DR</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  South African Rand
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Stats Section ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Trades"
            value={stats.totalTrades.toLocaleString()}
          />
          <StatCard
            label="Unique Trade Numbers"
            value={stats.uniqueTrades.toLocaleString()}
          />
          <StatCard
            label="Open Positions"
            value={stats.openPositions.toLocaleString()}
            className={
              stats.openPositions > 0 ? "text-amber-600" : undefined
            }
          />
          <StatCard
            label="Closed Positions"
            value={stats.closedPositions.toLocaleString()}
            className="text-green-600"
          />
        </div>
      ) : null}

      {/* ── Additional Info ── */}
      {stats && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">
              Last Trade:
            </span>
            {stats.lastTradeDate ? fmtDate(stats.lastTradeDate) : "No trades"}
          </div>
          <div className="h-4 w-px bg-[var(--color-border)]" />
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-amber-600">XAU:</span>
            {stats.xauTradeCount.toLocaleString()}
          </div>
          <div className="h-4 w-px bg-[var(--color-border)]" />
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-slate-500">XAG:</span>
            {stats.xagTradeCount.toLocaleString()}
          </div>
          <div className="h-4 w-px bg-[var(--color-border)]" />
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-cyan-600">XPT:</span>
            {stats.xptTradeCount.toLocaleString()}
          </div>
          <div className="h-4 w-px bg-[var(--color-border)]" />
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-rose-500">XPD:</span>
            {stats.xpdTradeCount.toLocaleString()}
          </div>
          <div className="h-4 w-px bg-[var(--color-border)]" />
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">
              FX:
            </span>
            {stats.fxTradeCount.toLocaleString()}
          </div>
        </div>
      )}
    </PageShell>
  );
}
