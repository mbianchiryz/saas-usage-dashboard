"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Card } from "@/components/Card";
import { fmtUSD, fmtNum } from "@/lib/format";

interface ModelRow {
  model: string;
  provider: "anthropic" | "openai";
  cost: number;
  input_tokens: number;
  output_tokens: number;
}

const COLORS = { anthropic: "#D97757", openai: "#10A37F" };

export default function ModelsPage() {
  const [rows, setRows] = useState<ModelRow[]>([]);

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then(setRows);
  }, []);

  const total = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">By Model</h1>
        <p className="text-sm text-neutral-400">MTD spend breakdown across models</p>
      </div>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-medium">Cost per model</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="model" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => fmtUSD(v, { compact: true })} />
              <Tooltip
                contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 6 }}
                formatter={(v: number) => fmtUSD(v)}
              />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                {rows.map((r, i) => <Cell key={i} fill={COLORS[r.provider]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="py-3 pr-4">Model</th>
              <th className="py-3 pr-4">Provider</th>
              <th className="py-3 pr-4 text-right">Input tokens</th>
              <th className="py-3 pr-4 text-right">Output tokens</th>
              <th className="py-3 pr-4 text-right">Cost</th>
              <th className="py-3 pr-4 text-right">% of total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model} className="border-b border-neutral-900 last:border-0">
                <td className="py-3 pr-4 font-mono text-xs">{r.model}</td>
                <td className="py-3 pr-4">
                  <span
                    className="inline-block rounded px-2 py-0.5 text-xs"
                    style={{ background: `${COLORS[r.provider]}22`, color: COLORS[r.provider] }}
                  >
                    {r.provider}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-neutral-400">{fmtNum(r.input_tokens)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-neutral-400">{fmtNum(r.output_tokens)}</td>
                <td className="py-3 pr-4 text-right tabular-nums font-medium">{fmtUSD(r.cost)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-neutral-400">
                  {((r.cost / total) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
