"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  ArrowRightLeft,
  TrendingUp,
  FileText,
  Download,
  Users,
  Scale,
  Wallet,
  Building2,
  ClipboardCheck,
  Home,
  Landmark,
  Package,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface SidebarProps {
  user: {
    displayName: string;
    role: string;
    isAdmin: boolean;
  };
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

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/account-balances", label: "Account Balances", icon: Landmark },
    ],
  },
  {
    label: "Trading",
    items: [
      { href: "/pmx-ledger", label: "PMX Ledger", icon: BookOpen },
      { href: "/open-positions", label: "Open Positions", icon: BarChart3 },
      {
        href: "/forward-exposure",
        label: "Forward Exposure",
        icon: TrendingUp,
      },
      { href: "/hedging", label: "Hedging", icon: Scale },
      { href: "/profit", label: "Profit", icon: ArrowRightLeft },
    ],
  },
  {
    label: "TradeMC",
    items: [
      { href: "/trademc", label: "TradeMC Trades", icon: ClipboardCheck },
      { href: "/weight-transactions", label: "Weight Transactions", icon: Package },
      { href: "/suppliers", label: "Suppliers", icon: Building2 },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/trading-ticket", label: "Trading Ticket", icon: FileText },
      { href: "/reconciliation", label: "Reconciliation", icon: Wallet },
      { href: "/export-trades", label: "Export Trades", icon: Download },
    ],
  },
];

const adminSection = {
  label: "Admin",
  items: [{ href: "/admin/users", label: "User Management", icon: Users }],
};

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const {
    data: status,
    isLoading: statusLoading,
    isFetching: statusFetching,
  } = useQuery<SystemStatusResponse>({
    queryKey: ["system-status"],
    queryFn: async () => {
      const resp = await fetch("/api/system-status");
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
    retry: 1,
  });

  const sections = user.isAdmin
    ? [...navSections, adminSection]
    : navSections;

  return (
    <aside className="flex w-60 flex-col bg-[var(--color-sidebar-bg)]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <img
          src="/logo-dark.png"
          alt="Metal Concentrators"
          className="h-8"
        />
        <div>
          <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">Foundation</h1>
          <p className="text-[10px] text-[var(--color-sidebar-text)]">
            FX & Metal Hedging
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-sidebar-text)]/60">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]"
                          : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-active)]"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* System Status */}
      <div className="border-t border-white/10 px-4 py-3">
        {statusLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-[var(--color-sidebar-text)]" />
            <span className="text-xs text-[var(--color-sidebar-text)]">
              Checking status...
            </span>
          </div>
        ) : status ? (
          <div className="space-y-2">
            {/* Live / Offline badge row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      status.isLive ? "bg-green-400 animate-ping" : "bg-red-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      status.isLive ? "bg-green-400" : "bg-red-400"
                    }`}
                  />
                </span>
                <span
                  className={`text-xs font-semibold ${
                    status.isLive ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {status.isLive ? "System Live" : "System Offline"}
                </span>
              </div>
              <button
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["system-status"] })
                }
                disabled={statusFetching}
                className="flex items-center justify-center rounded p-1 text-[var(--color-sidebar-text)] transition-colors hover:text-white disabled:opacity-50"
                title="Refresh status"
              >
                <RefreshCw
                  size={12}
                  className={statusFetching ? "animate-spin" : ""}
                />
              </button>
            </div>

            {/* Check details */}
            <div className="space-y-1">
              {/* PMX check */}
              <div className="flex items-center gap-1.5">
                {status.pmx.ok && status.pmx.allPass ? (
                  <CheckCircle2 size={11} className="shrink-0 text-green-400" />
                ) : status.pmx.ok ? (
                  <XCircle size={11} className="shrink-0 text-red-400" />
                ) : (
                  <AlertCircle size={11} className="shrink-0 text-amber-400" />
                )}
                <span className="text-[11px] text-[var(--color-sidebar-text)]">
                  {status.pmx.ok && status.pmx.allPass
                    ? "PMX Verified"
                    : status.pmx.ok
                      ? `PMX Mismatch`
                      : "PMX Error"}
                </span>
              </div>

              {/* TradeMC check */}
              <div className="flex items-center gap-1.5">
                {status.tmc.ok && status.tmc.fresh ? (
                  <CheckCircle2 size={11} className="shrink-0 text-green-400" />
                ) : status.tmc.ok ? (
                  <AlertCircle size={11} className="shrink-0 text-amber-400" />
                ) : (
                  <XCircle size={11} className="shrink-0 text-red-400" />
                )}
                <span className="text-[11px] text-[var(--color-sidebar-text)]">
                  {status.tmc.ok
                    ? status.tmc.fresh
                      ? `TradeMC Synced${status.tmc.minutesAgo !== null ? ` (${status.tmc.minutesAgo}m ago)` : ""}`
                      : `TradeMC Stale${status.tmc.minutesAgo !== null ? ` (${status.tmc.minutesAgo}m ago)` : ""}`
                    : "TradeMC Error"}
                </span>
              </div>
            </div>

            {/* Checked timestamp */}
            <p className="text-[10px] text-[var(--color-sidebar-text)]/50">
              Checked {timeAgo(status.checkedAt)}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-400" />
            <span className="text-xs text-[var(--color-sidebar-text)]">
              Status unavailable
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
