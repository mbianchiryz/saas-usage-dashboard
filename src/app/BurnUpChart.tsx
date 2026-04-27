"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Panel, SectionTitle } from "@/components/ui";
import { fmtUSD } from "@/lib/format";

export interface BurnUpPoint {
  /** "DD" of the month for axis */
  day:        string;
  /** Cumulative actual spend through this day. Null on future days. */
  actual:     number | null;
  /** Linear target line (budget × day/totalDays). */
  target:     number;
}

interface Props {
  data:        BurnUpPoint[];
  budget:      number;
  budgetName:  string;
  /** Projection at month-end (extrapolated from current burn rate). */
  projected:   number;
}

export function BurnUpChart({ data, budget, budgetName, projected }: Props) {
  const onTrack = projected <= budget;
  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <SectionTitle sub={`Cumulative spend vs target line · ${budgetName}`}>
          Burn-up vs budget
        </SectionTitle>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>
            Projection
          </div>
          <div style={{
            fontSize: 18, fontWeight: 600,
            color: onTrack ? "var(--accent)" : "var(--danger)",
            fontVariantNumeric: "tabular-nums", marginTop: 2,
          }}>
            ${Math.round(projected).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
            of ${Math.round(budget).toLocaleString()} budget
          </div>
        </div>
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "var(--ink-4)" }} />
            <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "var(--ink-4)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number, n: string) => v == null ? ["—", n] : [fmtUSD(v), n]} />
            <ReferenceLine y={budget} stroke="var(--danger)" strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: `Budget $${budget.toLocaleString()}`, position: "insideTopRight", fontSize: 11, fill: "var(--danger)", fontWeight: 600 }} />
            <Line type="monotone" dataKey="target" name="Target pace" stroke="var(--ink-4)" strokeDasharray="2 2" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="actual" name="Actual"      stroke={onTrack ? "var(--accent)" : "var(--danger)"} strokeWidth={2.5} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
