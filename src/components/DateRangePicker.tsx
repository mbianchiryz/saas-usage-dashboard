"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown } from "lucide-react";
import { parseRange, PRESET_OPTIONS, presetRange, type Preset } from "@/lib/dateRange";

export function DateRangePicker() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const range = parseRange(searchParams);

  /* Custom-range scratch state — only synced to URL on Apply */
  const [draftFrom, setDraftFrom] = useState(range.from);
  const [draftTo,   setDraftTo]   = useState(range.to);
  useEffect(() => { setDraftFrom(range.from); setDraftTo(range.to); }, [range.from, range.to]);

  /* Click-outside */
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function applyParams(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function pickPreset(p: Preset) {
    const r = presetRange(p);
    applyParams({ preset: p, from: r.from, to: r.to });
    setOpen(false);
  }

  function applyCustom() {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    applyParams({ preset: "custom", from: draftFrom, to: draftTo });
    setOpen(false);
  }

  /* ── styles ── */
  const triggerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 12px",
    border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
    background: "var(--panel-2)", color: "var(--ink)",
    fontSize: 12, fontWeight: 500, cursor: "pointer",
    transition: "background .15s",
  };
  const presetBtn = (active: boolean): React.CSSProperties => ({
    width: "100%", textAlign: "left",
    padding: "7px 10px", borderRadius: "var(--r-sm)",
    border: "none",
    background: active ? "var(--panel-2)" : "transparent",
    color: active ? "var(--ink)" : "var(--ink-2)",
    fontSize: 12, fontWeight: active ? 500 : 400,
    cursor: "pointer", transition: "background .12s",
  });
  const inputStyle: React.CSSProperties = {
    flex: 1, minWidth: 0, padding: "5px 8px",
    border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
    background: "var(--panel)", color: "var(--ink)",
    fontSize: 12, outline: "none", colorScheme: "light dark",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={triggerStyle}>
        <Calendar size={13} style={{ color: "var(--ink-3)" }} />
        <span>{range.label}</span>
        <ChevronDown size={12} style={{ color: "var(--ink-4)" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40,
          width: 260, padding: 8,
          border: "1px solid var(--line)", borderRadius: "var(--r-md)",
          background: "var(--panel)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.10)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {PRESET_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => pickPreset(opt.value)} style={presetBtn(range.preset === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", margin: "8px -8px 8px" }} />

          <div style={{ padding: "0 2px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 6 }}>
              Custom
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} style={inputStyle} />
              <span style={{ color: "var(--ink-4)", fontSize: 11 }}>→</span>
              <input type="date" value={draftTo}   onChange={(e) => setDraftTo(e.target.value)}   style={inputStyle} />
            </div>
            <button
              onClick={applyCustom}
              style={{
                width: "100%", padding: "7px 10px",
                border: "none", borderRadius: "var(--r-sm)",
                background: "var(--accent)", color: "#FFF",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}
            >
              Apply custom range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
