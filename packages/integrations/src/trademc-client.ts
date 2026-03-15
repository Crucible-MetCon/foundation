/**
 * TradeMC / Directus API Client
 *
 * Syncs companies, trades, and weight transactions from the TradeMC
 * Directus CMS instance at trademc-admin.metcon.co.za.
 *
 * Auth: Bearer token (API key) in Authorization header.
 */

export interface TradeMcConfig {
  baseUrl: string;   // e.g. "https://trademc-admin.metcon.co.za"
  apiKey: string;     // Bearer token
}

// ── Raw API types ──

export interface TradeMcCompany {
  id: number;
  status: string | null;
  company_name: string;
  registration_number: string | null;
  contact_number: string | null;
  email_address: string | null;
  trade_limit: number | null;
  blocked: boolean;
  vat_number: string | null;
  EVO_customer_code: string | null;
  refining_rate: number | null;
  date_created: string | null;
  date_updated: string | null;
}

export interface TradeMcTrade {
  id: number;
  status: string | null;
  company_id: number | null;
  weight: number | null;
  notes: string | null;
  ref_number: string | null;
  trade_timestamp: string | null;
  zar_per_troy_ounce: number | null;
  zar_to_usd: number | null;
  requested_zar_per_gram: number | null;
  zar_per_troy_ounce_confirmed: number | null;
  zar_to_usd_confirmed: number | null;
  usd_per_troy_ounce_confirmed: number | null;
  date_created: string | null;
  date_updated: string | null;
  evo_exported: boolean;
}

export interface TradeMcWeightTransaction {
  id: number;
  company_id: number | null;
  trade_id: number | null;
  type: string;
  weight: number | null;
  rolling_balance: number | null;
  gold_percentage: number | null;
  notes: string | null;
  pc_code: string | null;
  transaction_timestamp: string | null;
  date_created: string | null;
  date_updated: string | null;
}

export interface TradeMcHistoricPrice {
  id: number;
  timestamp: string | null;
  usd_per_troy_ounce: number | null;
  usd_per_troy_ounce_ask: number | null;
  zar_to_usd: number | null;
  zar_to_usd_ask: number | null;
  zar_per_troy_ounce: number | null;
}

export interface TradeMcSyncResult {
  ok: boolean;
  error?: string;
  fetched: number;
  inserted: number;
  updated: number;
}

export interface TradeMcLivePrices {
  ok: boolean;
  timestamp: string | null;
  usdZar: number;
  xauUsd: number;
  usdZarSource: string;
  xauUsdSource: string;
  error?: string;
}

// ── Helpers ──

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Cache-Control": "no-cache",
  };
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries = 3,
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const retryStatuses = new Set([408, 429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });

      let data: unknown = {};
      try {
        data = await resp.json();
      } catch {
        data = {};
      }

      if (resp.ok) {
        return { ok: true, status: resp.status, data };
      }

      if (retryStatuses.has(resp.status) && attempt < maxRetries) {
        const delay = Math.min(750 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return {
        ok: false,
        status: resp.status,
        data,
        error: `HTTP ${resp.status}: ${resp.statusText}`,
      };
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = Math.min(750 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return {
        ok: false,
        status: 0,
        data: {},
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { ok: false, status: 0, data: {}, error: "Max retries exceeded" };
}

function extractItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

// ── Companies ──

export async function fetchCompanies(
  config: TradeMcConfig,
): Promise<{ ok: boolean; companies: TradeMcCompany[]; error?: string }> {
  const url = `${config.baseUrl}/items/company?limit=-1&sort=company_name`;
  const result = await fetchWithRetry(url, buildHeaders(config.apiKey));
  if (!result.ok) {
    return { ok: false, companies: [], error: result.error };
  }
  return { ok: true, companies: extractItems<TradeMcCompany>(result.data) };
}

// ── Trades ──

export async function fetchTrades(
  config: TradeMcConfig,
  opts?: {
    afterId?: number;
    updatedAfter?: string;
    limit?: number;
  },
): Promise<{ ok: boolean; trades: TradeMcTrade[]; error?: string }> {
  const limit = opts?.limit ?? 500;
  const params = new URLSearchParams({
    limit: String(limit),
    sort: "id",
    "meta": "total_count",
  });

  if (opts?.afterId) {
    params.set("filter[id][_gt]", String(opts.afterId));
  }
  if (opts?.updatedAfter) {
    params.set("filter[date_updated][_gte]", opts.updatedAfter);
  }

  // Add cache-buster
  params.set("_cb", String(Date.now()));

  const url = `${config.baseUrl}/items/trade?${params}`;
  const result = await fetchWithRetry(url, buildHeaders(config.apiKey));
  if (!result.ok) {
    return { ok: false, trades: [], error: result.error };
  }
  return { ok: true, trades: extractItems<TradeMcTrade>(result.data) };
}

/**
 * Fetch ALL trades using keyset pagination (ID-based).
 */
export async function fetchAllTrades(
  config: TradeMcConfig,
  opts?: { maxRecords?: number; updatedAfter?: string },
): Promise<{ ok: boolean; trades: TradeMcTrade[]; error?: string }> {
  const maxRecords = opts?.maxRecords ?? 200_000;
  const pageSize = 500;
  const all: TradeMcTrade[] = [];
  let lastId = 0;

  while (all.length < maxRecords) {
    const result = await fetchTrades(config, {
      afterId: lastId > 0 ? lastId : undefined,
      updatedAfter: opts?.updatedAfter,
      limit: pageSize,
    });

    if (!result.ok) {
      return { ok: false, trades: all, error: result.error };
    }

    if (result.trades.length === 0) break;
    all.push(...result.trades);
    lastId = result.trades[result.trades.length - 1].id;

    if (result.trades.length < pageSize) break;
  }

  return { ok: true, trades: all };
}

// ── Weight Transactions ──

export async function fetchWeightTransactions(
  config: TradeMcConfig,
  opts?: {
    afterId?: number;
    limit?: number;
  },
): Promise<{ ok: boolean; transactions: TradeMcWeightTransaction[]; error?: string }> {
  const limit = opts?.limit ?? 500;
  const params = new URLSearchParams({
    limit: String(limit),
    sort: "id",
  });

  if (opts?.afterId) {
    params.set("filter[id][_gt]", String(opts.afterId));
  }
  params.set("_cb", String(Date.now()));

  const url = `${config.baseUrl}/items/weight_transaction_ledger?${params}`;
  const result = await fetchWithRetry(url, buildHeaders(config.apiKey));
  if (!result.ok) {
    return { ok: false, transactions: [], error: result.error };
  }
  return { ok: true, transactions: extractItems<TradeMcWeightTransaction>(result.data) };
}

/**
 * Fetch ALL weight transactions using keyset pagination.
 */
export async function fetchAllWeightTransactions(
  config: TradeMcConfig,
  maxRecords = 200_000,
): Promise<{ ok: boolean; transactions: TradeMcWeightTransaction[]; error?: string }> {
  const pageSize = 500;
  const all: TradeMcWeightTransaction[] = [];
  let lastId = 0;

  while (all.length < maxRecords) {
    const result = await fetchWeightTransactions(config, {
      afterId: lastId > 0 ? lastId : undefined,
      limit: pageSize,
    });

    if (!result.ok) {
      return { ok: false, transactions: all, error: result.error };
    }

    if (result.transactions.length === 0) break;
    all.push(...result.transactions);
    lastId = result.transactions[result.transactions.length - 1].id;

    if (result.transactions.length < pageSize) break;
  }

  return { ok: true, transactions: all };
}

// ── Live Prices ──

let priceCache: {
  prices: TradeMcLivePrices;
  fetchedAt: number;
} | null = null;

const PRICE_CACHE_TTL = 15_000; // 15 seconds

export async function fetchLivePrices(
  config: TradeMcConfig,
  forceRefresh = false,
): Promise<TradeMcLivePrices> {
  // Check cache
  if (!forceRefresh && priceCache && Date.now() - priceCache.fetchedAt < PRICE_CACHE_TTL) {
    return priceCache.prices;
  }

  const params = new URLSearchParams({
    limit: "200",
    sort: "-timestamp,-id",
  });

  const url = `${config.baseUrl}/items/historic_data?${params}`;
  const result = await fetchWithRetry(url, buildHeaders(config.apiKey));

  if (!result.ok) {
    // Return stale cache if available
    if (priceCache) return priceCache.prices;
    return {
      ok: false,
      timestamp: null,
      usdZar: 0,
      xauUsd: 0,
      usdZarSource: "",
      xauUsdSource: "",
      error: result.error,
    };
  }

  const items = extractItems<TradeMcHistoricPrice>(result.data);
  if (!items.length) {
    return {
      ok: false,
      timestamp: null,
      usdZar: 0,
      xauUsd: 0,
      usdZarSource: "",
      xauUsdSource: "",
      error: "No historic data found",
    };
  }

  // Find latest valid prices
  let usdZar = 0;
  let xauUsd = 0;
  let usdZarSource = "";
  let xauUsdSource = "";
  let timestamp: string | null = null;

  for (const item of items) {
    if (!timestamp && item.timestamp) timestamp = item.timestamp;

    // USD/ZAR
    if (usdZar === 0) {
      if (item.zar_to_usd && item.zar_to_usd > 0) {
        usdZar = item.zar_to_usd;
        usdZarSource = "zar_to_usd";
      } else if (item.zar_to_usd_ask && item.zar_to_usd_ask > 0) {
        usdZar = item.zar_to_usd_ask;
        usdZarSource = "zar_to_usd_ask";
      } else if (
        item.zar_per_troy_ounce &&
        item.usd_per_troy_ounce &&
        item.usd_per_troy_ounce > 0
      ) {
        usdZar = item.zar_per_troy_ounce / item.usd_per_troy_ounce;
        usdZarSource = "derived";
      }
    }

    // XAU/USD
    if (xauUsd === 0) {
      if (item.usd_per_troy_ounce && item.usd_per_troy_ounce > 0) {
        xauUsd = item.usd_per_troy_ounce;
        xauUsdSource = "usd_per_troy_ounce";
      } else if (item.usd_per_troy_ounce_ask && item.usd_per_troy_ounce_ask > 0) {
        xauUsd = item.usd_per_troy_ounce_ask;
        xauUsdSource = "usd_per_troy_ounce_ask";
      } else if (
        item.zar_per_troy_ounce &&
        item.zar_to_usd &&
        item.zar_to_usd > 0
      ) {
        xauUsd = item.zar_per_troy_ounce / item.zar_to_usd;
        xauUsdSource = "derived";
      }
    }

    if (usdZar > 0 && xauUsd > 0) break;
  }

  const prices: TradeMcLivePrices = {
    ok: true,
    timestamp,
    usdZar,
    xauUsd,
    usdZarSource,
    xauUsdSource,
  };

  priceCache = { prices, fetchedAt: Date.now() };
  return prices;
}

// ── Update Trade Ref Number ──

export async function updateTradeRefNumber(
  config: TradeMcConfig,
  tradeId: number,
  refNumber: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${config.baseUrl}/items/trade/${tradeId}`;
  try {
    const resp = await fetch(url, {
      method: "PATCH",
      headers: buildHeaders(config.apiKey),
      body: JSON.stringify({ ref_number: refNumber }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}: ${resp.statusText}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
