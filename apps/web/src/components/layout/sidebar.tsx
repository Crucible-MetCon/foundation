"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

interface SidebarProps {
  user: {
    displayName: string;
    role: string;
    isAdmin: boolean;
  };
}

const navSections = [
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
      { href: "/suppliers", label: "Supplier Balances", icon: Building2 },
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

  const sections = user.isAdmin
    ? [...navSections, adminSection]
    : navSections;

  return (
    <aside className="flex w-60 flex-col bg-[var(--color-sidebar-bg)]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]">
          <span className="text-lg font-bold text-white">F</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">Foundation</h1>
          <p className="text-xs text-[var(--color-sidebar-text)]">
            FX & Gold Hedging
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

      {/* User info */}
      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-sm font-medium text-[var(--color-sidebar-active)]">
          {user.displayName}
        </p>
        <p className="text-xs capitalize text-[var(--color-sidebar-text)]">
          {user.role}
        </p>
      </div>
    </aside>
  );
}
