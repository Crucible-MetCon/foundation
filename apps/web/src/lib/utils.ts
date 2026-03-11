import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number with locale awareness */
export function fmt(
  val: number | string | null | undefined,
  decimals = 2
): string {
  if (val == null || val === "") return "-";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "-";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format date string to YYYY-MM-DD */
export function fmtDate(val: string | Date | null | undefined): string {
  if (!val) return "-";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

/** Format datetime string to YYYY-MM-DD HH:MM */
export function fmtDateTime(val: string | Date | null | undefined): string {
  if (!val) return "-";
  if (val instanceof Date) return val.toISOString().slice(0, 16).replace("T", " ");
  return String(val).slice(0, 16).replace("T", " ");
}

/** CSS class for positive/negative/neutral number */
export function numClass(val: number | string | null | undefined): string {
  if (val == null || val === "") return "num-neutral";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return "num-neutral";
  return num > 0 ? "num-positive" : "num-negative";
}

/** Parse loose number format: handles (5) -> -5, 1,000 -> 1000 */
export function parseLooseNumber(val: string | number | null | undefined): number {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  let s = String(val).trim();
  const negative = s.startsWith("(") && s.endsWith(")");
  if (negative) s = s.slice(1, -1);
  s = s.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return negative ? -num : num;
}

/** Normalize trade number: uppercase, remove .0 suffix */
export function normalizeTradeNumber(val: string | null | undefined): string {
  if (!val) return "";
  let s = String(val).trim().toUpperCase();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s;
}
