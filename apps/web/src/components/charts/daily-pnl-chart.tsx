"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";

interface DailyPnlPoint {
  date: string;
  metalProfitZar: number;
  exchangeProfitZar: number;
  hurdleZar: number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatZar(val: number): string {
  return val.toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const hurdle = payload.find((p: any) => p.dataKey === "hurdleZar");
  const metal = payload.find((p: any) => p.dataKey === "metalProfitZar");
  const exchange = payload.find((p: any) => p.dataKey === "exchangeProfitZar");
  const total = (metal?.value || 0) + (exchange?.value || 0);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-[var(--color-text-primary)] mb-1">
        {formatDate(label)}
      </p>
      {metal && (
        <p className="text-[var(--color-text-secondary)]">
          Metal: <span className="font-medium">R{formatZar(metal.value)}</span>
        </p>
      )}
      {exchange && (
        <p className="text-[var(--color-text-secondary)]">
          Exchange: <span className="font-medium">R{formatZar(exchange.value)}</span>
        </p>
      )}
      <p className="text-[var(--color-text-primary)] font-medium border-t border-[var(--color-border)] mt-1 pt-1">
        Net: R{formatZar(total)}
      </p>
      {hurdle && (
        <p className="text-[var(--color-text-muted)]">
          Hurdle: R{formatZar(hurdle.value)}
        </p>
      )}
    </div>
  );
}

/**
 * Custom shape for the exchange (topmost) bar that also renders
 * the hurdle rate outline behind/around the full stack.
 * This ensures the hurdle outline is in the exact same x position.
 */
function ExchangeBarWithHurdle(props: any) {
  const { x, y, width, height, payload, background } = props;
  // The exchange bar's y+height gives us the bottom of the stack.
  // We need to draw the hurdle from the baseline up to the hurdle value.
  // Since this is part of the stacked bar, the bottom of the full stack
  // is at background.y + background.height (the chart baseline).
  const baseY = background ? background.y + background.height : y + Math.abs(height);
  const hurdleVal = payload?.hurdleZar || 0;

  // We need the pixel height for the hurdle. The exchange bar knows its
  // own pixel-per-unit from its height and value.
  // But it's easier: use the background (full category) height ratio.
  // Actually, let's use a scale factor from the visible bar stack.
  const metalVal = payload?.metalProfitZar || 0;
  const exchangeVal = payload?.exchangeProfitZar || 0;
  const stackVal = metalVal + exchangeVal;
  
  // The full stack pixel height (from baseline to top of exchange bar)
  const stackPixelH = baseY - y;
  const pxPerUnit = stackVal !== 0 ? Math.abs(stackPixelH / stackVal) : 0;
  const hurdlePixelH = Math.abs(hurdleVal * pxPerUnit);
  const hurdleY = baseY - hurdlePixelH;

  return (
    <g>
      {/* Hurdle outline (behind) */}
      {hurdleVal > 0 && pxPerUnit > 0 && (
        <rect
          x={x}
          y={hurdleY}
          width={width}
          height={hurdlePixelH}
          fill="transparent"
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          rx={2}
          ry={2}
        />
      )}
      {/* Actual exchange bar */}
      {height !== 0 && (
        <rect
          x={x}
          y={height > 0 ? y : y + height}
          width={width}
          height={Math.abs(height)}
          fill="#10b981"
          rx={2}
          ry={2}
        />
      )}
    </g>
  );
}

export function DailyPnlChart({ data }: { data: DailyPnlPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Daily P&L
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
          No P&L data available.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
        Daily P&L
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={data}
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="2 2" />

          {/* Metal profit (bottom of stack) */}
          <Bar
            dataKey="metalProfitZar"
            stackId="pnl"
            fill="#3b82f6"
          />

          {/* Exchange profit (top of stack) — custom shape also draws hurdle outline */}
          <Bar
            dataKey="exchangeProfitZar"
            stackId="pnl"
            fill="#10b981"
            shape={<ExchangeBarWithHurdle />}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3b82f6]" /> Metal
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#10b981]" /> Exchange
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ border: "1.5px dashed #6b7280" }}
          />{" "}
          Hurdle
        </span>
      </div>
    </div>
  );
}
