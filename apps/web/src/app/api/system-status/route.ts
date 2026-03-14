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
const TRADEMC_FRESHNESS_HOURS = parseInt(
  process.env.TRADEMC_FRESHNESS_HOURS || "2",
);

/**
 * GET /api/system-status
 *
 * Combined status check:
 *  1. PMX Audit — fetches from PMX API and compares against local DB
 *  2. TradeMC Freshness — checks the latest synced_at timestamp
 *
 * Returns an overall "live" or "offline" verdict.
 */
export async function GET() {
  const now = new Date();

  // Run PMX audit and TradeMC freshness in parallel
  const [pmxResult, tmcResult] = await Promise.allSettled([
    runPmxAudit(now),
    checkTradeMcFreshness(now),
  ]);

  // PMX status
  const pmx =
    pmxResult.status === "fulfilled"
      ? pmxResult.value
      : {
          ok: false,
          allPass: false,
          error:
            pmxResult.reason instanceof Error
              ? pmxResult.reason.message
              : "PMX audit failed",
          checks: [] as { label: string; pass: boolean }[],
        };

  // TradeMC status
  const tmc =
    tmcResult.status === "fulfilled"
      ? tmcResult.value
      : {
          ok: false,
          fresh: false,
          error:
            tmcResult.reason instanceof Error
              ? tmcResult.reason.message
              : "TradeMC check failed",
          lastSyncedAt: null as string | null,
          minutesAgo: null as number | null,
          tradeCount: 0,
        };

  const isLive = pmx.ok && pmx.allPass && tmc.ok && tmc.fresh;

  return NextResponse.json({
    ok: true,
    isLive,
    checkedAt: now.toISOString(),
    pmx: {
      ok: pmx.ok,
      allPass: pmx.allPass,
      error: pmx.error || null,
      checks: pmx.checks || [],
    },
    tmc: {
      ok: tmc.ok,
      fresh: tmc.fresh,
      error: tmc.error || null,
      lastSyncedAt: tmc.lastSyncedAt,
      minutesAgo: tmc.minutesAgo,
      tradeCount: tmc.tradeCount,
      thresholdHours: TRADEMC_FRESHNESS_HOURS,
    },
  });
}

// ── PMX Audit Logic ──

async function runPmxAudit(now: Date) {
  const config = getPmxConfig();
  const fiscalFloor = new Date(FISCAL_START);

  // Fetch from PMX API
  const pmxApiResult = await fetchAllDealReport(config, {
    startDate: formatPmxDate(fiscalFloor),
    endDate: formatPmxDate(now),
    cmdty: "All",
    trdOpt: "All",
  });

  if (!pmxApiResult.ok) {
    return {
      ok: false,
      allPass: false,
      error: pmxApiResult.error || "PMX API fetch failed",
      checks: [] as { label: string; pass: boolean }[],
    };
  }

  // Map PMX rows to trades
  const pmxTrades = pmxApiResult.rows
    .map((row, i) => mapRowToTrade(row, i + 1))
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .filter((t) => t.tradeDate >= FISCAL_START);

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

  // Get local DB data
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
    tradeDate: row.trade_date
      ? new Date(row.trade_date).toISOString().slice(0, 10)
      : "",
    valueDate: row.value_date
      ? new Date(row.value_date).toISOString().slice(0, 10)
      : "",
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

  // Compare
  const tolerance = 0.01;
  const metalTolerance = 0.001;

  function numMatch(a: number, b: number, tol = tolerance): boolean {
    return Math.abs(a - b) <= tol;
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

  const checks = [
    {
      label: "DB Records",
      pass: localTrades.length === pmxTrades.length,
    },
    {
      label: "Net USD",
      pass: numMatch(localNetUsd, pmxNetUsd),
    },
    {
      label: "Net ZAR",
      pass: numMatch(localNetZar, pmxNetZar),
    },
    {
      label: "Net Gold",
      pass: numMatch(localNetXau, pmxNetXau, metalTolerance),
    },
    {
      label: "Net Silver",
      pass: numMatch(localNetXag, pmxNetXag, metalTolerance),
    },
    {
      label: "Net Platinum",
      pass: numMatch(localNetXpt, pmxNetXpt, metalTolerance),
    },
    {
      label: "Net Palladium",
      pass: numMatch(localNetXpd, pmxNetXpd, metalTolerance),
    },
  ];

  const allPass = checks.every((c) => c.pass);

  return { ok: true, allPass, checks, error: undefined };
}

// ── TradeMC Freshness Check ──

async function checkTradeMcFreshness(now: Date) {
  const result = await (db as any).execute(sql`
    SELECT
      MAX(synced_at) AS last_synced,
      COUNT(*)::int  AS trade_count
    FROM trademc_trades
  `);

  const row = (result as any[])[0] || {};
  const lastSyncedAt = row.last_synced
    ? new Date(row.last_synced).toISOString()
    : null;
  const tradeCount = parseInt(row.trade_count) || 0;

  let minutesAgo: number | null = null;
  let fresh = false;

  if (lastSyncedAt) {
    const diff = now.getTime() - new Date(lastSyncedAt).getTime();
    minutesAgo = Math.round(diff / 60_000);
    fresh = diff < TRADEMC_FRESHNESS_HOURS * 60 * 60 * 1000;
  }

  return {
    ok: true,
    fresh,
    lastSyncedAt,
    minutesAgo,
    tradeCount,
    error: undefined,
  };
}
