"use client";
import { useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { ArrowUp, ArrowDown, Download } from "lucide-react";
import { Th, Td } from "@/components/ui";
import { downloadCsv, type CsvColumn } from "@/lib/csv";

export type SortDir = "asc" | "desc";

export type Column<T> = {
  /** Unique key — also used as React key & sort identifier. */
  key: string;
  header: ReactNode;
  /** What to render in the cell. */
  cell: (row: T, i: number) => ReactNode;
  /** Sort accessor — return a number or string. Omit to disable sort on this column. */
  sortBy?: (row: T) => number | string | null | undefined;
  /** CSV value — omit to skip in export. */
  csv?: { header: string; accessor: (row: T) => string | number | null | undefined };
  align?: "left" | "right";
  width?: number | string;
  /** Override cell style (passed through to <Td>). */
  cellStyle?: CSSProperties | ((row: T) => CSSProperties);
};

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Default sort. */
  defaultSort?: { key: string; dir: SortDir };
  /** When provided, shows a download button that exports rows to CSV. */
  exportFilename?: string;
  /** Header bar shown above the table (e.g. SectionTitle). */
  toolbar?: ReactNode;
  /** Custom row click handler (e.g. to open a drill-down). */
  onRowClick?: (row: T) => void;
  /** Empty-state message. */
  emptyMessage?: string;
}

export function SortableTable<T>({
  rows, columns, rowKey, defaultSort, exportFilename, toolbar, onRowClick, emptyMessage = "No data.",
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortBy) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortBy!(a), bv = col.sortBy!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return 0;
    });
  }, [rows, columns, sort]);

  function clickHeader(col: Column<T>) {
    if (!col.sortBy) return;
    setSort((cur) => {
      if (!cur || cur.key !== col.key) return { key: col.key, dir: "desc" };
      return { key: col.key, dir: cur.dir === "desc" ? "asc" : "desc" };
    });
  }

  function exportCsv() {
    const csvCols: CsvColumn<T>[] = columns.flatMap((c) => c.csv ? [c.csv] : []);
    if (csvCols.length === 0) return;
    downloadCsv(sorted, csvCols, exportFilename ?? "export");
  }

  return (
    <div>
      {(toolbar || exportFilename) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div>{toolbar}</div>
          {exportFilename && (
            <button
              onClick={exportCsv}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 10px", fontSize: 12, fontWeight: 500,
                border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
                background: "var(--panel-2)", color: "var(--ink-2)", cursor: "pointer",
              }}
              title="Download as CSV"
            >
              <Download size={12} /> CSV
            </button>
          )}
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => {
              const isActive = sort?.key === c.key;
              const sortable = !!c.sortBy;
              return (
                <Th key={c.key} align={c.align} style={{ width: c.width }}>
                  <span
                    onClick={sortable ? () => clickHeader(c) : undefined}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      cursor: sortable ? "pointer" : "default",
                      userSelect: "none",
                      color: isActive ? "var(--ink-2)" : undefined,
                    }}
                  >
                    {c.header}
                    {sortable && isActive && (
                      sort!.dir === "desc"
                        ? <ArrowDown size={11} />
                        : <ArrowUp size={11} />
                    )}
                  </span>
                </Th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <Td style={{ textAlign: "center", color: "var(--ink-4)", padding: "32px 0" }}>
                {emptyMessage}
              </Td>
            </tr>
          )}
          {sorted.map((r, i) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((c) => {
                const style = typeof c.cellStyle === "function" ? c.cellStyle(r) : c.cellStyle;
                return (
                  <Td key={c.key} align={c.align} style={style}>
                    {c.cell(r, i)}
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
