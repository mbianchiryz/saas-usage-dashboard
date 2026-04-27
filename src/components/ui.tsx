import { ReactNode, CSSProperties } from "react";

// ─── Design tokens ──────────────────────────────────────────────────────────
export const PROVIDER_HEX   = { anthropic: "#7C3AED", openai: "#0F766E" } as const;
export const PROVIDER_SOFT  = { anthropic: "#F3E8FF", openai: "#CCFBF1" } as const;
export const PROVIDER_LABEL = { anthropic: "Anthropic", openai: "OpenAI" } as const;

// ─── Panel ──────────────────────────────────────────────────────────────────
export function Panel({
  children, style, padding = 24, className,
}: {
  children: ReactNode; style?: CSSProperties; padding?: number | string; className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--panel)", border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)", padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Eyebrow ─────────────────────────────────────────────────────────────────
export function Eyebrow({ children, color = "var(--ink-3)" }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase", color }}>
      {children}
    </div>
  );
}

// ─── Pill ────────────────────────────────────────────────────────────────────
type PillTone = "neutral" | "accent" | "warn" | "danger" | "dark" | "anth" | "oai";
const PILL_TONES: Record<PillTone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: "var(--panel-2)",       fg: "var(--ink-2)",    bd: "var(--line)" },
  accent:  { bg: "var(--accent-soft)",   fg: "var(--accent)",   bd: "transparent" },
  warn:    { bg: "var(--warn-soft)",     fg: "var(--warn)",     bd: "transparent" },
  danger:  { bg: "var(--danger-soft)",   fg: "var(--danger)",   bd: "transparent" },
  dark:    { bg: "var(--ink)",           fg: "#FFF",            bd: "transparent" },
  anth:    { bg: "var(--p-anthropic-soft)", fg: "var(--p-anthropic)", bd: "transparent" },
  oai:     { bg: "var(--p-openai-soft)",    fg: "var(--p-openai)",    bd: "transparent" },
};
export function Pill({ children, tone = "neutral", size = "md" }: { children: ReactNode; tone?: PillTone; size?: "sm" | "md" }) {
  const t = PILL_TONES[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: size === "sm" ? "2px 8px" : "4px 10px",
      borderRadius: 999,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
      fontSize: size === "sm" ? 11 : 12, fontWeight: 500, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
export function Sparkline({
  values, color = "var(--ink-2)", width = 80, height = 28, fill = false,
}: { values: number[]; color?: string; width?: number; height?: number; fill?: boolean }) {
  if (!values.length) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as [number, number];
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `M0,${height} L${pts.map(([x, y]) => `${x},${y}`).join(" L")} L${width},${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {fill && <path d={area} fill={color} fillOpacity="0.12" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Metric tile ─────────────────────────────────────────────────────────────
export function Metric({
  label, value, delta, deltaTone = "neutral", sub, sparkline,
}: {
  label: string; value: string;
  delta?: string; deltaTone?: "up" | "down" | "neutral";
  sub?: ReactNode; sparkline?: ReactNode;
}) {
  const deltaColor = deltaTone === "up" ? "var(--accent)" : deltaTone === "down" ? "var(--danger)" : "var(--ink-3)";
  return (
    <Panel padding={20}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
        <div className="tnum" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--ink)", lineHeight: 1 }}>
          {value}
        </div>
        {sparkline}
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        {delta && (
          <span className="tnum" style={{ color: deltaColor, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 3 }}>
            {deltaTone === "up"   && <span>▲</span>}
            {deltaTone === "down" && <span>▼</span>}
            {delta}
          </span>
        )}
        {sub && <span style={{ color: "var(--ink-3)" }}>{sub}</span>}
      </div>
    </Panel>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────
export function PageHeader({
  title, subtitle, right, scriptAccent,
}: { title: string; subtitle?: string; right?: ReactNode; scriptAccent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--ink)", display: "flex", alignItems: "baseline", gap: 10 }}>
          {title}
          {scriptAccent && (
            <span className="serif" style={{ color: "var(--ink-3)", fontSize: 28 }}>{scriptAccent}</span>
          )}
        </h1>
        {subtitle && <div style={{ marginTop: 6, fontSize: 14, color: "var(--ink-3)" }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{right}</div>}
    </div>
  );
}

// ─── Section title ───────────────────────────────────────────────────────────
export function SectionTitle({ children, sub, right }: { children: ReactNode; sub?: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>{children}</div>
        {sub && <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-3)" }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
const AVATAR_PALETTES: [string, string][] = [
  ["#EEF2FF","#3730A3"], ["#FCE7F3","#9D174D"], ["#ECFDF5","#065F46"],
  ["#FEF3C7","#92400E"], ["#E0F2FE","#075985"], ["#F3E8FF","#6B21A8"],
  ["#FFE4E6","#9F1239"], ["#F0FDFA","#115E59"],
];
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  let h = 0; for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  const [bg, fg] = AVATAR_PALETTES[h % AVATAR_PALETTES.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: bg, color: fg,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0, letterSpacing: "-0.01em",
    }}>
      {initials}
    </div>
  );
}

// ─── Ratio bar ───────────────────────────────────────────────────────────────
export function RatioBar({ a, b, total, height = 6 }: { a: number; b: number; total: number; height?: number }) {
  return (
    <div style={{ width: "100%", height, borderRadius: 999, overflow: "hidden", background: "var(--panel-2)", display: "flex" }}>
      <div style={{ height: "100%", width: `${(a / total) * 100}%`, background: PROVIDER_HEX.anthropic }} />
      <div style={{ height: "100%", width: `${(b / total) * 100}%`, background: PROVIDER_HEX.openai }} />
    </div>
  );
}

// ─── Provider tag ────────────────────────────────────────────────────────────
export function ProviderTag({ provider }: { provider: "anthropic" | "openai" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: provider === "anthropic" ? "var(--p-anthropic-soft)" : "var(--p-openai-soft)",
      color: provider === "anthropic" ? "var(--p-anthropic)" : "var(--p-openai)",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: PROVIDER_HEX[provider] }} />
      {PROVIDER_LABEL[provider]}
    </span>
  );
}

// ─── Table helpers ───────────────────────────────────────────────────────────
export function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th style={{
      padding: "10px 16px", textAlign: align,
      fontSize: 11, fontWeight: 500, letterSpacing: ".04em", textTransform: "uppercase",
      color: "var(--ink-4)", borderBottom: "1px solid var(--line)", background: "var(--panel)",
      whiteSpace: "nowrap",
    }}>
      {children}
    </th>
  );
}
export function Td({
  children, align = "left", style, mono = false,
}: { children: ReactNode; align?: "left" | "right" | "center"; style?: CSSProperties; mono?: boolean }) {
  return (
    <td
      className={mono ? "mono" : undefined}
      style={{ padding: "12px 16px", textAlign: align, fontSize: 13, color: "var(--ink-2)", borderBottom: "1px solid var(--line)", ...style }}
    >
      {children}
    </td>
  );
}

// ─── Ghost button style ──────────────────────────────────────────────────────
export const btnGhost: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px", borderRadius: 8,
  background: "var(--panel)", border: "1px solid var(--line)",
  fontSize: 12, fontWeight: 500, color: "var(--ink-2)", cursor: "pointer",
};
