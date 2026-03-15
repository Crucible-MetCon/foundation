"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

interface DailyPnlPoint {
  date: string;
  metalProfitZar: number;
  exchangeProfitZar: number;
  hurdleZar: number;
}

/** Derived row with positive/negative splits for correct stacking */
interface ChartRow {
  date: string;
  // Original values (for tooltip)
  metalProfitZar: number;
  exchangeProfitZar: number;
  hurdleZar: number;
  netProfitZar: number;
  // Split values for stacking
  metalPos: number;
  metalNeg: number;
  exchangePos: number;
  exchangeNeg: number;
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

  // Read original values from first payload entry's full data row
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  const metal = row.metalProfitZar;
  const exchange = row.exchangeProfitZar;
  const total = metal + exchange;
  const hurdle = row.hurdleZar;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-[var(--color-text-primary)] mb-1">
        {formatDate(label)}
      </p>
      <p className="text-[var(--color-text-secondary)]">
        Metal: <span className="font-medium">R{formatZar(metal)}</span>
      </p>
      <p className="text-[var(--color-text-secondary)]">
        Exchange: <span className="font-medium">R{formatZar(exchange)}</span>
      </p>
      <p className="text-[var(--color-text-primary)] font-medium border-t border-[var(--color-border)] mt-1 pt-1">
        Net: R{formatZar(total)}
      </p>
      {hurdle > 0 && (
        <p className="text-[var(--color-text-muted)]">
          Hurdle: R{formatZar(hurdle)}
        </p>
      )}
    </div>
  );
}

// Net Profit dot: green if net >= hurdle, red if below
function NetProfitDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const net = payload?.netProfitZar ?? 0;
  const hurdle = payload?.hurdleZar ?? 0;
  const color = net >= hurdle ? "#10b981" : "#ef4444";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      stroke="#000000"
      strokeWidth={1.5}
    />
  );
}

// Custom shape: transparent fill with dark grey dotted border
function HurdleBarShape(props: any) {
  const { x, y, width, height } = props;
  if (!width || !height || height === 0) return null;
  const h = Math.abs(height);
  const top = height >= 0 ? y : y + height;
  // 50% wider than the P&L bars, centered
  const widerWidth = width * 1.5;
  const offsetX = x - (widerWidth - width) / 2;
  return (
    <rect
      x={offsetX}
      y={top}
      width={widerWidth}
      height={h}
      fill="transparent"
      stroke="#6b7280"
      strokeWidth={1.5}
      strokeDasharray="4 3"
      rx={2}
      ry={2}
    />
  );
}

export function DailyPnlChart({ data, hurdleRatePct }: { data: DailyPnlPoint[]; hurdleRatePct?: number }) {
  // Split each value into positive and negative components so that
  // Recharts stacks them independently — positive bars go up from 0,
  // negative bars go down from 0, both are always visible.
  const chartData = useMemo<ChartRow[]>(() => {
    if (!data) return [];
    return data.map((d) => ({
      date: d.date,
      metalProfitZar: d.metalProfitZar,
      exchangeProfitZar: d.exchangeProfitZar,
      hurdleZar: d.hurdleZar,
      netProfitZar: d.metalProfitZar + d.exchangeProfitZar,
      metalPos: d.metalProfitZar > 0 ? d.metalProfitZar : 0,
      metalNeg: d.metalProfitZar < 0 ? d.metalProfitZar : 0,
      exchangePos: d.exchangeProfitZar > 0 ? d.exchangeProfitZar : 0,
      exchangeNeg: d.exchangeProfitZar < 0 ? d.exchangeProfitZar : 0,
    }));
  }, [data]);

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
          data={chartData}
          barSize={16}
          barGap={-16}
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

          {/* Hurdle bar: dotted outline, plotted on same Y-axis, rendered first (behind) */}
          <Bar
            dataKey="hurdleZar"
            shape={<HurdleBarShape />}
            isAnimationActive={false}
          />

          {/* Positive stack: metal + exchange gains stacked upward */}
          <Bar
            dataKey="metalPos"
            stackId="pos"
            fill="#3b82f6"
            isAnimationActive={false}
          />
          <Bar
            dataKey="exchangePos"
            stackId="pos"
            fill="#10b981"
            isAnimationActive={false}
          />

          {/* Negative stack: metal + exchange losses stacked downward */}
          <Bar
            dataKey="metalNeg"
            stackId="neg"
            fill="#3b82f6"
            isAnimationActive={false}
          />
          <Bar
            dataKey="exchangeNeg"
            stackId="neg"
            fill="#10b981"
            isAnimationActive={false}
          />

          {/* Net Profit line: sum of metal + exchange */}
          <Line
            dataKey="netProfitZar"
            type="monotone"
            stroke="#000000"
            strokeWidth={2}
            dot={<NetProfitDot />}
            activeDot={<NetProfitDot />}
            isAnimationActive={false}
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
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-black" /> Net Profit
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ border: "1.5px dashed #6b7280" }}
          />{" "}
          Hurdle ({hurdleRatePct != null ? `${hurdleRatePct}%` : "0.2%"})
        </span>
      </div>
    </div>
  );
}
