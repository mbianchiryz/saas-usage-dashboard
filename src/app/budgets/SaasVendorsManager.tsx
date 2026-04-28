"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { Panel, SectionTitle, Pill } from "@/components/ui";
import { CATEGORY_LABEL, type SaasCategory } from "@/lib/saas-classifier";
import { newVendorId, type SaasVendor } from "@/lib/saas-vendors";

const CATEGORIES: SaasCategory[] = [
  "all", "sales", "recruiting", "accounting", "it", "video", "dev", "hiptrain", "offsiteio", "ntrvsta", "other",
];

export function SaasVendorsManager() {
  const [vendors, setVendors] = useState<SaasVendor[]>([]);
  const [editing, setEditing] = useState<SaasVendor | null>(null);
  const [patternsString, setPatternsString] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* Sync the raw patterns string whenever we switch which vendor is being edited */
  useEffect(() => {
    setPatternsString(editing ? editing.patterns.join(", ") : "");
  }, [editing?.id]);

  useEffect(() => {
    fetch("/api/saas-vendors")
      .then((r) => r.json())
      .then((j) => setVendors(j.vendors ?? []))
      .catch(() => setError("Could not load vendors"))
      .finally(() => setLoading(false));
  }, []);

  async function persist(next: SaasVendor[]) {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/saas-vendors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendors: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setVendors(next);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setEditing({
      id:        newVendorId(),
      name:      "",
      category:  "other",
      patterns:  [],
      createdAt: new Date().toISOString(),
    });
  }

  async function saveEditing() {
    if (!editing) return;
    if (!editing.name.trim()) { setError("Name is required."); return; }
    /* Parse patterns from the raw input string at save time */
    const parsedPatterns = patternsString.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
    const clean: SaasVendor = { ...editing, patterns: parsedPatterns };
    const exists = vendors.some((v) => v.id === clean.id);
    const next   = exists ? vendors.map((v) => v.id === clean.id ? clean : v) : [...vendors, clean];
    await persist(next);
    setEditing(null);
  }

  async function deleteVendor(id: string) {
    if (!confirm("Remove this vendor from the catalog?")) return;
    await persist(vendors.filter((v) => v.id !== id));
  }

  /* Patterns input: keep the raw string in state so commas/spaces don't get
     stripped while typing. Parse on save. */

  /* ── styles ── */
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
    background: "var(--panel)", color: "var(--ink)",
    padding: "7px 10px", fontSize: 13, outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 500, color: "var(--ink-3)",
    letterSpacing: ".04em", textTransform: "uppercase",
    display: "block", marginBottom: 5,
  };

  const editorPanel = editing && (
    <Panel>
      <SectionTitle sub={vendors.some((v) => v.id === editing.id) ? "Edit vendor" : "Define a new vendor"}>
        {vendors.some((v) => v.id === editing.id) ? "Edit vendor" : "New vendor"}
      </SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 10 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} placeholder="e.g. Adobe" value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CATEGORIES.map((c) => {
              const active = editing.category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditing({ ...editing, category: c })}
                  style={{
                    padding: "6px 14px",
                    border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                    borderRadius: 999,
                    background: active ? "var(--ink)" : "var(--panel-2)",
                    color: active ? "var(--bg)" : "var(--ink-2)",
                    fontSize: 12, fontWeight: 500,
                    cursor: "pointer",
                    transition: "background .12s, color .12s, border-color .12s",
                  }}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>
            Match patterns (comma-separated; case-insensitive substrings or regex)
          </label>
          <input style={inputStyle} placeholder="e.g. adobe, creative cloud"
            value={patternsString} onChange={(e) => setPatternsString(e.target.value)} />
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 4 }}>
            Leave empty to rely on the built-in classifier. Patterns here are checked first
            and override defaults.
          </div>
        </div>

        <div>
          <label style={labelStyle}>Expected monthly cost (optional)</label>
          <input style={inputStyle} type="number" min="0" step="1"
            value={editing.expectedMonthly ?? ""}
            onChange={(e) => setEditing({ ...editing, expectedMonthly: e.target.value ? Number(e.target.value) : undefined })} />
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <input style={inputStyle} placeholder="e.g. shared seat, paid yearly"
            value={editing.notes ?? ""}
            onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={saveEditing} disabled={saving} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", fontSize: 13, fontWeight: 500,
          border: "none", borderRadius: "var(--r-sm)",
          background: "var(--accent)", color: "#FFF", cursor: "pointer",
          opacity: saving ? 0.6 : 1,
        }}>
          <Save size={13} /> {saving ? "Saving…" : "Save vendor"}
        </button>
        <button onClick={() => setEditing(null)} disabled={saving} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", fontSize: 13, fontWeight: 500,
          border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
          background: "var(--panel-2)", color: "var(--ink-2)", cursor: "pointer",
        }}>
          <X size={13} /> Cancel
        </button>
      </div>
    </Panel>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div style={{
          padding: "10px 14px", border: "1px solid var(--danger-soft)",
          background: "var(--danger-soft)", color: "var(--danger)",
          fontSize: 13, borderRadius: "var(--r-md)",
        }}>{error}</div>
      )}

      {editorPanel}

      <Panel padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <SectionTitle sub="Names defined here drive grouping on the SaaS tab. Patterns let you match Amex descriptions to a canonical vendor.">
            SaaS vendor catalog
          </SectionTitle>
          <button
            onClick={startCreate}
            disabled={saving || !!editing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", fontSize: 12, fontWeight: 500,
              border: "none", borderRadius: "var(--r-sm)",
              background: "var(--accent)", color: "#FFF",
              cursor: editing ? "default" : "pointer",
              opacity: editing ? 0.5 : 1,
            }}
          >
            <Plus size={13} /> New vendor
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "32px 20px", color: "var(--ink-4)", fontSize: 13 }}>Loading…</div>
        ) : vendors.length === 0 && !editing ? (
          <div style={{ padding: "32px 20px", color: "var(--ink-4)", fontSize: 13 }}>
            No vendors in the catalog. Click <strong>New vendor</strong> to add the first one
            (e.g. Adobe, ElevenLabs, AWS), or open the SaaS tab to bulk-import what was
            auto-detected from your Amex CSV.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Category</th>
                <th style={th}>Match patterns</th>
                <th style={{ ...th, textAlign: "right" }}>Expected / mo</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td style={td}>
                    <span style={{ fontWeight: 500, color: "var(--ink)" }}>{v.name}</span>
                  </td>
                  <td style={td}>
                    <Pill tone="neutral" size="sm">{CATEGORY_LABEL[v.category]}</Pill>
                  </td>
                  <td style={{ ...td, color: "var(--ink-3)", fontSize: 12, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.patterns.length === 0
                      ? <span style={{ color: "var(--ink-4)" }}>built-in only</span>
                      : v.patterns.join(", ")}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-mono, monospace)", color: v.expectedMonthly ? "var(--ink-2)" : "var(--ink-4)" }}>
                    {v.expectedMonthly ? `$${v.expectedMonthly.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={() => setEditing({ ...v })} style={iconBtn}>Edit</button>
                      <button onClick={() => deleteVendor(v.id)} style={{ ...iconBtn, color: "var(--danger)" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left",
  fontSize: 11, fontWeight: 500, letterSpacing: ".04em", textTransform: "uppercase",
  color: "var(--ink-4)", borderBottom: "1px solid var(--line)", background: "var(--panel)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "12px 16px", fontSize: 13, color: "var(--ink-2)",
  borderBottom: "1px solid var(--line)",
};
const iconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 10px", fontSize: 12, fontWeight: 500,
  border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
  background: "var(--panel-2)", color: "var(--ink-2)", cursor: "pointer",
};
