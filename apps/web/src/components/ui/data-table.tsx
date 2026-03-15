"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type Row,
} from "@tanstack/react-table";
import { useState, useEffect, useMemo, type ReactNode } from "react";

// ── Icons ──
function SortAscIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 2L10 8H2L6 2Z" />
    </svg>
  );
}

function SortDescIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 10L2 4H10L6 10Z" />
    </svg>
  );
}

function SortNeutralIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity={0.3}>
      <path d="M6 1L9 5H3L6 1ZM6 11L3 7H9L6 11Z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 4L6 8L10 12" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 4L10 8L6 12" />
    </svg>
  );
}

// ── Props ──
interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  /** Show pagination controls */
  paginate?: boolean;
  /** Page size (default 50) */
  pageSize?: number;
  /** Placeholder text in search */
  searchPlaceholder?: string;
  /** Column to use for global filter */
  searchColumn?: string;
  /** Show search input */
  searchable?: boolean;
  /** Extra toolbar content (right-aligned) */
  toolbar?: ReactNode;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Custom row class */
  rowClassName?: (row: TData) => string;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  loading?: boolean;
  /** Compact mode with smaller text */
  compact?: boolean;
  /** Initial sort */
  initialSorting?: SortingState;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Max height for scrollable body */
  maxHeight?: string;
  /** Enable column sorting (default: true) */
  enableSorting?: boolean;
  /** Initial column visibility state */
  initialColumnVisibility?: VisibilityState;
  /** Footer content rendered as <tfoot> inside the same table (for aligned totals rows) */
  footer?: ReactNode;
}

export function DataTable<TData>({
  columns,
  data,
  paginate = true,
  pageSize = 50,
  searchPlaceholder = "Search...",
  searchColumn,
  searchable = false,
  toolbar,
  onRowClick,
  rowClassName,
  emptyMessage = "No data available.",
  loading = false,
  compact = false,
  initialSorting = [],
  stickyHeader = false,
  maxHeight,
  enableSorting: enableSortingProp = true,
  initialColumnVisibility,
  footer,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibility ?? {}
  );
  const [globalFilter, setGlobalFilter] = useState("");

  // Sync column visibility when settings change externally
  useEffect(() => {
    if (initialColumnVisibility) {
      setColumnVisibility(initialColumnVisibility);
    }
  }, [initialColumnVisibility]);

  const table = useReactTable({
    data,
    columns,
    enableSorting: enableSortingProp,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: searchColumn ? undefined : globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginate
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
        }
      : {}),
  });

  const cellPadding = compact ? "px-2 py-1" : "px-3 py-2";
  const fontSize = compact ? "text-xs" : "text-sm";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <div className="flex items-center gap-3">
          {searchable && (
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={
                searchColumn
                  ? (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""
                  : globalFilter
              }
              onChange={(e) => {
                if (searchColumn) {
                  table.getColumn(searchColumn)?.setFilterValue(e.target.value);
                } else {
                  setGlobalFilter(e.target.value);
                }
              }}
              className={`${fontSize} rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] w-64`}
            />
          )}
          {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {/* Table */}
      <div
        className="overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full border-collapse">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                {headerGroup.headers.map((header) => {
                  const isRight = (header.column.columnDef.meta as any)?.align === "right";
                  return (
                    <th
                      key={header.id}
                      className={`${cellPadding} ${fontSize} ${isRight ? "text-right" : "text-left"} font-medium text-[var(--color-text-secondary)] whitespace-nowrap select-none ${
                        header.column.getCanSort() ? "cursor-pointer hover:text-[var(--color-text-primary)]" : ""
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      <div className={`flex items-center gap-1 ${isRight ? "justify-end" : ""}`}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="inline-flex">
                            {header.column.getIsSorted() === "asc" ? (
                              <SortAscIcon />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <SortDescIcon />
                            ) : (
                              <SortNeutralIcon />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className={`${cellPadding} ${fontSize} text-center text-[var(--color-text-muted)]`}>
                  <div className="flex items-center justify-center gap-2 py-8">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={`${cellPadding} ${fontSize} text-center text-[var(--color-text-muted)] py-8`}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-[var(--color-background)]" : ""
                  } ${rowClassName ? rowClassName(row.original) : ""}`}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isRight = (cell.column.columnDef.meta as any)?.align === "right";
                    return (
                      <td
                        key={cell.id}
                        className={`${cellPadding} ${fontSize} text-[var(--color-text-primary)] whitespace-nowrap ${
                          isRight ? "text-right tabular-nums" : ""
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {footer && (
            <tfoot className="border-t border-[var(--color-border)] bg-[var(--color-background)]">
              {footer}
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {paginate && !loading && data.length > 0 && (
        <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
          <div>
            Showing{" "}
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            {" - "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}
            {" of "}
            {table.getFilteredRowModel().rows.length} rows
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-background)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon />
            </button>
            <span className="px-3 text-sm">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-background)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper to create a number cell with positive/negative coloring
 */
export function numCell(value: number | string | null | undefined, decimals = 2): ReactNode {
  if (value == null || value === "") return <span className="num-neutral">-</span>;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return <span className="num-neutral">-</span>;
  if (num === 0) return <span className="num-neutral">-</span>;
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span className={num > 0 ? "num-positive" : "num-negative"}>
      {formatted}
    </span>
  );
}

/**
 * Helper to create a badge/pill element
 */
export function statusBadge(
  status: string,
  variant: "success" | "danger" | "warning" | "neutral" = "neutral"
): ReactNode {
  const colors = {
    success: "bg-green-50 text-green-700 border-green-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    neutral: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {status}
    </span>
  );
}
