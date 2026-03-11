import { PageShell } from "@/components/layout/page-shell";

export default function PmxLedgerPage() {
  return (
    <PageShell
      title="PMX Ledger"
      description="View and manage PMX/StoneX trading deals and ledger entries."
    >
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
          <span className="text-xl">📊</span>
        </div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          PMX Ledger
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Phase 1 implementation - PMX sync, trade data, filtering, and inline editing.
        </p>
      </div>
    </PageShell>
  );
}
