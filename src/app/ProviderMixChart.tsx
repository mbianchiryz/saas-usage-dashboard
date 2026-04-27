"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Panel, SectionTitle, PROVIDER_HEX } from "@/components/ui";

export function ProviderMixChart({ ant, oai }: { ant: number; oai: number }) {
  const total = ant + oai;
  const data = [
    { name: "Anthropic", value: ant,  fill: PROVIDER_HEX.anthropic },
    { name: "OpenAI",    value: oai,  fill: PROVIDER_HEX.openai    },
  ];
  return (
    <Panel>
      <SectionTitle sub="Share of total spend">Provider mix</SectionTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 130, height: 130, position: "relative", flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={62} stroke="var(--panel)" strokeWidth={2}>
                {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}>
            <div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".06em" }}>Total</div>
            <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              ${Math.round(total).toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {data.map((d) => (
            <div key={d.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: d.fill }} />
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{d.name}</span>
              </div>
              <div className="tnum" style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {((d.value / total) * 100).toFixed(0)}%
              </div>
              <div className="tnum" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                ${Math.round(d.value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
