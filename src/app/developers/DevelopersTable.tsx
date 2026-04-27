"use client";
import { useRouter } from "next/navigation";
import { SortableTable, type Column } from "@/components/SortableTable";
import { Avatar, Pill, RatioBar } from "@/components/ui";
import { SectionTitle } from "@/components/ui";
import { fmtUSD } from "@/lib/format";

export type DevRow = {
  id: string;
  name: string;
  team: string;
  anthropic: number;
  openai: number;
  total: number;
};

export function DevelopersTable({ rows, maxTotal }: { rows: DevRow[]; maxTotal: number }) {
  const router = useRouter();

  const columns: Column<DevRow>[] = [
    {
      key: "rank",
      header: "#",
      width: 48,
      cell: (_r, i) => <span style={{ color: "var(--ink-4)" }}>{i + 1}</span>,
    },
    {
      key: "name",
      header: "Developer",
      sortBy: (r) => r.name.toLowerCase(),
      csv: { header: "Developer", accessor: (r) => r.name },
      cell: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={r.name} size={28} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{r.name}</div>
            <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
              {r.name.toLowerCase().replace(/\s+/g, ".")}@company.com
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "team",
      header: "Team",
      sortBy: (r) => r.team,
      csv: { header: "Team", accessor: (r) => r.team },
      cell: (r) => <Pill tone="neutral" size="sm">{r.team}</Pill>,
    },
    {
      key: "anthropic",
      header: "Anthropic",
      align: "right",
      sortBy: (r) => r.anthropic,
      csv: { header: "Anthropic ($)", accessor: (r) => r.anthropic.toFixed(2) },
      cell: (r) => r.anthropic > 0 ? fmtUSD(r.anthropic) : "—",
      cellStyle: (r) => ({ fontFamily: "var(--font-mono, monospace)", color: r.anthropic > 0 ? "var(--ink-2)" : "var(--ink-4)" }),
    },
    {
      key: "openai",
      header: "OpenAI",
      align: "right",
      sortBy: (r) => r.openai,
      csv: { header: "OpenAI ($)", accessor: (r) => r.openai.toFixed(2) },
      cell: (r) => r.openai > 0 ? fmtUSD(r.openai) : "—",
      cellStyle: (r) => ({ fontFamily: "var(--font-mono, monospace)", color: r.openai > 0 ? "var(--ink-2)" : "var(--ink-4)" }),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortBy: (r) => r.total,
      csv: { header: "Total ($)", accessor: (r) => r.total.toFixed(2) },
      cell: (r) => fmtUSD(r.total),
      cellStyle: { fontFamily: "var(--font-mono, monospace)", fontWeight: 600, color: "var(--ink)" },
    },
    {
      key: "mix",
      header: "Mix",
      width: 200,
      cell: (r) => <RatioBar a={r.anthropic} b={r.openai} total={maxTotal} />,
    },
  ];

  return (
    <SortableTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort={{ key: "total", dir: "desc" }}
      exportFilename={`developers-${new Date().toISOString().slice(0, 10)}`}
      toolbar={<SectionTitle sub="Click any row to drill down">Developer breakdown</SectionTitle>}
      onRowClick={(r) => router.push(`/developers/${r.id}`)}
      emptyMessage="No developer activity in the selected range."
    />
  );
}
