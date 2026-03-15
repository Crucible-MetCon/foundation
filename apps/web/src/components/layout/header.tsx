"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings, X, ClipboardPlus } from "lucide-react";

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

// ── Shared form styles ──
const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none";
const labelClass = "block text-sm font-medium text-[var(--color-text-secondary)] mb-1";

interface UserOption {
  id: number;
  displayName: string | null;
  username: string;
}

function LogDevModal({ open, onClose, currentUserId }: { open: boolean; onClose: () => void; currentUserId: number }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("enhancement");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState(String(currentUserId));
  const [error, setError] = useState("");

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/users");
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.users ?? [];
    },
    enabled: open,
    staleTime: 300_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          priority,
          assignedTo: assignedTo ? parseInt(assignedTo, 10) : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to create task");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks-count"] });
      setTitle("");
      setDescription("");
      setType("enhancement");
      setPriority("medium");
      setAssignedTo(String(currentUserId));
      setError("");
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    createMutation.mutate();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Log Dev Task
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Brief description of the task"
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-[80px] resize-y`}
              placeholder="Detailed description (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputClass}
              >
                <option value="enhancement">Enhancement</option>
                <option value="bug">Bug</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Assigned To</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={inputClass}
            >
              <option value="">Unassigned</option>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName || u.username}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [showLogDev, setShowLogDev] = useState(false);

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

      {/* Log Dev Modal */}
      <LogDevModal open={showLogDev} onClose={() => setShowLogDev(false)} currentUserId={user.id} />

      {/* User controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowLogDev(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)] transition-colors"
          title="Log a dev task"
        >
          <ClipboardPlus className="h-3.5 w-3.5" />
          Log Dev
        </button>
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
