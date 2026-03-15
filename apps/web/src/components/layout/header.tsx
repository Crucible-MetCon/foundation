"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Settings } from "lucide-react";

interface HeaderProps {
  user: {
    id: number;
    displayName: string;
    role: string;
  };
}

interface HeaderData {
  ok: boolean;
  prices: {
    xauUsd: number;
    usdZar: number;
    timestamp: string | null;
  };
  pendingGrams: number;
}

function fmtTicker(val: number, decimals: number): string {
  if (!val) return "-";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();

  const { data } = useQuery<HeaderData>({
    queryKey: ["header-data"],
    queryFn: async () => {
      const resp = await fetch("/api/header-data");
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: taskData } = useQuery<{ count: number }>({
    queryKey: ["my-tasks-count"],
    queryFn: async () => {
      const resp = await fetch("/api/my-tasks");
      if (!resp.ok) return { count: 0 };
      return resp.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const taskCount = taskData?.count ?? 0;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const xauUsd = data?.prices?.xauUsd ?? 0;
  const usdZar = data?.prices?.usdZar ?? 0;
  const zarUsd = usdZar > 0 ? 1 / usdZar : 0;
  const pendingG = data?.pendingGrams ?? 0;

  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      {/* Ticker */}
      <div className="flex items-center gap-3 text-[11px] tabular-nums">
        <span className="text-[var(--color-text-muted)]">
          <span className="text-amber-500/80">Au</span>{" "}
          <span className="font-medium text-[var(--color-text-secondary)]">
            ${fmtTicker(xauUsd, 2)}
          </span>
        </span>

        <span className="text-[var(--color-border)]">|</span>

        <span className="text-[var(--color-text-muted)]">
          USD/ZAR{" "}
          <span className="font-medium text-[var(--color-text-secondary)]">
            {fmtTicker(usdZar, 4)}
          </span>
        </span>

        <span className="text-[var(--color-border)]">|</span>

        <span className="text-[var(--color-text-muted)]">
          ZAR/USD{" "}
          <span className="font-medium text-[var(--color-text-secondary)]">
            {fmtTicker(zarUsd, 5)}
          </span>
        </span>

        <span className="text-[var(--color-border)]">|</span>

        <span className="text-[var(--color-text-muted)]">
          Pending{" "}
          <span className="font-medium text-[var(--color-text-secondary)]">
            {pendingG > 0
              ? `${pendingG.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}g`
              : "-"}
          </span>
        </span>
      </div>

      {/* User controls */}
      <div className="flex items-center gap-4">
        <div className="relative text-right">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {user.displayName}
          </p>
          <p className="text-xs capitalize text-[var(--color-text-muted)]">
            {user.role}
          </p>
          {taskCount > 0 && (
            <Link
              href="/admin/tasks"
              className="absolute -top-1.5 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm hover:bg-red-600 transition-colors"
              title={`${taskCount} active task${taskCount === 1 ? "" : "s"} assigned to you`}
            >
              {taskCount}
            </Link>
          )}
        </div>
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)]"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          onClick={handleLogout}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
