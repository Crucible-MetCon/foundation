"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";

interface HeaderProps {
  user: {
    displayName: string;
    role: string;
  };
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-12 items-center justify-end border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {user.displayName}
          </p>
          <p className="text-xs capitalize text-[var(--color-text-muted)]">
            {user.role}
          </p>
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
