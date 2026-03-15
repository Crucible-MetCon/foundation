"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Search, FileText, ChevronDown, Download } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, numCell } from "@/components/ui/data-table";
import { fmt, fmtDate } from "@/lib/utils";
import { downloadCSV, downloadPDF } from "@/lib/export-utils";

// ── Types ──

interface TicketTmRow {
  companyName: string;
  weightG: number;
  weightOz: number;
  usdPerOzBooked: number;
  fxRate: number;
  usdValue: number;
  zarValue: number;
  refiningRate: number;
  zarValueLessRefining: number;
}

interface TicketStonexRow {
  docNumber: string;
  fncNumber: string;
  tradeDate: string;
  valueDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  narration: string;
}

interface TicketSummary {
  goldWaUsdOz: number;
  fxWaUsdzar: number;
  spotZarPerG: number;
  sellSideUsd: number;
  buySideUsd: number;
  sellSideZar: number;
  buySideZar: number;
  totalTradedOz: number;
  totalTradedG: number;
  controlAccountG: number;
  controlAccountOz: number;
  controlAccountZar: number;
  stonexZarFlow: number;
  profitUsd: number;
  profitZar: number;
  profitPct: number;
}

interface TicketResult {
  tradeNum: string;
  tmRows: TicketTmRow[];
  stonexRows: TicketStonexRow[];
  summary: TicketSummary;
}

interface TicketResponse {
  ok: boolean;
  ticket?: TicketResult;
  error?: string;
}

// ── StatCard component ──

function StatCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${className || "text-[var(--color-text-primary)]"}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</p>
      )}
    </div>
  );
}

// ── Constants (must match domain) ──
const GRAMS_PER_TROY_OUNCE = 31.1035;

// ── Audit Export helper ──

function buildAuditRows(ticket: TicketResult): Record<string, string>[] {
  const { tmRows, stonexRows, summary } = ticket;
  const rows: Record<string, string>[] = [];
  const an = auditNum;

  const goldTrades = stonexRows.filter(
    (t) => t.symbol.replace(/[/\- ]/g, "").startsWith("XAU")
  );
  const fxTrades = stonexRows.filter(
    (t) => t.symbol.replace(/[/\- ]/g, "").startsWith("USD")
  );
  const goldTotalQty = goldTrades.reduce((s, t) => s + t.quantity, 0);
  const goldTotalVal = goldTrades.reduce((s, t) => s + t.quantity * t.price, 0);
  const fxTotalQty = fxTrades.reduce((s, t) => s + t.quantity, 0);
  const fxTotalVal = fxTrades.reduce((s, t) => s + t.quantity * t.price, 0);
  let goldSignedOz = 0;
  for (const t of goldTrades) goldSignedOz += t.side === "BUY" ? t.quantity : -t.quantity;
  const tmTotalWeightG = tmRows.reduce((s, r) => s + r.weightG, 0);
  const tmTotalWeightOz = tmTotalWeightG / GRAMS_PER_TROY_OUNCE;
  const tmTotalUsd = tmRows.reduce((s, r) => s + r.usdValue, 0);
  const tmTotalZarGross = tmRows.reduce((s, r) => s + r.zarValue, 0);
  const tmTotalZarNet = tmRows.reduce((s, r) => s + r.zarValueLessRefining, 0);
  let stonexCashUsd = 0;
  for (const t of goldTrades) stonexCashUsd += t.side === "SELL" ? t.quantity * t.price : -(t.quantity * t.price);

  const add = (section: string, item: string, formula: string, result: string) =>
    rows.push({ Section: section, Item: item, Formula: formula, Result: result });

  // 1. Input Data Summary
  const s1 = "1. Input Data Summary";
  add(s1, "TradeMC bookings (buy side)", "", `${tmRows.length}`);
  add(s1, "StoneX/PMX trades (sell side)", "", `${stonexRows.length}`);
  add(s1, "XAUUSD (gold) trades", "", `${goldTrades.length}`);
  add(s1, "USDZAR (FX) trades", "", `${fxTrades.length}`);
  add(s1, "Conversion constant", "", `${GRAMS_PER_TROY_OUNCE} g/troy oz`);

  // 2. TradeMC Valuation
  const s2 = "2. TradeMC Valuation";
  tmRows.forEach((row, i) => {
    const prefix = `Booking ${i + 1}: ${row.companyName}`;
    add(s2, `${prefix} — Weight`, "", `${an(row.weightG, 2)} g`);
    add(s2, `${prefix} — Weight (oz)`, `${an(row.weightG, 2)} / ${GRAMS_PER_TROY_OUNCE}`, `${an(row.weightOz, 6)} oz`);
    add(s2, `${prefix} — Booked $/oz`, "", `$${an(row.usdPerOzBooked, 2)}`);
    add(s2, `${prefix} — USD value`, `${an(row.weightOz, 6)} x $${an(row.usdPerOzBooked, 2)}`, `$${an(row.usdValue, 2)}`);
    add(s2, `${prefix} — FX rate`, "", `${an(row.fxRate, 4)}`);
    add(s2, `${prefix} — ZAR gross`, `$${an(row.usdValue, 2)} x ${an(row.fxRate, 4)}`, `R ${an(row.zarValue, 2)}`);
    add(s2, `${prefix} — Refining %`, "", `${an(row.refiningRate, 2)}%`);
    add(s2, `${prefix} — Refining deduction`, `R ${an(row.zarValue, 2)} x ${an(row.refiningRate, 2)}%`, `R ${an(row.zarValue * (row.refiningRate / 100), 2)}`);
    add(s2, `${prefix} — ZAR net`, `R ${an(row.zarValue, 2)} x (1 - ${an(row.refiningRate, 2)}%)`, `R ${an(row.zarValueLessRefining, 2)}`);
  });
  if (tmRows.length > 1) {
    add(s2, "TOTAL — Weight", "", `${an(tmTotalWeightG, 2)} g (${an(tmTotalWeightOz, 6)} oz)`);
    add(s2, "TOTAL — USD value", "", `$${an(tmTotalUsd, 2)}`);
    add(s2, "TOTAL — ZAR gross", "", `R ${an(tmTotalZarGross, 2)}`);
    add(s2, "TOTAL — ZAR net", "", `R ${an(tmTotalZarNet, 2)}`);
  }

  // 3. StoneX Weighted Averages
  const s3 = "3. StoneX Weighted Averages";
  goldTrades.forEach((t) => {
    add(s3, `Gold: ${t.side} ${an(t.quantity, 4)} oz @ $${an(t.price, 2)}`, `${an(t.quantity, 4)} x $${an(t.price, 2)}`, `$${an(t.quantity * t.price, 2)}`);
  });
  add(s3, "Gold — Sum of notional", "", `$${an(goldTotalVal, 2)}`);
  add(s3, "Gold — Sum of quantity", "", `${an(goldTotalQty, 4)} oz`);
  add(s3, "Gold Weighted Average", `$${an(goldTotalVal, 2)} / ${an(goldTotalQty, 4)}`, `$${an(summary.goldWaUsdOz, 2)} /oz`);
  fxTrades.forEach((t) => {
    add(s3, `FX: ${t.side} $${an(t.quantity, 2)} @ R ${an(t.price, 4)}`, `$${an(t.quantity, 2)} x R ${an(t.price, 4)}`, `R ${an(t.quantity * t.price, 2)}`);
  });
  if (fxTrades.length > 0) {
    add(s3, "FX — Sum of notional", "", `R ${an(fxTotalVal, 2)}`);
    add(s3, "FX — Sum of quantity", "", `$${an(fxTotalQty, 2)}`);
    add(s3, "FX Weighted Average", `R ${an(fxTotalVal, 2)} / $${an(fxTotalQty, 2)}`, `R ${an(summary.fxWaUsdzar, 4)}`);
  }

  // 4. Spot Rate
  const s4 = "4. Spot Rate Derivation";
  add(s4, "Gold WA", "", `$${an(summary.goldWaUsdOz, 2)} /oz`);
  add(s4, "FX WA", "", `R ${an(summary.fxWaUsdzar, 4)}`);
  add(s4, "Spot ZAR per gram", `($${an(summary.goldWaUsdOz, 2)} x R ${an(summary.fxWaUsdzar, 4)}) / ${GRAMS_PER_TROY_OUNCE}`, `R ${an(summary.spotZarPerG, 2)} /g`);

  // 5. StoneX USD Cash Flow
  const s5 = "5. StoneX USD Cash Flow";
  goldTrades.forEach((t) => {
    const flow = t.side === "SELL" ? t.quantity * t.price : -(t.quantity * t.price);
    add(s5, `${t.side} ${an(t.quantity, 4)} oz @ $${an(t.price, 2)}`, `${t.side === "SELL" ? "+" : "-"}(${an(t.quantity, 4)} x $${an(t.price, 2)})`, `${flow >= 0 ? "+" : "-"}$${an(Math.abs(flow), 2)}`);
  });
  add(s5, "Net StoneX USD cash flow", "", `${stonexCashUsd >= 0 ? "+" : "-"}$${an(Math.abs(stonexCashUsd), 2)}`);
  add(s5, "Sell Side USD", "", `$${an(summary.sellSideUsd, 2)}`);
  add(s5, "Buy Side USD", "", `$${an(summary.buySideUsd, 2)}`);
  add(s5, "USD Profit", `$${an(summary.sellSideUsd, 2)} - $${an(summary.buySideUsd, 2)}`, `$${an(summary.profitUsd, 2)}`);

  // 6. Control Account
  const s6 = "6. Control Account";
  add(s6, "TradeMC total weight", "", `+${an(tmTotalWeightG, 2)} g (+${an(tmTotalWeightOz, 6)} oz)`);
  add(s6, "StoneX net gold (signed oz)", "", `${goldSignedOz >= 0 ? "+" : ""}${an(goldSignedOz, 4)} oz`);
  add(s6, "StoneX net in grams", `${an(goldSignedOz, 4)} oz x ${GRAMS_PER_TROY_OUNCE}`, `${an(goldSignedOz * GRAMS_PER_TROY_OUNCE, 2)} g`);
  add(s6, "Control Account (grams)", `${an(tmTotalWeightG, 2)} + (${an(goldSignedOz, 4)} x ${GRAMS_PER_TROY_OUNCE})`, `${an(summary.controlAccountG, 2)} g`);
  add(s6, "Control Account (oz)", `${an(summary.controlAccountG, 2)} / ${GRAMS_PER_TROY_OUNCE}`, `${an(summary.controlAccountOz, 4)} oz`);
  add(s6, "Control Account (ZAR)", `${an(summary.controlAccountG, 2)} x R ${an(summary.spotZarPerG, 2)}`, `R ${an(summary.controlAccountZar, 2)}`);

  // 7. ZAR Position
  const s7 = "7. ZAR Position";
  add(s7, "StoneX ZAR flow", `${an(tmTotalWeightG, 2)} g x R ${an(summary.spotZarPerG, 2)}/g`, `R ${an(summary.stonexZarFlow, 2)}`);
  add(s7, "Control Account ZAR", "", `R ${an(summary.controlAccountZar, 2)}`);
  add(s7, "Sell Side ZAR", `R ${an(summary.stonexZarFlow, 2)} + R ${an(summary.controlAccountZar, 2)}`, `R ${an(summary.sellSideZar, 2)}`);
  add(s7, "Buy Side ZAR", "", `R ${an(summary.buySideZar, 2)}`);

  // 8. Profit / Loss
  const s8 = "8. Profit / Loss";
  add(s8, "Sell Side USD", "", `$${an(summary.sellSideUsd, 2)}`);
  add(s8, "Buy Side USD", "", `$${an(summary.buySideUsd, 2)}`);
  add(s8, "Profit (USD)", `$${an(summary.sellSideUsd, 2)} - $${an(summary.buySideUsd, 2)}`, `$${an(summary.profitUsd, 2)}`);
  add(s8, "Sell Side ZAR", "", `R ${an(summary.sellSideZar, 2)}`);
  add(s8, "Buy Side ZAR", "", `R ${an(summary.buySideZar, 2)}`);
  add(s8, "Profit (ZAR)", `R ${an(summary.sellSideZar, 2)} - R ${an(summary.buySideZar, 2)}`, `R ${an(summary.profitZar, 2)}`);
  add(s8, "Profit Margin", `(R ${an(summary.profitZar, 2)} / R ${an(summary.buySideZar, 2)}) x 100`, `${an(summary.profitPct, 2)}%`);

  return rows;
}

// ── Audit Trail helper ──

/** Format a number for audit display with full precision */
function auditNum(val: number, decimals = 2): string {
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** A labelled calculation row: description on the left, formula + result on the right */
function CalcRow({
  label,
  formula,
  result,
  indent = 0,
  bold = false,
  highlight = false,
}: {
  label: string;
  formula?: string;
  result: string;
  indent?: number;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-1 ${indent ? "pl-4" : ""} ${highlight ? "bg-[var(--color-background)] rounded-md px-2 -mx-2" : ""}`}
    >
      <span
        className={`text-xs ${bold ? "font-semibold text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"} leading-relaxed`}
      >
        {label}
      </span>
      <span className="flex-shrink-0 text-right">
        {formula && (
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono mr-3">
            {formula}
          </span>
        )}
        <span
          className={`text-xs tabular-nums ${bold ? "font-semibold text-[var(--color-text-primary)]" : "font-medium text-[var(--color-text-primary)]"}`}
        >
          {result}
        </span>
      </span>
    </div>
  );
}

function AuditSection({
  title,
  number,
  children,
  defaultOpen = true,
}: {
  title: string;
  number: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-3 text-left hover:bg-[var(--color-background)] transition-colors rounded-lg px-2 -mx-2"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-white flex-shrink-0">
          {number}
        </span>
        <span className="text-sm font-semibold text-[var(--color-text-primary)] flex-1">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="pb-4 space-y-1">{children}</div>}
    </div>
  );
}

function AuditTrail({ ticket }: { ticket: TicketResult }) {
  const { tmRows, stonexRows, summary } = ticket;
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const fileBase = `ticket-${ticket.tradeNum}-${today}`;

  function handleExportCSV() {
    const rows = buildAuditRows(ticket);
    downloadCSV(rows, `${fileBase}.csv`);
  }

  async function handleExportPDF() {
    setExporting("pdf");
    try {
      const rows = buildAuditRows(ticket);
      await downloadPDF(rows, `${fileBase}.pdf`, `Trading Ticket ${ticket.tradeNum} — Audit Trail`);
    } finally {
      setExporting(null);
    }
  }

  // Re-derive intermediate values for detailed audit
  const goldTrades = stonexRows.filter(
    (t) => t.symbol.replace(/[/\- ]/g, "").startsWith("XAU")
  );
  const fxTrades = stonexRows.filter(
    (t) => t.symbol.replace(/[/\- ]/g, "").startsWith("USD")
  );

  // Gold WA calculation details
  const goldDetails = goldTrades.map((t) => ({
    ...t,
    notional: t.quantity * t.price,
  }));
  const goldTotalQty = goldDetails.reduce((s, t) => s + t.quantity, 0);
  const goldTotalVal = goldDetails.reduce((s, t) => s + t.notional, 0);

  // FX WA calculation details
  const fxDetails = fxTrades.map((t) => ({
    ...t,
    notional: t.quantity * t.price,
  }));
  const fxTotalQty = fxDetails.reduce((s, t) => s + t.quantity, 0);
  const fxTotalVal = fxDetails.reduce((s, t) => s + t.notional, 0);

  // Gold signed oz
  let goldSignedOz = 0;
  for (const t of goldTrades) {
    goldSignedOz += t.side === "BUY" ? t.quantity : -t.quantity;
  }

  // TM totals
  const tmTotalWeightG = tmRows.reduce((s, r) => s + r.weightG, 0);
  const tmTotalWeightOz = tmTotalWeightG / GRAMS_PER_TROY_OUNCE;
  const tmTotalUsd = tmRows.reduce((s, r) => s + r.usdValue, 0);
  const tmTotalZarGross = tmRows.reduce((s, r) => s + r.zarValue, 0);
  const tmTotalZarNet = tmRows.reduce((s, r) => s + r.zarValueLessRefining, 0);

  // StoneX USD cash
  let stonexCashUsd = 0;
  for (const t of goldTrades) {
    stonexCashUsd +=
      t.side === "SELL" ? t.quantity * t.price : -(t.quantity * t.price);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Ticket Audit Trail
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting === "pdf"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)] disabled:opacity-50 transition-colors"
          >
            {exporting === "pdf" ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            PDF
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Detailed step-by-step breakdown of all calculations for Trade{" "}
          <span className="font-semibold">{ticket.tradeNum}</span>. Every
          intermediate value is shown to allow full reconciliation.
        </p>

        {/* ── 1. Input Data Summary ── */}
        <AuditSection title="Input Data Summary" number={1}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Raw data loaded from the database for this ticket.
          </p>
          <CalcRow
            label="TradeMC bookings (buy side)"
            result={`${tmRows.length} booking${tmRows.length !== 1 ? "s" : ""}`}
          />
          <CalcRow
            label="StoneX/PMX trades (sell side)"
            result={`${stonexRows.length} trade${stonexRows.length !== 1 ? "s" : ""}`}
          />
          <CalcRow
            label="  └ XAUUSD (gold) trades"
            result={`${goldTrades.length}`}
            indent={1}
          />
          <CalcRow
            label="  └ USDZAR (FX) trades"
            result={`${fxTrades.length}`}
            indent={1}
          />
          <CalcRow
            label="Conversion constant"
            result={`${GRAMS_PER_TROY_OUNCE} g/troy oz`}
          />
        </AuditSection>

        {/* ── 2. TradeMC Valuation (per-row) ── */}
        <AuditSection title="TradeMC Valuation (Buy Side)" number={2}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Each booking is valued by converting weight to troy ounces,
            multiplying by the booked USD price, then converting to ZAR using
            the confirmed FX rate, and deducting the refining fee.
          </p>

          {tmRows.map((row, i) => (
            <div
              key={i}
              className="border border-[var(--color-border)] rounded-lg p-3 mb-3"
            >
              <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-2">
                Booking {i + 1}: {row.companyName}
              </p>

              <CalcRow
                label="Weight"
                result={`${auditNum(row.weightG, 2)} g`}
              />
              <CalcRow
                label="Weight in troy ounces"
                formula={`${auditNum(row.weightG, 2)} ÷ ${GRAMS_PER_TROY_OUNCE}`}
                result={`${auditNum(row.weightOz, 6)} oz`}
              />
              <CalcRow
                label="Booked gold price"
                result={`$${auditNum(row.usdPerOzBooked, 2)} /oz`}
              />
              <CalcRow
                label="USD value"
                formula={`${auditNum(row.weightOz, 6)} oz × $${auditNum(row.usdPerOzBooked, 2)}`}
                result={`$${auditNum(row.usdValue, 2)}`}
              />
              <CalcRow
                label="FX rate (ZAR/USD)"
                result={auditNum(row.fxRate, 4)}
              />
              <CalcRow
                label="ZAR value (gross)"
                formula={`$${auditNum(row.usdValue, 2)} × ${auditNum(row.fxRate, 4)}`}
                result={`R ${auditNum(row.zarValue, 2)}`}
              />
              <CalcRow
                label="Refining rate"
                result={`${auditNum(row.refiningRate, 2)}%`}
              />
              <CalcRow
                label="Refining deduction"
                formula={`R ${auditNum(row.zarValue, 2)} × ${auditNum(row.refiningRate, 2)}%`}
                result={`R ${auditNum(row.zarValue * (row.refiningRate / 100), 2)}`}
              />
              <CalcRow
                label="ZAR value (net of refining)"
                formula={`R ${auditNum(row.zarValue, 2)} × (1 − ${auditNum(row.refiningRate, 2)}%)`}
                result={`R ${auditNum(row.zarValueLessRefining, 2)}`}
                bold
                highlight
              />
            </div>
          ))}

          {tmRows.length > 1 && (
            <>
              <div className="border-t border-[var(--color-border)] mt-2 pt-2">
                <CalcRow
                  label="Total weight"
                  formula={tmRows.map((r) => auditNum(r.weightG, 2) + "g").join(" + ")}
                  result={`${auditNum(tmTotalWeightG, 2)} g (${auditNum(tmTotalWeightOz, 6)} oz)`}
                  bold
                />
                <CalcRow
                  label="Total USD value"
                  formula={tmRows.map((r) => "$" + auditNum(r.usdValue, 2)).join(" + ")}
                  result={`$${auditNum(tmTotalUsd, 2)}`}
                  bold
                />
                <CalcRow
                  label="Total ZAR (gross)"
                  result={`R ${auditNum(tmTotalZarGross, 2)}`}
                />
                <CalcRow
                  label="Total ZAR (net of refining)"
                  formula={tmRows.map((r) => "R " + auditNum(r.zarValueLessRefining, 2)).join(" + ")}
                  result={`R ${auditNum(tmTotalZarNet, 2)}`}
                  bold
                  highlight
                />
              </div>
            </>
          )}
        </AuditSection>

        {/* ── 3. StoneX Weighted Averages ── */}
        <AuditSection title="StoneX Weighted Averages" number={3}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Weighted average prices are calculated from StoneX/PMX trades.
            Each trade&apos;s notional (quantity × price) is summed, then
            divided by total quantity.
          </p>

          {/* Gold WA */}
          <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-3 mb-1">
            Gold Weighted Average ($/oz)
          </p>
          {goldDetails.map((t, i) => (
            <CalcRow
              key={`gold-${i}`}
              label={`${t.side} ${auditNum(t.quantity, 4)} oz @ $${auditNum(t.price, 2)}`}
              formula={`${auditNum(t.quantity, 4)} × $${auditNum(t.price, 2)}`}
              result={`$${auditNum(t.notional, 2)}`}
              indent={1}
            />
          ))}
          <CalcRow
            label="Sum of notional values"
            result={`$${auditNum(goldTotalVal, 2)}`}
          />
          <CalcRow
            label="Sum of quantities"
            result={`${auditNum(goldTotalQty, 4)} oz`}
          />
          <CalcRow
            label="Gold Weighted Average"
            formula={`$${auditNum(goldTotalVal, 2)} ÷ ${auditNum(goldTotalQty, 4)}`}
            result={`$${auditNum(summary.goldWaUsdOz, 2)} /oz`}
            bold
            highlight
          />

          {/* FX WA */}
          <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-4 mb-1">
            FX Weighted Average (ZAR/USD)
          </p>
          {fxDetails.map((t, i) => (
            <CalcRow
              key={`fx-${i}`}
              label={`${t.side} $${auditNum(t.quantity, 2)} @ R ${auditNum(t.price, 4)}`}
              formula={`$${auditNum(t.quantity, 2)} × R ${auditNum(t.price, 4)}`}
              result={`R ${auditNum(t.notional, 2)}`}
              indent={1}
            />
          ))}
          {fxTrades.length > 0 && (
            <>
              <CalcRow
                label="Sum of notional values"
                result={`R ${auditNum(fxTotalVal, 2)}`}
              />
              <CalcRow
                label="Sum of quantities"
                result={`$${auditNum(fxTotalQty, 2)}`}
              />
              <CalcRow
                label="FX Weighted Average"
                formula={`R ${auditNum(fxTotalVal, 2)} ÷ $${auditNum(fxTotalQty, 2)}`}
                result={`R ${auditNum(summary.fxWaUsdzar, 4)}`}
                bold
                highlight
              />
            </>
          )}
          {fxTrades.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] italic">
              No USDZAR trades — FX rate sourced from TradeMC bookings.
            </p>
          )}
        </AuditSection>

        {/* ── 4. Spot Rate Derivation ── */}
        <AuditSection title="Spot Rate Derivation" number={4}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            The spot rate (ZAR per gram) is derived from the weighted average
            gold price and FX rate, divided by the gram-to-ounce conversion
            factor.
          </p>
          <CalcRow
            label="Gold WA"
            result={`$${auditNum(summary.goldWaUsdOz, 2)} /oz`}
          />
          <CalcRow
            label="FX WA"
            result={`R ${auditNum(summary.fxWaUsdzar, 4)} per USD`}
          />
          <CalcRow
            label="Grams per troy ounce"
            result={`${GRAMS_PER_TROY_OUNCE}`}
          />
          <CalcRow
            label="Spot ZAR per gram"
            formula={`($${auditNum(summary.goldWaUsdOz, 2)} × R ${auditNum(summary.fxWaUsdzar, 4)}) ÷ ${GRAMS_PER_TROY_OUNCE}`}
            result={`R ${auditNum(summary.spotZarPerG, 2)} /g`}
            bold
            highlight
          />
        </AuditSection>

        {/* ── 5. StoneX USD Cash Flow ── */}
        <AuditSection title="StoneX USD Cash Flow (Sell Side)" number={5}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            The USD cash flow from StoneX gold trades. Selling gold generates
            USD inflow; buying gold generates USD outflow.
          </p>
          {goldTrades.map((t, i) => {
            const flow =
              t.side === "SELL"
                ? t.quantity * t.price
                : -(t.quantity * t.price);
            return (
              <CalcRow
                key={`usd-${i}`}
                label={`${t.side} ${auditNum(t.quantity, 4)} oz @ $${auditNum(t.price, 2)}`}
                formula={`${t.side === "SELL" ? "+" : "−"}(${auditNum(t.quantity, 4)} × $${auditNum(t.price, 2)})`}
                result={`${flow >= 0 ? "+" : "−"}$${auditNum(Math.abs(flow), 2)}`}
                indent={1}
              />
            );
          })}
          <CalcRow
            label="Net StoneX USD cash flow"
            result={`${stonexCashUsd >= 0 ? "+" : "−"}$${auditNum(Math.abs(stonexCashUsd), 2)}`}
          />
          <CalcRow
            label="Sell Side USD (absolute)"
            result={`$${auditNum(summary.sellSideUsd, 2)}`}
            bold
            highlight
          />
          <CalcRow
            label="Buy Side USD (TradeMC total)"
            result={`$${auditNum(summary.buySideUsd, 2)}`}
            bold
          />
          <CalcRow
            label="USD Profit"
            formula={`$${auditNum(summary.sellSideUsd, 2)} − $${auditNum(summary.buySideUsd, 2)}`}
            result={`$${auditNum(summary.profitUsd, 2)}`}
            bold
            highlight
          />
        </AuditSection>

        {/* ── 6. Control Account (Metal Exposure) ── */}
        <AuditSection title="Control Account (Metal Exposure)" number={6}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            The control account tracks unhedged metal exposure — metal bought
            from clients that hasn&apos;t been sold (or extra metal bought) on
            StoneX. Positive = long exposure, negative = short exposure.
          </p>
          <CalcRow
            label="TradeMC total weight (bought from clients)"
            result={`+${auditNum(tmTotalWeightG, 2)} g (+${auditNum(tmTotalWeightOz, 6)} oz)`}
          />
          <CalcRow
            label="StoneX net gold position (signed oz)"
            formula={goldTrades
              .map(
                (t) =>
                  `${t.side === "BUY" ? "+" : "−"}${auditNum(t.quantity, 4)}`
              )
              .join(" ")}
            result={`${goldSignedOz >= 0 ? "+" : ""}${auditNum(goldSignedOz, 4)} oz`}
          />
          <CalcRow
            label="StoneX net in grams"
            formula={`${auditNum(goldSignedOz, 4)} oz × ${GRAMS_PER_TROY_OUNCE}`}
            result={`${goldSignedOz * GRAMS_PER_TROY_OUNCE >= 0 ? "+" : ""}${auditNum(goldSignedOz * GRAMS_PER_TROY_OUNCE, 2)} g`}
          />
          <CalcRow
            label="Control Account (grams)"
            formula={`${auditNum(tmTotalWeightG, 2)} g + (${auditNum(goldSignedOz, 4)} oz × ${GRAMS_PER_TROY_OUNCE})`}
            result={`${auditNum(summary.controlAccountG, 2)} g`}
            bold
            highlight
          />
          <CalcRow
            label="Control Account (oz)"
            formula={`${auditNum(summary.controlAccountG, 2)} ÷ ${GRAMS_PER_TROY_OUNCE}`}
            result={`${auditNum(summary.controlAccountOz, 4)} oz`}
          />
          <CalcRow
            label="Control Account (ZAR)"
            formula={`${auditNum(summary.controlAccountG, 2)} g × R ${auditNum(summary.spotZarPerG, 2)}/g`}
            result={`R ${auditNum(summary.controlAccountZar, 2)}`}
            bold
          />
        </AuditSection>

        {/* ── 7. ZAR Position & Sell Side ── */}
        <AuditSection title="ZAR Position (Sell Side Valuation)" number={7}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            The ZAR sell side is computed as the StoneX ZAR flow (total traded
            weight valued at spot rate) plus the ZAR value of any remaining
            metal in the control account.
          </p>
          <CalcRow
            label="StoneX ZAR flow"
            formula={`${auditNum(tmTotalWeightG, 2)} g × R ${auditNum(summary.spotZarPerG, 2)}/g`}
            result={`R ${auditNum(summary.stonexZarFlow, 2)}`}
          />
          <CalcRow
            label="Control Account ZAR value"
            result={`R ${auditNum(summary.controlAccountZar, 2)}`}
          />
          <CalcRow
            label="Sell Side ZAR"
            formula={`R ${auditNum(summary.stonexZarFlow, 2)} + R ${auditNum(summary.controlAccountZar, 2)}`}
            result={`R ${auditNum(summary.sellSideZar, 2)}`}
            bold
            highlight
          />
          <CalcRow
            label="Buy Side ZAR (TradeMC net of refining)"
            result={`R ${auditNum(summary.buySideZar, 2)}`}
            bold
          />
        </AuditSection>

        {/* ── 8. Profit / Loss Calculation ── */}
        <AuditSection title="Profit / Loss Calculation" number={8}>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Profit is the difference between what we receive (sell side) and
            what we pay (buy side). Positive = profit, negative = loss.
          </p>

          <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-2 mb-1">
            USD Profit
          </p>
          <CalcRow
            label="Sell Side USD"
            result={`$${auditNum(summary.sellSideUsd, 2)}`}
          />
          <CalcRow
            label="Buy Side USD"
            result={`$${auditNum(summary.buySideUsd, 2)}`}
          />
          <CalcRow
            label="Profit (USD)"
            formula={`$${auditNum(summary.sellSideUsd, 2)} − $${auditNum(summary.buySideUsd, 2)}`}
            result={`$${auditNum(summary.profitUsd, 2)}`}
            bold
            highlight
          />

          <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-4 mb-1">
            ZAR Profit
          </p>
          <CalcRow
            label="Sell Side ZAR"
            result={`R ${auditNum(summary.sellSideZar, 2)}`}
          />
          <CalcRow
            label="Buy Side ZAR"
            result={`R ${auditNum(summary.buySideZar, 2)}`}
          />
          <CalcRow
            label="Profit (ZAR)"
            formula={`R ${auditNum(summary.sellSideZar, 2)} − R ${auditNum(summary.buySideZar, 2)}`}
            result={`R ${auditNum(summary.profitZar, 2)}`}
            bold
            highlight
          />

          <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-4 mb-1">
            Profit Margin
          </p>
          <CalcRow
            label="Profit margin on ZAR cost"
            formula={`(R ${auditNum(summary.profitZar, 2)} ÷ R ${auditNum(summary.buySideZar, 2)}) × 100`}
            result={`${auditNum(summary.profitPct, 2)}%`}
            bold
            highlight
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-2 italic">
            A positive margin means the sell-side proceeds exceed the
            buy-side cost (including refining), resulting in a profit. A
            negative margin indicates a loss.
          </p>
        </AuditSection>
      </div>
    </div>
  );
}

// ── Page Component ──

export default function TradingTicketPage() {
  const [tradeNum, setTradeNum] = useState("");
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch ticket data
  async function loadTicket() {
    const trimmed = tradeNum.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setTicket(null);

    try {
      const resp = await fetch(`/api/ticket/${encodeURIComponent(trimmed)}`);
      const data: TicketResponse = await resp.json();

      if (!resp.ok || !data.ok) {
        setError(data.error || "Failed to load ticket data");
        return;
      }

      setTicket(data.ticket ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      loadTicket();
    }
  }

  const summary = ticket?.summary;

  // ── TradeMC columns ──
  const tmColumns = useMemo<ColumnDef<TicketTmRow, any>[]>(
    () => [
      {
        accessorKey: "companyName",
        header: "Company",
        size: 200,
      },
      {
        accessorKey: "weightG",
        header: "Weight (g)",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "weightOz",
        header: "Weight (oz)",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "usdPerOzBooked",
        header: "$/oz Booked",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "fxRate",
        header: "FX Rate",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "usdValue",
        header: "USD Value",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "zarValue",
        header: "ZAR Value",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "refiningRate",
        header: "Refining %",
        size: 100,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
      {
        accessorKey: "zarValueLessRefining",
        header: "ZAR (Net)",
        size: 120,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 2),
      },
    ],
    []
  );

  // ── Base StoneX columns ──
  const baseStonexColumns = useMemo<ColumnDef<TicketStonexRow, any>[]>(
    () => [
      {
        accessorKey: "docNumber",
        header: "Doc #",
        size: 120,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "fncNumber",
        header: "FNC #",
        size: 120,
      },
      {
        accessorKey: "tradeDate",
        header: "Trade Date",
        size: 110,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "valueDate",
        header: "Value Date",
        size: 110,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 100,
      },
      {
        accessorKey: "side",
        header: "Side",
        size: 80,
        cell: ({ getValue }) => {
          const side = getValue() as string;
          const isBuy = side.toUpperCase() === "BUY";
          return (
            <span className={isBuy ? "num-positive font-medium" : "num-negative font-medium"}>
              {side}
            </span>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "price",
        header: "Price",
        size: 110,
        meta: { align: "right" },
        cell: ({ getValue }) => fmt(getValue() as number, 4),
      },
      {
        accessorKey: "narration",
        header: "Narration",
        size: 220,
      },
    ],
    []
  );

  // ── Metal columns (with USD Value) ──
  const metalColumns = useMemo<ColumnDef<TicketStonexRow, any>[]>(
    () => [
      ...baseStonexColumns.slice(0, 8), // Doc# through Price
      {
        id: "usdValue",
        header: "USD Value",
        size: 130,
        meta: { align: "right" },
        accessorFn: (row: TicketStonexRow) => row.quantity * row.price,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">
            {fmt(getValue() as number, 2)}
          </span>
        ),
      },
      baseStonexColumns[8], // Narration
    ],
    [baseStonexColumns]
  );

  // ── Currency columns (with ZAR Value) ──
  const currencyColumns = useMemo<ColumnDef<TicketStonexRow, any>[]>(
    () => [
      ...baseStonexColumns.slice(0, 8), // Doc# through Price
      {
        id: "zarValue",
        header: "ZAR Value",
        size: 130,
        meta: { align: "right" },
        accessorFn: (row: TicketStonexRow) => row.quantity * row.price,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">
            {fmt(getValue() as number, 2)}
          </span>
        ),
      },
      baseStonexColumns[8], // Narration
    ],
    [baseStonexColumns]
  );

  // ── TradeMC totals row ──
  const tmTotals = useMemo(() => {
    if (!ticket?.tmRows.length) return null;
    const rows = ticket.tmRows;
    const totalWeightG = rows.reduce((s, r) => s + r.weightG, 0);
    const totalWeightOz = rows.reduce((s, r) => s + r.weightOz, 0);
    const totalUsd = rows.reduce((s, r) => s + r.usdValue, 0);
    const totalZarNet = rows.reduce((s, r) => s + r.zarValueLessRefining, 0);
    // Weighted avg $/oz: total USD / total oz
    const waUsdPerOz = totalWeightOz > 0 ? totalUsd / totalWeightOz : 0;
    // Weighted avg FX: total ZAR value / total USD value
    const totalZarGross = rows.reduce((s, r) => s + r.zarValue, 0);
    const waFx = totalUsd > 0 ? totalZarGross / totalUsd : 0;
    return { totalWeightG, totalWeightOz, waUsdPerOz, waFx, totalUsd, totalZarNet };
  }, [ticket?.tmRows]);

  // ── Metal / Currency split helpers ──
  const METAL_PREFIXES = ["XAU", "XAG", "XPT", "XPD"];
  const isMetalSymbol = (sym: string) =>
    METAL_PREFIXES.some((p) => sym.toUpperCase().startsWith(p));

  const metalRows = useMemo(
    () => (ticket?.stonexRows ?? []).filter((r) => isMetalSymbol(r.symbol)),
    [ticket?.stonexRows]
  );
  const currencyRows = useMemo(
    () => (ticket?.stonexRows ?? []).filter((r) => !isMetalSymbol(r.symbol)),
    [ticket?.stonexRows]
  );

  // ── Metal totals (SELL adds, BUY subtracts) ──
  const metalTotals = useMemo(() => {
    if (metalRows.length === 0) return null;
    let totalQty = 0;
    let totalUsdValue = 0;
    for (const r of metalRows) {
      const sign = r.side === "BUY" ? -1 : 1;
      totalQty += sign * r.quantity;
      totalUsdValue += sign * r.quantity * r.price;
    }
    return {
      totalQty,
      waPrice: totalQty !== 0 ? totalUsdValue / totalQty : 0,
      totalUsdValue,
    };
  }, [metalRows]);

  // ── Currency totals (SELL adds, BUY subtracts) ──
  const currencyTotals = useMemo(() => {
    if (currencyRows.length === 0) return null;
    let totalQty = 0;
    let totalZarValue = 0;
    for (const r of currencyRows) {
      const sign = r.side === "BUY" ? -1 : 1;
      totalQty += sign * r.quantity;
      totalZarValue += sign * r.quantity * r.price;
    }
    return {
      totalQty,
      waPrice: totalQty !== 0 ? totalZarValue / totalQty : 0,
      totalZarValue,
    };
  }, [currencyRows]);

  return (
    <PageShell
      title="Trading Ticket"
      description="Generate trading tickets with weighted average pricing."
    >
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="Enter trade number..."
            value={tradeNum}
            onChange={(e) => setTradeNum(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
        <button
          onClick={loadTicket}
          disabled={loading || !tradeNum.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <FileText size={16} />
          )}
          Load Ticket
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Summary stat cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Gold WA"
            value={`$${fmt(summary.goldWaUsdOz, 2)} /oz`}
          />
          <StatCard
            label="FX WA"
            value={`R ${fmt(summary.fxWaUsdzar, 4)}`}
          />
          <StatCard
            label="Spot Rate"
            value={`R ${fmt(summary.spotZarPerG, 2)} /g`}
          />
          <StatCard
            label="Profit"
            value={`R ${fmt(summary.profitZar, 2)}`}
            sub={`(${fmt(summary.profitPct, 1)}%)`}
            className={summary.profitZar >= 0 ? "text-green-600" : "text-red-600"}
          />
        </div>
      )}

      {/* TradeMC Bookings section */}
      {ticket && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            TradeMC Bookings
          </h2>
          <DataTable
            columns={tmColumns}
            data={ticket.tmRows}
            loading={false}
            compact
            paginate={false}
            emptyMessage="No TradeMC bookings found for this trade."
            footer={
              tmTotals ? (
                <tr>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                    Totals
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalWeightG, 2)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalWeightOz, 4)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.waUsdPerOz, 2)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.waFx, 4)}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalUsd, 2)}
                  </td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                    {fmt(tmTotals.totalZarNet, 2)}
                  </td>
                </tr>
              ) : undefined
            }
          />
        </div>
      )}

      {/* StoneX / PMX Trades section */}
      {ticket && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            StoneX / PMX Trades
          </h2>

          {/* Metal Trades */}
          {metalRows.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Metal Trades
              </h3>
              <DataTable
                columns={metalColumns}
                data={metalRows}
                loading={false}
                compact
                paginate={false}
                emptyMessage="No metal trades."
                footer={
                  metalTotals ? (
                    <tr>
                      <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                        Totals
                      </td>
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                        {fmt(metalTotals.totalQty, 4)}
                      </td>
                      <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                        {fmt(metalTotals.waPrice, 4)}
                      </td>
                      <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                        {fmt(metalTotals.totalUsdValue, 2)}
                      </td>
                      <td className="px-2 py-1.5" />
                    </tr>
                  ) : undefined
                }
              />
            </div>
          )}

          {/* Currency Trades */}
          {currencyRows.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Currency Trades
              </h3>
              <DataTable
                columns={currencyColumns}
                data={currencyRows}
                loading={false}
                compact
                paginate={false}
                emptyMessage="No currency trades."
                footer={
                  currencyTotals ? (
                    <tr>
                      <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                        Totals
                      </td>
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                        {fmt(currencyTotals.totalQty, 4)}
                      </td>
                      <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap text-right tabular-nums">
                        {fmt(currencyTotals.waPrice, 4)}
                      </td>
                      <td className="px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap text-right tabular-nums">
                        {fmt(currencyTotals.totalZarValue, 2)}
                      </td>
                      <td className="px-2 py-1.5" />
                    </tr>
                  ) : undefined
                }
              />
            </div>
          )}

          {/* Fallback if no trades at all */}
          {metalRows.length === 0 && currencyRows.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] italic">
              No StoneX/PMX trades found for this trade.
            </p>
          )}
        </div>
      )}

      {/* Profit Summary section */}
      {summary && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Profit Summary
          </h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* USD column */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                  USD Position
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-[var(--color-background)] px-3 py-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Sell Side (StoneX)</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      ${fmt(summary.sellSideUsd, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[var(--color-background)] px-3 py-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Buy Side (TradeMC)</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      ${fmt(summary.buySideUsd, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">Profit (USD)</span>
                    <span className={`text-sm font-semibold ${summary.profitUsd >= 0 ? "num-positive" : "num-negative"}`}>
                      ${fmt(summary.profitUsd, 2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ZAR column */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                  ZAR Position
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-[var(--color-background)] px-3 py-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Sell Side (StoneX)</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      R {fmt(summary.sellSideZar, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[var(--color-background)] px-3 py-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Buy Side (TradeMC)</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      R {fmt(summary.buySideZar, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">Profit (ZAR)</span>
                    <span className={`text-sm font-semibold ${summary.profitZar >= 0 ? "num-positive" : "num-negative"}`}>
                      R {fmt(summary.profitZar, 2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-[var(--color-border)]" />

            {/* Bottom metrics row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Control Account */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Control Account
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {fmt(summary.controlAccountG, 2)} g
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {fmt(summary.controlAccountOz, 4)} oz
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  R {fmt(summary.controlAccountZar, 2)}
                </p>
              </div>

              {/* Total Traded */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Total Traded
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {fmt(summary.totalTradedG, 2)} g
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {fmt(summary.totalTradedOz, 4)} oz
                </p>
              </div>

              {/* StoneX ZAR Flow */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  StoneX ZAR Flow
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  R {fmt(summary.stonexZarFlow, 2)}
                </p>
              </div>

              {/* Profit % */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Profit Margin
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold ${
                    summary.profitPct >= 0
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {fmt(summary.profitPct, 1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail section */}
      {ticket && <AuditTrail ticket={ticket} />}
    </PageShell>
  );
}
