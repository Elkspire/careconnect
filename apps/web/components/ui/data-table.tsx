"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useLocale } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";

export interface DataTableColumn {
  key: string;
  header: string;
  /** Sortable columns need a sort value in every row (see DataTableRow). */
  sortable?: boolean;
  align?: "start" | "end";
}

export interface DataTableRow {
  key: string;
  /** What each column shows, by column key. Already rendered, so a server page can build it. */
  cells: Record<string, ReactNode>;
  /** What each sortable column sorts by: text, a number, or a date. Missing or null sorts last. */
  sortValues?: Record<string, string | number | Date | null | undefined>;
}

type Direction = "ascending" | "descending";

/**
 * The prototypes' data table with click-to-sort headers. Sorting happens in
 * the browser over the rows it was given, so it suits a page's worth of
 * rows; past that, sort on the server instead.
 *
 * Rows hold rendered cells plus plain sort values, not render functions:
 * functions can't be passed from a server component into this one.
 */
export function DataTable({
  columns,
  rows,
  caption,
  initialSort,
  empty,
}: {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  /** Read out to screen readers; not shown. */
  caption: string;
  initialSort?: { key: string; direction: Direction };
  /** Shown in place of the rows when there are none. */
  empty?: ReactNode;
}) {
  const locale = useLocale();
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
    const value = (row: DataTableRow) => row.sortValues?.[sort.key];
    const flip = sort.direction === "ascending" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      // Blanks last whichever way the column is sorted.
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      if (typeof x === "string" && typeof y === "string") return collator.compare(x, y) * flip;
      return (Number(x) - Number(y)) * flip;
    });
  }, [rows, sort, locale]);

  const toggle = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? { key, direction: s.direction === "ascending" ? "descending" : "ascending" }
        : { key, direction: "ascending" },
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => {
              const direction = sort?.key === col.key ? sort.direction : undefined;
              const Icon = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ChevronsUpDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={col.sortable ? (direction ?? "none") : undefined}
                  className={`whitespace-nowrap border-b border-border bg-[#f8fafc] px-3.5 py-2.5 text-xs font-semibold text-text-muted ${
                    col.align === "end" ? "text-end" : "text-start"
                  }`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggle(col.key)}
                      className={`-mx-1.5 inline-flex min-h-8 items-center gap-1 rounded-sm px-1.5 transition hover:text-text ${
                        direction ? "text-text" : ""
                      } ${col.align === "end" ? "flex-row-reverse" : ""}`}
                    >
                      {col.header}
                      <Icon aria-hidden className={`size-3.5 shrink-0 ${direction ? "" : "opacity-50"}`} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3.5 py-10 text-center text-text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={row.key} className="border-b border-[#eef2f6] last:border-b-0 hover:bg-[#f5fafa]">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3.5 py-3 align-middle text-text ${col.align === "end" ? "text-end tabular-nums" : ""}`}
                  >
                    {row.cells[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
