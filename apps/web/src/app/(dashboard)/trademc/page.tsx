import { PageShell } from "@/components/layout/page-shell";

export default function TradeMCPage() {
  return (
    <PageShell
      title="TradeMC Trades"
      description="View and manage TradeMC client metal bookings."
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
