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
  Rectangle,
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

// Custom bar shape: no fill, dark grey dotted border
function HurdleBarShape(props: any) {
  const { x, y, width, height } = props;
  if (!height || height === 0) return null;
  return (
    <Rectangle
      x={x}
      y={y}
      width={width}
      height={height}
      fill="transparent"
      stroke="#6b7280"
      strokeWidth={1.5}
      strokeDasharray="4 3"
      radius={[2, 2, 0, 0]}
    />
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
          barGap={-1}
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

          {/* Hurdle bar: no fill, dark grey dotted outline */}
          <Bar
            dataKey="hurdleZar"
            shape={<HurdleBarShape />}
            isAnimationActive={false}
          />

          {/* Metal profit (stacked) */}
          <Bar
            dataKey="metalProfitZar"
            stackId="pnl"
            fill="#3b82f6"
            radius={[0, 0, 0, 0]}
          />

          {/* Exchange profit (stacked on top of metal) */}
          <Bar
            dataKey="exchangeProfitZar"
            stackId="pnl"
            fill="#10b981"
            radius={[2, 2, 0, 0]}
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
