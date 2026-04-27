"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { fmtUSD } from "@/lib/format";

export interface DailyPoint {
  date: string;
  anthropic: number;
  openai: number;
}

export function SpendOverTimeChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="antF" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D97757" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#D97757" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="oaiF" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10A37F" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#10A37F" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickFormatter={(v) => v.slice(5)} />
          <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => fmtUSD(v, { compact: true })} />
          <Tooltip
            contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 6 }}
            labelStyle={{ color: "#a3a3a3" }}
            formatter={(v: number, n: string) => [fmtUSD(v), n]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="anthropic" name="Anthropic" stroke="#D97757" fill="url(#antF)" strokeWidth={2} />
          <Area type="monotone" dataKey="openai" name="OpenAI" stroke="#10A37F" fill="url(#oaiF)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
