import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  fetchAllDealReport,
  mapRowToTrade,
  formatPmxDate,
  type PmxConfig,
} from "@foundation/integrations";
import { buildLedger, computeLedgerSummary } from "@foundation/domain";

function getPmxConfig(): PmxConfig {
  return {
    pmxHost: process.env.PMX_API_HOST || "pmxapi.stonex.com",
    pmxLoginUsername: process.env.PMX_LOGIN_USERNAME || "",
    pmxLoginPassword: process.env.PMX_LOGIN_PASSWORD || "",
    pmxLoginLocation: process.env.PMX_LOGIN_LOCATION || "LD",
    pmxPlatform: process.env.PMX_PLATFORM || "Desktop",
    pmxAccOptKey: process.env.PMX_ACC_OPT_KEY || "MT0601",
    pmxCreatedBy: process.env.PMX_CREATED_BY || "2",
    stonexHost: process.env.STONEX_HOST || "api.stonex.com",
    stonexSubscriptionKey: process.env.STONEX_SUBSCRIPTION_KEY || "",
    stonexUsername: process.env.STONEX_USERNAME || "",
    stonexPassword: process.env.STONEX_PASSWORD || "",
  };
}

const FISCAL_START = process.env.FISCAL_TRADES_START_DATE || "2026-03-01";

interface AuditCheck {
  label: string;
  localValue: string;
  pmxValue: string;
  pass: boolean;
}

/**
 * GET /api/pmx/audit
 *
 * Fetches fresh trade data from the PMX API, computes balances,
 * and compares against our local database. Returns pass/fail per check.
 */
export async function GET() {
  try {
    const config = getPmxConfig();
    const now = new Date();
    const fiscalFloor = new Date(FISCAL_START);

    // ── 1. Fetch from PMX API ──
    const pmxResult = await fetchAllDealReport(config, {
      startDate: formatPmxDate(fiscalFloor),
      endDate: formatPmxDate(now),
      cmdty: "All",
      trdOpt: "All",
    });

    if (!pmxResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: pmxResult.error || "PMX API fetch failed",
        },
        { status: 502 },
      );
    }

    // Map PMX rows to trades (same logic as sync)
    const pmxTrades = pmxResult.rows
      .map((row, i) => mapRowToTrade(row, i + 1))
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .filter((t) => t.tradeDate >= FISCAL_START);

    // Build ledger from PMX trades to get summary
    const pmxLedger = buildLedger(
      pmxTrades.map((t, i) => ({
        id: i + 1,
        docNumber: t.docNumber,
        tradeDate: t.tradeDate,
        valueDate: t.valueDate,
        symbol: t.symbol,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        narration: t.narration,
        orderId: t.orderId,
        fncNumber: t.fncNumber,
        traderName: t.traderName,
        settleCurrency: t.settleCurrency,
        settleAmount: t.settleAmount,
      })),
    );
    const pmxSummary = computeLedgerSummary(pmxLedger);

    // ── 2. Get local DB data ──
    const localResult = await (db as any).execute(sql`
      SELECT
        id, doc_number, trade_date, value_date, symbol, side,
        quantity::float8 as quantity, price::float8 as price,
        narration, order_id, fnc_number, trader_name,
        settle_currency, settle_amount::float8 as settle_amount
      FROM pmx_trades
      ORDER BY trade_date ASC, id ASC
    `);

    const localTrades = (localResult as any[]).map((row: any) => ({
      id: row.id,
      docNumber: row.doc_number || "",
      tradeDate: row.trade_date ? new Date(row.trade_date).toISOString().slice(0, 10) : "",
      valueDate: row.value_date ? new Date(row.value_date).toISOString().slice(0, 10) : "",
      symbol: row.symbol || "",
      side: row.side || "",
      quantity: parseFloat(row.quantity) || 0,
      price: parseFloat(row.price) || 0,
      narration: row.narration || "",
      orderId: row.order_id || "",
      fncNumber: row.fnc_number || "",
      traderName: row.trader_name || "",
      settleCurrency: row.settle_currency || "",
      settleAmount: parseFloat(row.settle_amount) || 0,
    }));

    const localLedger = buildLedger(localTrades);
    const localSummary = computeLedgerSummary(localLedger);

    // Get latest local trade date
    const latestResult = await (db as any).execute(
      sql`SELECT MAX(trade_date) as max_date FROM pmx_trades`,
    );
    const latestTradeDate = (latestResult as any[])?.[0]?.max_date
      ? new Date((latestResult as any[])[0].max_date).toISOString().slice(0, 10)
      : null;
    const todayStr = now.toISOString().slice(0, 10);

    // ── 3. Compare ──
    const tolerance = 0.01; // rounding tolerance
    const metalTolerance = 0.001;

    function numMatch(a: number, b: number, tol = tolerance): boolean {
      return Math.abs(a - b) <= tol;
    }

    function fmtNum(n: number, decimals = 2): string {
      return n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    function fmtOz(n: number): string {
      return n.toLocaleString("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
    }

    const localNetUsd = localSummary.totalCreditUsd - localSummary.totalDebitUsd;
    const pmxNetUsd = pmxSummary.totalCreditUsd - pmxSummary.totalDebitUsd;
    const localNetZar = localSummary.totalCreditZar - localSummary.totalDebitZar;
    const pmxNetZar = pmxSummary.totalCreditZar - pmxSummary.totalDebitZar;
    const localNetXau = localSummary.totalCreditXau - localSummary.totalDebitXau;
    const pmxNetXau = pmxSummary.totalCreditXau - pmxSummary.totalDebitXau;
    const localNetXag = localSummary.totalCreditXag - localSummary.totalDebitXag;
    const pmxNetXag = pmxSummary.totalCreditXag - pmxSummary.totalDebitXag;
    const localNetXpt = localSummary.totalCreditXpt - localSummary.totalDebitXpt;
    const pmxNetXpt = pmxSummary.totalCreditXpt - pmxSummary.totalDebitXpt;
    const localNetXpd = localSummary.totalCreditXpd - localSummary.totalDebitXpd;
    const pmxNetXpd = pmxSummary.totalCreditXpd - pmxSummary.totalDebitXpd;

    const checks: AuditCheck[] = [
      {
        label: "DB Records",
        localValue: String(localTrades.length),
        pmxValue: String(pmxTrades.length),
        pass: localTrades.length === pmxTrades.length,
      },
      {
        label: "Last Updated",
        localValue: latestTradeDate || "N/A",
        pmxValue: todayStr,
        pass: latestTradeDate === todayStr,
      },
      {
        label: "Net USD",
        localValue: fmtNum(localNetUsd),
        pmxValue: fmtNum(pmxNetUsd),
        pass: numMatch(localNetUsd, pmxNetUsd),
      },
      {
        label: "Net ZAR",
        localValue: fmtNum(localNetZar),
        pmxValue: fmtNum(pmxNetZar),
        pass: numMatch(localNetZar, pmxNetZar),
      },
      {
        label: "Net Gold",
        localValue: fmtOz(localNetXau),
        pmxValue: fmtOz(pmxNetXau),
        pass: numMatch(localNetXau, pmxNetXau, metalTolerance),
      },
      {
        label: "Net Silver",
        localValue: fmtOz(localNetXag),
        pmxValue: fmtOz(pmxNetXag),
        pass: numMatch(localNetXag, pmxNetXag, metalTolerance),
      },
      {
        label: "Net Platinum",
        localValue: fmtOz(localNetXpt),
        pmxValue: fmtOz(pmxNetXpt),
        pass: numMatch(localNetXpt, pmxNetXpt, metalTolerance),
      },
      {
        label: "Net Palladium",
        localValue: fmtOz(localNetXpd),
        pmxValue: fmtOz(pmxNetXpd),
        pass: numMatch(localNetXpd, pmxNetXpd, metalTolerance),
      },
    ];

    const allPass = checks.every((c) => c.pass);

    return NextResponse.json({
      ok: true,
      allPass,
      checks,
      pmxTradeCount: pmxTrades.length,
      localTradeCount: localTrades.length,
      auditedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("PMX audit error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Audit failed",
      },
      { status: 500 },
    );
  }
}
