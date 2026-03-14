import { NextResponse } from "next/server";

// ── Symbol mapping: TradingView → Yahoo Finance ──

interface SymbolInfo {
  yahoo: string;
  name: string;
  decimals: number;
  inverse?: boolean; // e.g. ZAR/USD = 1 / USD/ZAR
}

const SYMBOL_MAP: Record<string, SymbolInfo> = {
  "OANDA:XAUUSD": { yahoo: "GC=F", name: "Gold (XAU/USD)", decimals: 2 },
  "OANDA:XAGUSD": { yahoo: "SI=F", name: "Silver (XAG/USD)", decimals: 4 },
  "OANDA:XPTUSD": { yahoo: "PL=F", name: "Platinum (XPT/USD)", decimals: 2 },
  "OANDA:XPDUSD": { yahoo: "PA=F", name: "Palladium (XPD/USD)", decimals: 2 },
  "FX:USDZAR": { yahoo: "ZAR=X", name: "USD/ZAR", decimals: 4 },
  "FX:ZARUSD": { yahoo: "ZAR=X", name: "ZAR/USD", decimals: 6, inverse: true },
  "TVC:DXY": { yahoo: "DX-Y.NYB", name: "US Dollar Index", decimals: 3 },
  "COMEX:GC1!": { yahoo: "GC=F", name: "Gold Futures", decimals: 2 },
  "COMEX:SI1!": { yahoo: "SI=F", name: "Silver Futures", decimals: 4 },
};

// ── Technical Indicator Calculations ──

/** Exponential Moving Average */
function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/** Simple Moving Average (returns the latest value) */
function sma(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** RSI (Relative Strength Index) – Wilder's smoothing */
function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;

  const changes = closes.map((c, i) => (i === 0 ? 0 : c - closes[i - 1]));

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

/** MACD (12, 26, 9) */
function calculateMACD(closes: number[]) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

// ── Utility ──

function fmt(value: number | null | undefined, decimals: number): string {
  if (value == null || isNaN(value)) return "N/A";
  return value.toFixed(decimals);
}

// ── Route Handler ──

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tvSymbol = searchParams.get("symbol");

  if (!tvSymbol) {
    return NextResponse.json({ error: "symbol query parameter is required" }, { status: 400 });
  }

  const info = SYMBOL_MAP[tvSymbol];
  if (!info) {
    return NextResponse.json(
      { error: `Unknown symbol: ${tvSymbol}. Supported: ${Object.keys(SYMBOL_MAP).join(", ")}` },
      { status: 400 },
    );
  }

  try {
    // Fetch 6 months of daily data from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(info.yahoo)}?interval=1d&range=6mo`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FoundationAI/1.0)" },
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!resp.ok) {
      throw new Error(`Yahoo Finance returned HTTP ${resp.status}`);
    }

    const json = await resp.json();
    const result = json.chart?.result?.[0];
    if (!result) {
      throw new Error("No data returned from Yahoo Finance");
    }

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const { open, high, low, close, volume } = quote;

    // Build OHLCV bars, filtering null values
    interface Bar {
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }

    const bars: Bar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (close[i] == null) continue;
      const bar: Bar = {
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        open: open[i],
        high: high[i],
        low: low[i],
        close: close[i],
        volume: volume[i] || 0,
      };
      // Invert for ZAR/USD
      if (info.inverse) {
        bar.open = 1 / bar.open;
        bar.high = 1 / bar.low; // inverted high = 1/low
        bar.low = 1 / bar.high;  // inverted low  = 1/high
        bar.close = 1 / bar.close;
      }
      bars.push(bar);
    }

    if (bars.length === 0) {
      throw new Error("No price data available for this symbol");
    }

    const closes = bars.map((b) => b.close);
    const d = info.decimals;

    // Calculate indicators
    const rsiValues = calculateRSI(closes, 14);
    const macdData = calculateMACD(closes);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const sma200 = closes.length >= 200 ? sma(closes, 200) : null;

    // Current bar & change
    const current = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2] : null;
    const change = prev ? current.close - prev.close : 0;
    const changePct = prev ? (change / prev.close) * 100 : 0;

    // Key levels (recent 20 days)
    const recent20 = bars.slice(-20);
    const high20 = Math.max(...recent20.map((b) => b.high));
    const low20 = Math.min(...recent20.map((b) => b.low));
    const high6mo = Math.max(...bars.map((b) => b.high));
    const low6mo = Math.min(...bars.map((b) => b.low));

    // Last 10 trading days for detailed context
    const last10 = bars.slice(-10);

    // Meta from Yahoo (includes regularMarketPrice for most recent quote)
    const meta = result.meta || {};
    const regularMarketPrice = info.inverse
      ? 1 / (meta.regularMarketPrice || current.close)
      : meta.regularMarketPrice || current.close;

    // Build response
    const marketData = {
      symbol: tvSymbol,
      name: info.name,
      dataSource: `Yahoo Finance (${info.yahoo})`,
      current: {
        date: current.date,
        price: Number(fmt(regularMarketPrice, d)),
        open: Number(fmt(current.open, d)),
        high: Number(fmt(current.high, d)),
        low: Number(fmt(current.low, d)),
        close: Number(fmt(current.close, d)),
        volume: current.volume,
        change: Number(fmt(change, d)),
        changePct: Number(changePct.toFixed(2)),
      },
      indicators: {
        rsi14: Number(fmt(rsiValues[rsiValues.length - 1], 2)),
        macd: {
          line: Number(fmt(macdData.macd[macdData.macd.length - 1], 4)),
          signal: Number(fmt(macdData.signal[macdData.signal.length - 1], 4)),
          histogram: Number(fmt(macdData.histogram[macdData.histogram.length - 1], 4)),
        },
        sma20: sma20 != null ? Number(fmt(sma20, d)) : null,
        sma50: sma50 != null ? Number(fmt(sma50, d)) : null,
        sma200: sma200 != null ? Number(fmt(sma200, d)) : null,
      },
      keyLevels: {
        high20Day: Number(fmt(high20, d)),
        low20Day: Number(fmt(low20, d)),
        high6Month: Number(fmt(high6mo, d)),
        low6Month: Number(fmt(low6mo, d)),
      },
      recentBars: last10.map((b) => ({
        date: b.date,
        open: Number(fmt(b.open, d)),
        high: Number(fmt(b.high, d)),
        low: Number(fmt(b.low, d)),
        close: Number(fmt(b.close, d)),
        volume: b.volume,
      })),
      totalBars: bars.length,
    };

    return NextResponse.json(marketData);
  } catch (error: unknown) {
    console.error("Market data error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch market data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
