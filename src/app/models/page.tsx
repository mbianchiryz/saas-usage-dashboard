"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Panel, PageHeader, SectionTitle, Pill, ProviderTag, Th, Td, PROVIDER_HEX } from "@/components/ui";
import { fmtUSD, fmtNum } from "@/lib/format";

interface ModelRow {
  model: string;
  provider: "anthropic" | "openai";
  cost: number;
  input_tokens: number;
  output_tokens: number;
}

export default function ModelsPage() {
  const [rows, setRows] = useState<ModelRow[]>([]);

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then(setRows);
  }, []);

  const total = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <div>
      <PageHeader
        title="By model"
        subtitle={`${rows.length} models in use · month-to-date`}
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
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Model</Th>
              <Th>Provider</Th>
              <Th align="right">Input tokens</Th>
              <Th align="right">Output tokens</Th>
              <Th align="right">Cost</Th>
              <Th align="right">% of total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model}>
                <Td mono style={{ color: "var(--ink)" }}>{r.model}</Td>
                <Td><ProviderTag provider={r.provider} /></Td>
                <Td align="right" mono style={{ color: "var(--ink-3)" }}>{fmtNum(r.input_tokens)}</Td>
                <Td align="right" mono style={{ color: "var(--ink-3)" }}>{fmtNum(r.output_tokens)}</Td>
                <Td align="right" mono style={{ fontWeight: 600, color: "var(--ink)" }}>{fmtUSD(r.cost)}</Td>
                <Td align="right" mono style={{ color: "var(--ink-3)" }}>
                  {((r.cost / total) * 100).toFixed(1)}%
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
