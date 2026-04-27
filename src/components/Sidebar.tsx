"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui";

const NAV = [
  { href: "/",           label: "Overview" },
  { href: "/developers", label: "Developers" },
  { href: "/models",     label: "Models" },
  { href: "/amex",       label: "Amex recon" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "var(--panel)",
      borderRight: "1px solid var(--line)",
      display: "flex", flexDirection: "column",
      padding: "20px 14px",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 22px" }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: "var(--ink)",
          display: "grid", placeItems: "center",
          color: "#FFF", fontWeight: 700, fontSize: 13, letterSpacing: "-0.02em",
        }}>L</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>Ledger</div>
          <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>AI spend</div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", padding: "0 8px 8px" }}>
        Workspace
      </div>

      {/* Nav links */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link key={n.href} href={n.href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 10px", borderRadius: 7,
                background: active ? "var(--ink)" : "transparent",
                color: active ? "#FFF" : "var(--ink-2)",
                fontSize: 13, fontWeight: 500,
                cursor: "pointer", transition: "background 120ms",
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: 999, flexShrink: 0,
                  background: active ? "#FFF" : "var(--ink-4)",
                  opacity: active ? 1 : 0.5,
                }} />
                {n.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer user */}
      <div style={{ marginTop: "auto", padding: "12px 8px", borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name="M Bianchi" size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>M. Bianchi</div>
            <div style={{ fontSize: 10, color: "var(--ink-4)" }}>Finance · Owner</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
