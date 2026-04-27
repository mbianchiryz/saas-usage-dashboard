export function Topbar() {
  return (
    <header style={{
      height: 56, flexShrink: 0,
      borderBottom: "1px solid var(--line)",
      background: "var(--panel)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-3)" }}>
        <span>Workspace</span>
        <span style={{ color: "var(--ink-4)" }}>/</span>
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>AI spend</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 8,
          background: "var(--panel-2)", border: "1px solid var(--line)",
          fontSize: 12, color: "var(--ink-4)", minWidth: 220,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search developers, models…
          <span style={{ marginLeft: "auto", fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "var(--panel)", border: "1px solid var(--line)", color: "var(--ink-3)" }}>
            ⌘K
          </span>
        </div>
        <button style={{
          background: "var(--accent)", color: "#FFF", border: "none",
          fontSize: 12, fontWeight: 500, padding: "7px 14px",
          borderRadius: 8, cursor: "pointer",
        }}>
          Share with leadership
        </button>
      </div>
    </header>
  );
}
