/**
 * PMX/StoneX API Client
 *
 * Handles authentication and trade data fetching from PMX (pmxapi.stonex.com).
 * Two auth flows:
 *   1. StoneX OAuth (subscription key + bearer token)
 *   2. PMX session login (x-auth token + SID)
 */

export interface PmxConfig {
  pmxHost: string;
  pmxLoginUsername: string;
  pmxLoginPassword: string;
  pmxLoginLocation?: string;
  pmxPlatform?: string;
  pmxAccOptKey?: string;
  pmxCreatedBy?: string;
  stonexHost?: string;
  stonexSubscriptionKey?: string;
  stonexUsername?: string;
  stonexPassword?: string;
}

export interface PmxSession {
  xAuth: string;
  sid: string;
  username: string;
  platform: string;
  location: string;
  cacheControl: string;
  contentType: string;
  expiresAt?: number;
}

export interface PmxLoginResult {
  ok: boolean;
  error?: string;
  session?: PmxSession;
}

export interface PmxFetchResult {
  ok: boolean;
  status?: number;
  error?: string;
  rows: PmxRawRow[];
  startDate: string;
  endDate: string;
  sessionRefreshed: boolean;
}

export interface PmxRawRow {
  [key: string]: unknown;
}

export interface PmxMappedTrade {
  tradeDate: string;
  valueDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  narration: string;
  settleCurrency: string;
  settleAmount: number;
  docNumber: string;
  orderId: string;
  clordId: string;
  fncNumber: string;
  restTradeId: string;
  traderName: string;
  sourceSystem: string;
  rawPayload: string;
}

// ── Session cache ──
let cachedSession: PmxSession | null = null;

function storeSession(session: PmxSession) {
  cachedSession = { ...session, expiresAt: Date.now() + 30 * 60 * 1000 };
}

function getCachedSession(): PmxSession | null {
  if (!cachedSession) return null;
  if (cachedSession.expiresAt && Date.now() > cachedSession.expiresAt) {
    cachedSession = null;
    return null;
  }
  return cachedSession;
}

// ── Helpers ──
function firstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s.toLowerCase() !== "nan") return s;
  }
  return "";
}

function toFloat(value: unknown): number {
  if (value == null) return 0;
  const s = String(value).trim().replace(/,/g, "");
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalizeTradeNumber(value: unknown): string {
  if (value == null) return "";
  let s = String(value).trim().toUpperCase();
  if (s.endsWith(".0") && /^\d+\.0$/.test(s)) s = s.slice(0, -2);
  return s;
}

const MONTH_ABBR: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseDate(value: unknown, defaultValue = ""): string {
  const text = String(value ?? "").trim();
  if (!text) return defaultValue;

  // Try ISO format YYYY-MM-DD
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // Try DD-MM-YYYY or DD/MM/YYYY (numeric month)
  const dmyMatch = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

  // Try DD-Mon-YYYY (e.g. "05-Mar-2026") — PMX API format
  const monMatch = text.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})/);
  if (monMatch) {
    const mm = MONTH_ABBR[monMatch[2].toLowerCase()];
    if (mm) return `${monMatch[3]}-${mm}-${monMatch[1].padStart(2, "0")}`;
  }

  // Try YYYYMMDD
  const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compactMatch) return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;

  return defaultValue;
}

function normalizeSymbol(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[/\- ]/g, "")
    .trim();
}

function toCurrencyPair(value: unknown): string {
  const text = String(value ?? "")
    .toUpperCase()
    .trim();
  if (!text) return "";

  const direct = text.replace(/ /g, "");
  if (direct.includes("/")) {
    const [left, right] = direct.split("/", 2);
    if (left.length >= 3 && right.length >= 3) {
      return `${left.slice(0, 3)}/${right.slice(0, 3)}`;
    }
  }
  if (direct.includes("-")) {
    const [left, right] = direct.split("-", 2);
    if (left.length >= 3 && right.length >= 3) {
      return `${left.slice(0, 3)}/${right.slice(0, 3)}`;
    }
  }

  const letters = text.replace(/[^A-Z]/g, "");
  if (letters.length >= 6) {
    return `${letters.slice(0, 3)}/${letters.slice(3, 6)}`;
  }
  return "";
}

const SUPPORT_DOC_RE = /\b(FNC|SWT|FCT)[\/\-]?\s*\d+/i;

function extractSupportDoc(...values: unknown[]): string {
  for (const v of values) {
    if (v == null) continue;
    const text = String(v).trim();
    if (!text) continue;
    const match = SUPPORT_DOC_RE.exec(text);
    if (match) return match[0].trim();
  }
  return "";
}

function extractQuantity(row: PmxRawRow): number {
  for (const key of ["pcs_qty", "grs_qty", "grs", "qty", "last_qty", "LastQty", "Quantity"]) {
    const qty = toFloat(row[key]);
    if (Math.abs(qty) > 0) return qty;
  }
  return 0;
}

function extractPrice(row: PmxRawRow, narrationHint = ""): number {
  for (const key of ["mtl_rate", "rate", "last_px", "LastPx", "Price", "price", "settlement_price"]) {
    const px = toFloat(row[key]);
    if (px > 0) return px;
  }

  for (const text of [row.remarks, row.remarks1, row.comment, narrationHint]) {
    const match = String(text ?? "").match(/@\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
    if (match) {
      const px = toFloat(match[1]);
      if (px > 0) return px;
    }
  }
  return 0;
}

function extractSide(row: PmxRawRow, qtyHint = 0): string {
  const raw = firstNonEmpty(
    row.deal_type, row.DealType, row.side, row.Side,
    row.buy_sell, row.BuySell
  ).toUpperCase();

  if (["BUY", "B", "1"].includes(raw)) return "BUY";
  if (["SELL", "S", "2"].includes(raw)) return "SELL";
  if (raw.includes("BUY")) return "BUY";
  if (raw.includes("SELL")) return "SELL";
  return qtyHint < 0 ? "SELL" : "BUY";
}

function isSwapTrade(row: PmxRawRow, supportDoc = "", narrationHint = ""): boolean {
  if (typeof row !== "object" || row === null) return false;

  if (String(supportDoc ?? "").trim().toUpperCase().startsWith("SWT/")) return true;

  const dealType = firstNonEmpty(
    row.deal_type, row.DealType, row.trade_type, row.TradeType, row.trd_opt, row.TrdOpt
  ).toUpperCase();
  if (["SWT", "SWAP", "SWAPS"].includes(dealType) || dealType.includes("SWAP")) return true;

  for (const value of [
    row.order_id, row.OrderId, row.trade_number, row.trade_no,
    row.ref_number, row.docno, row.DocNo, row.NeoId,
    row.TagNumber, row.remarks, row.remarks1, row.comment,
    row.notes, row.description, narrationHint,
  ]) {
    if (String(value ?? "").toUpperCase().includes("SWT/")) return true;
  }
  return false;
}

function buildDocNumber(row: PmxRawRow, fallbackIndex: number): string {
  const rawDoc = firstNonEmpty(
    row.docno, row.DocNo, row.doc_number, row.DocNumber,
    row.trd, row.TradeId, row.Id, row.RecId, row.NeoId, row.TagNumber
  );
  const normalized = normalizeTradeNumber(rawDoc);
  if (normalized) return normalized;

  // Create a deterministic fallback
  const stableBasis = [
    firstNonEmpty(row.docdate),
    firstNonEmpty(row.valdate),
    firstNonEmpty(row.inst_desc, row.stk_type_name, row.currency_pair),
    firstNonEmpty(row.deal_type, row.side),
    String(extractQuantity(row)),
    String(extractPrice(row)),
    firstNonEmpty(row.evt_ts, row.event_ts),
    firstNonEmpty(row.remarks, row.remarks1),
  ].join("|");

  // Simple hash for deterministic doc numbers
  let hash = 0;
  for (let i = 0; i < stableBasis.length; i++) {
    const chr = stableBasis.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0").slice(0, 16);
  return `PMX-${hex}-${fallbackIndex}`;
}

// ── Map raw PMX row to trade ──
export function mapRowToTrade(row: PmxRawRow, fallbackIndex: number): PmxMappedTrade | null {
  if (typeof row !== "object" || row === null) return null;

  const instDesc = firstNonEmpty(row.inst_desc, row.instrument, row.stk_type_name);
  let currencyPair = firstNonEmpty(
    toCurrencyPair(row.CurrencyPair),
    toCurrencyPair(row.currency_pair),
    toCurrencyPair(instDesc),
    toCurrencyPair(row.cmdty),
    toCurrencyPair(row.stk_type_name),
  );

  let symbol = normalizeSymbol(currencyPair);
  if (!symbol) {
    symbol = normalizeSymbol(
      firstNonEmpty(row.stk_type_name, row.cmdty, row.inst_desc, row.Symbol)
    );
    if (symbol.length > 6) symbol = symbol.slice(0, 6);
  }
  if (symbol.length >= 6 && !currencyPair) {
    currencyPair = `${symbol.slice(0, 3)}/${symbol.slice(3, 6)}`;
  }

  const qtyRaw = extractQuantity(row);
  const qty = Math.abs(qtyRaw);
  if (!symbol || qty <= 0) return null;

  let narration = firstNonEmpty(
    row.remarks, row.remarks1, row.comment, row.notes,
    row.description, row.ContractDescription, instDesc,
  );
  const px = extractPrice(row, narration);
  const side = extractSide(row, qtyRaw);

  const todayStr = new Date().toISOString().slice(0, 10);
  const tradeDate = parseDate(firstNonEmpty(row.docdate, row.TradeDate), todayStr);
  const valueDate = parseDate(
    firstNonEmpty(row.valdate, row.ValueDate, row.settlement_date, row.SettlementDate),
    tradeDate,
  );

  if (!narration) {
    narration = currencyPair
      ? `${currencyPair} ${qty.toFixed(2)} @ ${px.toFixed(5)}`
      : `${symbol} ${qty.toFixed(2)} @ ${px.toFixed(5)}`;
  }

  let settleCurrency = "";
  if (currencyPair && currencyPair.includes("/")) {
    [, settleCurrency] = currencyPair.split("/", 2);
  }
  settleCurrency = firstNonEmpty(
    settleCurrency, row.counter_currency, row.CounterCurrency,
    row.currency, row.Currency, row.trade_currency, row.TradeCurrency,
  ).toUpperCase();

  const settleAmount = px ? qty * px : 0;
  const restTradeId = normalizeTradeNumber(
    firstNonEmpty(row.trd, row.TradeId, row.Id, row.RecId, row.deal_id),
  );
  const docNumber = buildDocNumber(row, fallbackIndex);
  const orderId = normalizeTradeNumber(
    firstNonEmpty(row.order_id, row.OrderId, row.trade_number, row.trade_no, row.ref_number),
  );

  const orderIdUpper = orderId.toUpperCase();
  if (orderIdUpper.startsWith("SWT/") || orderIdUpper.includes("/SWT/")) return null;

  const clordId = firstNonEmpty(row.clord_id, row.ClOrdId, row.TagNumber);
  const fncNumber = extractSupportDoc(
    row.docno, row.remarks, row.remarks1, row.comment,
    row.notes, row.NeoId, row.TagNumber, orderId,
  );

  if (isSwapTrade(row, fncNumber, narration)) return null;

  const traderName = firstNonEmpty(row.trader_name, row.trader, row.created_by, row.username);
  const sourceSystem = firstNonEmpty(row.source_system, "PMX");

  let rawPayload = "";
  try {
    rawPayload = JSON.stringify(row);
  } catch {
    rawPayload = "";
  }

  return {
    tradeDate,
    valueDate,
    symbol,
    side,
    quantity: qty,
    price: px,
    narration,
    settleCurrency,
    settleAmount,
    docNumber,
    orderId,
    clordId,
    fncNumber,
    restTradeId,
    traderName,
    sourceSystem,
    rawPayload,
  };
}

// ── Extract rows from PMX payload ──
export function extractPmxReportRows(payload: unknown): PmxRawRow[] {
  function decodeJsonLike(value: unknown, maxDepth = 3): unknown {
    let out = value;
    for (let i = 0; i < maxDepth; i++) {
      if (typeof out !== "string") break;
      const text = out.trim();
      if (!text.startsWith("{") && !text.startsWith("[")) break;
      try {
        out = JSON.parse(text);
      } catch {
        break;
      }
    }
    return out;
  }

  const decoded = decodeJsonLike(payload);
  if (decoded == null) return [];

  if (typeof decoded === "object" && !Array.isArray(decoded)) {
    const dataBlob = decodeJsonLike((decoded as Record<string, unknown>).data);
    if (Array.isArray(dataBlob)) {
      return dataBlob.filter((r): r is PmxRawRow => typeof r === "object" && r !== null);
    }
    if (typeof dataBlob === "object" && dataBlob !== null) {
      return [dataBlob as PmxRawRow];
    }
    return [];
  }

  if (Array.isArray(decoded)) {
    return decoded.filter((r): r is PmxRawRow => typeof r === "object" && r !== null);
  }
  return [];
}

// ── Auth check ──
function isAuthFailure(status: number, errorText: string): boolean {
  if (status === 401 || status === 403) return true;
  const lower = errorText.toLowerCase();
  const tokens = ["x-auth", "unauthor", "forbidden", "token", "session", "expired", "invalid login", "auth"];
  if (tokens.some((t) => lower.includes(t))) return true;
  if (status >= 500 && lower.includes("internal server error")) return true;
  return false;
}

// ── PMX Session Login ──
export async function pmxLogin(config: PmxConfig): Promise<PmxLoginResult> {
  const username = config.pmxLoginUsername;
  const password = config.pmxLoginPassword;
  const location = config.pmxLoginLocation || "LD";
  const platform = config.pmxPlatform || "Desktop";
  const host = config.pmxHost || "pmxapi.stonex.com";

  if (!username || !password) {
    return { ok: false, error: "PMX auto-login is not configured. Set PMX_LOGIN_USERNAME and PMX_LOGIN_PASSWORD." };
  }

  const url = `https://${host}/restlogin`;
  const body = {
    username,
    password,
    location,
    forcedLogin: true,
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json; charset=utf-8",
        Origin: "https://pmxecute.stonex.com",
        Referer: "https://pmxecute.stonex.com/",
        "User-Agent": "Foundation/1.0",
        "cache-control": "no-cache",
        pragma: "no-cache",
        ...(platform ? { platform } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    const parsed = await resp.json().catch(() => ({}));
    const statusText = String(parsed?.status ?? "").trim().toLowerCase();
    const ok = resp.ok && statusText === "success";
    const token = parsed?.data?.authToken ?? "";
    const userObj = parsed?.userObj ?? {};
    const sid = String(userObj?.SID ?? "").trim();
    const apiUsername = firstNonEmpty(userObj?.UID, username);

    if (!ok || !token) {
      return { ok: false, error: firstNonEmpty(parsed?.message, resp.statusText, "PMX login failed") };
    }

    const session: PmxSession = {
      xAuth: token,
      sid,
      username: apiUsername,
      platform,
      location,
      cacheControl: "no-cache",
      contentType: "application/json; charset=utf-8",
    };
    storeSession(session);

    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Fetch all-deal filter report ──
export async function fetchAllDealReport(
  config: PmxConfig,
  opts: {
    startDate: string; // dd-mm-yyyy
    endDate: string;   // dd-mm-yyyy
    cmdty?: string;
    trdOpt?: string;
    session?: PmxSession | null;
  },
): Promise<PmxFetchResult> {
  const host = config.pmxHost || "pmxapi.stonex.com";
  const accOptKey = config.pmxAccOptKey || "MT0601";
  const createdBy = config.pmxCreatedBy || "2";
  const { startDate, endDate, cmdty = "All", trdOpt = "All" } = opts;

  async function doFetch(session: PmxSession): Promise<{
    ok: boolean;
    status: number;
    error: string;
    payload: unknown;
  }> {
    const params = new URLSearchParams({
      startDate,
      endDate,
      cmdty,
      Trd_opt: trdOpt,
      created_by: createdBy,
      Acc_optKey: accOptKey,
      type: "TD",
      nonTrdCmdty: "",
    });

    const url = `https://${host}/user/alldealFilter_report?${params}`;
    const headers: Record<string, string> = {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Foundation/1.0",
      Origin: "https://pmxecute.stonex.com",
      Referer: "https://pmxecute.stonex.com/",
      "x-auth": session.xAuth,
      sid: session.sid,
      username: session.username,
      platform: session.platform,
      location: session.location,
      "cache-control": session.cacheControl,
      "content-type": session.contentType,
    };

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(180_000),
      });

      const text = await resp.text();
      let payload: unknown = {};
      try {
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }

      let ok = resp.ok;
      if (typeof payload === "object" && payload !== null) {
        const pmxStatus = String((payload as Record<string, unknown>).status ?? "").trim().toLowerCase();
        if (pmxStatus === "failed" || pmxStatus === "error") ok = false;
      }

      const error = ok ? "" : String((payload as Record<string, unknown>)?.message ?? resp.statusText ?? "PMX fetch failed");
      return { ok, status: resp.status, error, payload };
    } catch (err) {
      return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err), payload: {} };
    }
  }

  // Resolve session
  let session = opts.session || getCachedSession();
  let sessionRefreshed = false;

  if (!session) {
    const loginResult = await pmxLogin(config);
    if (!loginResult.ok || !loginResult.session) {
      return {
        ok: false,
        error: loginResult.error || "PMX login failed",
        rows: [],
        startDate,
        endDate,
        sessionRefreshed: false,
      };
    }
    session = loginResult.session;
    sessionRefreshed = true;
  }

  let result = await doFetch(session);

  // Retry on auth failure
  if (!result.ok && isAuthFailure(result.status, result.error)) {
    const loginResult = await pmxLogin(config);
    if (loginResult.ok && loginResult.session) {
      session = loginResult.session;
      sessionRefreshed = true;
      result = await doFetch(session);
    }
  }

  const rows = extractPmxReportRows(result.payload);

  return {
    ok: result.ok,
    status: result.status,
    error: result.error,
    rows,
    startDate,
    endDate,
    sessionRefreshed,
  };
}

// ── Date helpers for PMX ──
export function formatPmxDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function parsePmxDate(value: string): Date | null {
  const text = value.trim();
  // DD-MM-YYYY
  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  // YYYY-MM-DD
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  return null;
}

// ── StoneX OAuth Login ──
export async function stonexLogin(config: PmxConfig): Promise<{
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  const host = config.stonexHost || "api.stonex.com";
  const subKey = config.stonexSubscriptionKey;
  const username = config.stonexUsername;
  const password = config.stonexPassword;

  if (!subKey) return { ok: false, error: "Missing StoneX subscription key" };
  if (!username || !password) return { ok: false, error: "Missing StoneX username/password" };

  const url = `https://${host}/authentication/login`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": subKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Foundation/1.0",
      },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.accessToken) {
      return { ok: true, accessToken: data.accessToken, refreshToken: data.refreshToken ?? "" };
    }
    return { ok: false, error: data.message ?? resp.statusText };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
