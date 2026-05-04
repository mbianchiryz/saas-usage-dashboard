"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Panel, SectionTitle, PROVIDER_HEX, PROVIDER_LABEL } from "@/components/ui";
import { fmtUSD } from "@/lib/format";

interface Props {
  series: { date: string; anthropic: number; openai: number }[];
  burn: number;
  rangeLabel?: string;
}

export function OverviewCharts({ series, burn, rangeLabel }: Props) {
  return (
    <Panel padding={24} style={{ marginBottom: 24 }}>
      <SectionTitle
        sub={`Stacked by provider${rangeLabel ? ` · ${rangeLabel.toLowerCase()}` : ""}`}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "var(--ink-3)" }}>
            <span>
              Burn rate{" "}
              <span className="tnum" style={{ color: "var(--ink)", fontWeight: 600, marginLeft: 4 }}>
                {fmtUSD(burn)}/day
              </span>
            </span>
            {(["anthropic", "openai"] as const).map((p) => (
              <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: PROVIDER_HEX[p] }} />
                {PROVIDER_LABEL[p]}
              </span>
            ))}
          </div>
        }
      >
        Daily spend
      </SectionTitle>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="antG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PROVIDER_HEX.anthropic} stopOpacity={0.18} />
                <stop offset="100%" stopColor={PROVIDER_HEX.anthropic} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="oaiG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PROVIDER_HEX.openai} stopOpacity={0.18} />
                <stop offset="100%" stopColor={PROVIDER_HEX.openai} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => fmtUSD(v, { compact: true })} />
            <Tooltip formatter={(v: number, n: string) => [fmtUSD(v), PROVIDER_LABEL[n as keyof typeof PROVIDER_LABEL] ?? n]} />
            <Area type="monotone" dataKey="anthropic" stroke={PROVIDER_HEX.anthropic} fill="url(#antG)" strokeWidth={1.75} />
            <Area type="monotone" dataKey="openai"    stroke={PROVIDER_HEX.openai}    fill="url(#oaiG)" strokeWidth={1.75} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
