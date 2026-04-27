"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { Panel, SectionTitle, Pill } from "@/components/ui";
import { newBudgetId, describeScope, type Budget, type BudgetScope, type BudgetType } from "@/lib/budgets";
import type { Developer } from "@/lib/types";

export function BudgetsManager({ devs, teams }: { devs: Developer[]; teams: string[] }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* Load once */
  useEffect(() => {
    fetch("/api/budgets")
      .then((r) => r.json())
      .then((j) => setBudgets(j.budgets ?? []))
      .catch(() => setError("Could not load budgets"))
      .finally(() => setLoading(false));
  }, []);

  async function persist(next: Budget[]) {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgets: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setBudgets(next);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setEditing({
      id:        newBudgetId(),
      name:      "",
      scope:     "global",
      type:      "monthly",
      amount:    1000,
      warnAt:    80,
      createdAt: new Date().toISOString(),
    });
  }

  async function saveEditing() {
    if (!editing) return;
    if (!editing.name.trim() || editing.amount <= 0) {
      setError("Name and a positive amount are required.");
      return;
    }
    if ((editing.scope === "developer" || editing.scope === "team" || editing.scope === "provider") && !editing.scopeId) {
      setError("Pick a target for this scope.");
      return;
    }
    const exists = budgets.some((b) => b.id === editing.id);
    const next = exists ? budgets.map((b) => b.id === editing.id ? editing : b) : [...budgets, editing];
    await persist(next);
    setEditing(null);
  }

  async function deleteBudget(id: string) {
    if (!confirm("Delete this budget?")) return;
    await persist(budgets.filter((b) => b.id !== id));
  }

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {error && (
        <div style={{
          padding: "10px 14px", border: "1px solid var(--danger-soft)",
          background: "var(--danger-soft)", color: "var(--danger)",
          fontSize: 13, borderRadius: "var(--r-md)",
        }}>
          {error}
        </div>
      )}

      {/* Existing budgets list */}
      <Panel padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <SectionTitle sub={`${budgets.length} budget${budgets.length === 1 ? "" : "s"} configured`}>
            Active budgets
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
            <Plus size={13} /> New budget
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "32px 20px", color: "var(--ink-4)", fontSize: 13 }}>Loading…</div>
        ) : budgets.length === 0 && !editing ? (
          <div style={{ padding: "32px 20px", color: "var(--ink-4)", fontSize: 13 }}>
            No budgets yet. Click <strong>New budget</strong> to define your first one.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Scope</th>
                <th style={th}>Type</th>
                <th style={{ ...th, textAlign: "right" }}>Amount</th>
                <th style={{ ...th, textAlign: "right" }}>Warn at</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id}>
                  <td style={td}>
                    <span style={{ fontWeight: 500, color: "var(--ink)" }}>{b.name}</span>
                  </td>
                  <td style={td}>
                    <Pill tone="neutral" size="sm">{describeScope(b, devs)}</Pill>
                  </td>
                  <td style={td}>
                    {b.type === "monthly" ? "Monthly cap" : "Daily avg"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
                    ${b.amount.toLocaleString()}{b.type === "daily-avg" ? "/day" : "/mo"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-mono, monospace)", color: "var(--ink-3)" }}>
                    {b.warnAt}%
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={() => setEditing({ ...b })} style={iconBtn} title="Edit">
                        Edit
                      </button>
                      <button onClick={() => deleteBudget(b.id)} style={{ ...iconBtn, color: "var(--danger)" }} title="Delete">
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

      {/* Edit form */}
      {editing && (
        <Panel>
          <SectionTitle sub={budgets.some((b) => b.id === editing.id) ? "Edit existing rule" : "Define a new spending rule"}>
            {budgets.some((b) => b.id === editing.id) ? "Edit budget" : "New budget"}
          </SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 10 }}>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Name</label>
              <input
                style={inputStyle} placeholder="e.g. Engineering monthly cap"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Scope</label>
              <select
                style={inputStyle}
                value={editing.scope}
                onChange={(e) => setEditing({ ...editing, scope: e.target.value as BudgetScope, scopeId: undefined })}
              >
                <option value="global">All spend (org-wide)</option>
                <option value="provider">Specific provider</option>
                <option value="team">Specific team</option>
                <option value="developer">Specific developer</option>
              </select>
            </div>

            {/* Scope target dropdown */}
            <div>
              <label style={labelStyle}>Target</label>
              {editing.scope === "global" ? (
                <input style={{ ...inputStyle, color: "var(--ink-4)" }} disabled value="—" />
              ) : editing.scope === "provider" ? (
                <select style={inputStyle} value={editing.scopeId ?? ""} onChange={(e) => setEditing({ ...editing, scopeId: e.target.value })}>
                  <option value="">— pick a provider —</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                </select>
              ) : editing.scope === "team" ? (
                <select style={inputStyle} value={editing.scopeId ?? ""} onChange={(e) => setEditing({ ...editing, scopeId: e.target.value })}>
                  <option value="">— pick a team —</option>
                  {teams.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <select style={inputStyle} value={editing.scopeId ?? ""} onChange={(e) => setEditing({ ...editing, scopeId: e.target.value })}>
                  <option value="">— pick a developer —</option>
                  {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>

            <div>
              <label style={labelStyle}>Budget type</label>
              <select
                style={inputStyle}
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as BudgetType })}
              >
                <option value="monthly">Monthly cap (compares projection to limit)</option>
                <option value="daily-avg">Daily average (over rolling 7 days)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>{editing.type === "daily-avg" ? "Cap ($ per day)" : "Cap ($ per month)"}</label>
              <input
                style={inputStyle} type="number" min="0" step="10"
                value={editing.amount}
                onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
              />
            </div>

            <div>
              <label style={labelStyle}>Warn at (%)</label>
              <input
                style={inputStyle} type="number" min="0" max="200" step="5"
                value={editing.warnAt}
                onChange={(e) => setEditing({ ...editing, warnAt: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button
              onClick={saveEditing}
              disabled={saving}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", fontSize: 13, fontWeight: 500,
                border: "none", borderRadius: "var(--r-sm)",
                background: "var(--accent)", color: "#FFF", cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Save size={13} /> {saving ? "Saving…" : "Save budget"}
            </button>
            <button
              onClick={() => setEditing(null)}
              disabled={saving}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", fontSize: 13, fontWeight: 500,
                border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
                background: "var(--panel-2)", color: "var(--ink-2)", cursor: "pointer",
              }}
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </Panel>
      )}
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
