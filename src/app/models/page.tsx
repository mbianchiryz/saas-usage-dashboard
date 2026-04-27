"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Panel, PageHeader, SectionTitle, Pill, ProviderTag, PROVIDER_HEX } from "@/components/ui";
import { SortableTable, type Column } from "@/components/SortableTable";
import { fmtUSD, fmtNum } from "@/lib/format";
import { parseRange } from "@/lib/dateRange";

interface ModelRow {
  model: string;
  provider: "anthropic" | "openai";
  cost: number;
  input_tokens: number;
  output_tokens: number;
}

export default function ModelsPage() {
  return (
    <Suspense fallback={null}>
      <ModelsView />
    </Suspense>
  );
}

function ModelsView() {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const searchParams = useSearchParams();
  const range = parseRange(searchParams);

  useEffect(() => {
    const qs = searchParams.toString();
    fetch(`/api/models${qs ? `?${qs}` : ""}`).then((r) => r.json()).then(setRows);
  }, [searchParams]);

  const total = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <div>
      <PageHeader
        title="By model"
        subtitle={`${rows.length} models in use · ${range.label.toLowerCase()}`}
        right={<Pill tone="neutral">${Math.round(total).toLocaleString()} total</Pill>}
      />

      <Panel style={{ marginBottom: 16 }}>
        <SectionTitle sub="Bars colored by provider">Cost per model</SectionTitle>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="model" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => fmtUSD(v, { compact: true })} />
              <Tooltip formatter={(v: number) => fmtUSD(v)} />
              <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                {rows.map((r, i) => <Cell key={i} fill={PROVIDER_HEX[r.provider]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel padding={0} style={{ overflow: "hidden" }}>
        <SortableTable
          rows={rows}
          rowKey={(r) => r.model}
          defaultSort={{ key: "cost", dir: "desc" }}
          exportFilename={`models-${new Date().toISOString().slice(0, 10)}`}
          toolbar={<SectionTitle sub="Sortable · click any header">Model breakdown</SectionTitle>}
          emptyMessage="No model usage in the selected range."
          columns={[
            {
              key: "model",
              header: "Model",
              sortBy: (r) => r.model,
              csv: { header: "Model", accessor: (r) => r.model },
              cell: (r) => r.model,
              cellStyle: { fontFamily: "var(--font-mono, monospace)", color: "var(--ink)" },
            },
            {
              key: "provider",
              header: "Provider",
              sortBy: (r) => r.provider,
              csv: { header: "Provider", accessor: (r) => r.provider },
              cell: (r) => <ProviderTag provider={r.provider} />,
            },
            {
              key: "input_tokens",
              header: "Input tokens",
              align: "right",
              sortBy: (r) => r.input_tokens,
              csv: { header: "Input tokens", accessor: (r) => r.input_tokens },
              cell: (r) => fmtNum(r.input_tokens),
              cellStyle: { fontFamily: "var(--font-mono, monospace)", color: "var(--ink-3)" },
            },
            {
              key: "output_tokens",
              header: "Output tokens",
              align: "right",
              sortBy: (r) => r.output_tokens,
              csv: { header: "Output tokens", accessor: (r) => r.output_tokens },
              cell: (r) => fmtNum(r.output_tokens),
              cellStyle: { fontFamily: "var(--font-mono, monospace)", color: "var(--ink-3)" },
            },
            {
              key: "cost",
              header: "Cost",
              align: "right",
              sortBy: (r) => r.cost,
              csv: { header: "Cost ($)", accessor: (r) => r.cost.toFixed(2) },
              cell: (r) => fmtUSD(r.cost),
              cellStyle: { fontFamily: "var(--font-mono, monospace)", fontWeight: 600, color: "var(--ink)" },
            },
            {
              key: "share",
              header: "% of total",
              align: "right",
              sortBy: (r) => r.cost,
              csv: { header: "Share (%)", accessor: (r) => total > 0 ? ((r.cost / total) * 100).toFixed(2) : "0" },
              cell: (r) => total > 0 ? `${((r.cost / total) * 100).toFixed(1)}%` : "—",
              cellStyle: { fontFamily: "var(--font-mono, monospace)", color: "var(--ink-3)" },
            },
          ] satisfies Column<ModelRow>[]}
        />
      </Panel>
    </div>
  );
}
