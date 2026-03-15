"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/page-shell";
import { useSettings } from "@/contexts/settings-context";
import { RotateCcw, Check } from "lucide-react";

// All PMX Ledger columns that can be toggled
const LEDGER_COLUMNS = [
  { key: "tradeNumber", label: "Trade #" },
  { key: "docNumber", label: "Doc #" },
  { key: "tradeDate", label: "Trade Date" },
  { key: "valueDate", label: "Value Date" },
  { key: "symbol", label: "Symbol" },
  { key: "side", label: "Side" },
  { key: "narration", label: "Narration" },
  { key: "debitUsd", label: "Debit $" },
  { key: "creditUsd", label: "Credit $" },
  { key: "balanceUsd", label: "Balance $" },
  { key: "debitZar", label: "Debit ZAR" },
  { key: "creditZar", label: "Credit ZAR" },
  { key: "balanceZar", label: "Balance ZAR" },
  { key: "tradeXauOz", label: "Au OZ / G" },
  { key: "tradeXagOz", label: "Ag OZ / G" },
  { key: "tradeXptOz", label: "Pt OZ / G" },
  { key: "tradeXpdOz", label: "Pd OZ / G" },
  { key: "traderName", label: "Trader" },
  { key: "status", label: "Status" },
];

// ── Hurdle Rate (DB-backed) ──
function HurdleRateSection() {
  const queryClient = useQueryClient();

  const { data: settingsData } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const resp = await fetch("/api/settings");
      if (!resp.ok) throw new Error("Failed to load settings");
      return resp.json();
    },
  });

  const [localRate, setLocalRate] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync local state when server data loads
  useEffect(() => {
    if (settingsData?.settings?.hurdle_rate_pct && !localRate) {
      setLocalRate(settingsData.settings.hurdle_rate_pct);
    }
  }, [settingsData, localRate]);

  const saveMutation = useMutation({
    mutationFn: async (value: string) => {
      const resp = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "hurdle_rate_pct", value }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || "Failed to save");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      queryClient.invalidateQueries({ queryKey: ["profit-daily-chart"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = () => {
    const parsed = parseFloat(localRate);
    if (isNaN(parsed) || parsed < 0 || parsed > 10) return;
    saveMutation.mutate(String(parsed));
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
        Trading Parameters
      </h2>
      <div className="max-w-xs">
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          Traders Internal Hurdle Rate (%)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={localRate}
            onChange={(e) => setLocalRate(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          />
          {saved && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-positive)]">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {saveMutation.isPending && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Applied as a percentage of daily traded value to calculate the hurdle
          bar on the Profit charts. Default: 0.2%
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateDecimals, toggleColumn, resetDefaults } =
    useSettings();

  return (
    <PageShell
      title="Settings"
      description="Configure display preferences for the Foundation platform."
      actions={
        <button
          onClick={resetDefaults}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </button>
      }
    >
      {/* Decimal Places */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Decimal Places
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              Prices (currency / metal)
            </label>
            <input
              type="number"
              min={0}
              max={6}
              value={settings.decimals.price}
              onChange={(e) =>
                updateDecimals({ price: Math.min(6, Math.max(0, parseInt(e.target.value) || 0)) })
              }
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Applied to metal prices and FX rates. Default: 3
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              Weights (oz / grams)
            </label>
            <input
              type="number"
              min={0}
              max={6}
              value={settings.decimals.weight}
              onChange={(e) =>
                updateDecimals({ weight: Math.min(6, Math.max(0, parseInt(e.target.value) || 0)) })
              }
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Applied to metal quantities in troy ounces or grams. Default: 2
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              Balances / Debits / Credits
            </label>
            <input
              type="number"
              min={0}
              max={6}
              value={settings.decimals.balance}
              onChange={(e) =>
                updateDecimals({ balance: Math.min(6, Math.max(0, parseInt(e.target.value) || 0)) })
              }
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Applied to calculated balance, debit, and credit columns. Default: 2
            </p>
          </div>
        </div>
      </div>

      {/* Trading Parameters */}
      <HurdleRateSection />

      {/* Column Visibility */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
          PMX Ledger Column Visibility
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Uncheck columns to hide them from the PMX Ledger tables.
        </p>
        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {LEDGER_COLUMNS.map(({ key, label }) => {
            const isVisible = !settings.hiddenColumns.includes(key);
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-[var(--color-background)] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggleColumn(key)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-text-primary)]">
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
