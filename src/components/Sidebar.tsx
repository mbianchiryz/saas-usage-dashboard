"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Cpu, CreditCard } from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/developers", label: "By Developer", icon: Users },
  { href: "/models", label: "By Model", icon: Cpu },
  { href: "/amex", label: "Amex Reconciliation", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-8 px-2">
        <div className="text-lg font-semibold">SaaS Usage</div>
        <div className="text-xs text-neutral-500">Dashboard</div>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-white",
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 text-xs text-neutral-600">
        <div>Mock data · 90 days</div>
        <div>Swap to Supabase when ready</div>
      </div>
    </aside>
  );
}
