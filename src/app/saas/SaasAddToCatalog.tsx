"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { newVendorId, type SaasVendor } from "@/lib/saas-vendors";
import type { SaasCategory } from "@/lib/saas-classifier";

export function SaasAddToCatalog({ name, category }: { name: string; category: SaasCategory }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function add() {
    if (busy) return;
    setBusy(true);
    try {
      const cur = await fetch("/api/saas-vendors").then((r) => r.json()).catch(() => ({ vendors: [] }));
      const existing: SaasVendor[] = Array.isArray(cur.vendors) ? cur.vendors : [];

      // Avoid duplicates by name
      if (existing.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
        setDone(true);
        router.refresh();
        return;
      }

      const next: SaasVendor[] = [...existing, {
        id:        newVendorId(),
        name,
        category,
        patterns:  [name], // seed with the canonical name as a pattern
        createdAt: new Date().toISOString(),
      }];

      const res = await fetch("/api/saas-vendors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendors: next }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500 }}>✓ Added</span>;
  }

  return (
    <button
      onClick={add}
      disabled={busy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "5px 10px", fontSize: 11, fontWeight: 500,
        border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
        background: "var(--panel-2)", color: "var(--ink-2)",
        cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
      }}
      title="Add this vendor to the catalog"
    >
      <Plus size={11} /> {busy ? "Adding…" : "Add to catalog"}
    </button>
  );
}
