import { PageShell } from "@/components/layout/page-shell";

export default function AccountBalancesPage() {
  return (
    <PageShell
      title="Account Balances"
      description="View current account holdings by currency."
    >
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Coming Soon
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          This module will be implemented in a future phase.
        </p>
      </div>
    </PageShell>
  );
}
