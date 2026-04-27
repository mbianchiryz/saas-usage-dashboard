/**
 * Tiny CSV export helper. Quotes fields that contain commas, quotes, or newlines.
 * Triggers a browser download — call from a client component.
 */

export type CsvColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

function escape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escape(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escape(c.accessor(r))).join(",")).join("\n");
  return head + "\n" + body;
}

export function downloadCsv<T>(rows: T[], columns: CsvColumn<T>[], filename: string) {
  const csv  = rowsToCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
