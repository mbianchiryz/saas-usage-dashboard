"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Panel, SectionTitle, PROVIDER_HEX } from "@/components/ui";
import { fmtUSD } from "@/lib/format";

type Pt = { date: string; anthropic: number; openai: number };

export function DeveloperDetailCharts({ series }: { series: Pt[] }) {
  if (series.length < 2) {
    return (
      <Panel>
        <SectionTitle sub="Daily breakdown by provider">Daily spend</SectionTitle>
        <p style={{ fontSize: 13, color: "var(--ink-4)", margin: "8px 0 0" }}>
          Need at least two days of activity to draw a trend.
        </p>
      </Panel>
    );
  }

  const data = series.map((s) => ({ ...s, date: s.date.slice(5) /* MM-DD */ }));

  return (
    <Panel>
      <SectionTitle sub="Stacked daily spend by provider">Daily spend</SectionTitle>
      <div style={{ height: 240, marginTop: 6 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="dev-ant" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={PROVIDER_HEX.anthropic} stopOpacity={0.35} />
                <stop offset="100%" stopColor={PROVIDER_HEX.anthropic} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dev-oai" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={PROVIDER_HEX.openai} stopOpacity={0.35} />
                <stop offset="100%" stopColor={PROVIDER_HEX.openai} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "var(--ink-4)" }} />
            <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "var(--ink-4)" }} tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v: number, n: string) => [fmtUSD(v), n]} />
            <Area type="monotone" dataKey="anthropic" name="Anthropic" stackId="1" stroke={PROVIDER_HEX.anthropic} fill="url(#dev-ant)" strokeWidth={2} />
            <Area type="monotone" dataKey="openai"    name="OpenAI"    stackId="1" stroke={PROVIDER_HEX.openai}    fill="url(#dev-oai)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
