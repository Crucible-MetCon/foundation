"use client";

import { PageShell } from "@/components/layout/page-shell";
import { useSettings } from "@/contexts/settings-context";
import { RotateCcw } from "lucide-react";

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
