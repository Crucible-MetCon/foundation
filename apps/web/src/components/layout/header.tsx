"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

interface HeaderProps {
  user: {
    displayName: string;
    role: string;
  };
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/account-balances": "Account Balances",
  "/pmx-ledger": "PMX Ledger",
  "/open-positions": "Open Positions & Revaluation",
  "/forward-exposure": "Forward Exposure",
  "/hedging": "Metal Hedging",
  "/profit": "Profit Report",
  "/trademc": "TradeMC Trades",
  "/weight-transactions": "Weight Transactions",
  "/suppliers": "Supplier Balances",
  "/trading-ticket": "Trading Ticket",
  "/reconciliation": "Account Reconciliation",
  "/export-trades": "Export Trades",
  "/admin/users": "User Management",
};

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] || "Dashboard";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        {title}
      </h2>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {user.displayName}
          </p>
          <p className="text-xs capitalize text-[var(--color-text-muted)]">
            {user.role}
          </p>
        </div>
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
