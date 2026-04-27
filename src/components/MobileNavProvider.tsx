"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type Ctx = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };
const MobileNavCtx = createContext<Ctx>({ open: false, setOpen: () => {}, toggle: () => {} });

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /* Auto-close the drawer on navigation */
  useEffect(() => { setOpen(false); }, [pathname]);

  /* Lock body scroll while drawer is open */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <MobileNavCtx.Provider value={{ open, setOpen, toggle: () => setOpen((v) => !v) }}>
      {children}
    </MobileNavCtx.Provider>
  );
}

export const useMobileNav = () => useContext(MobileNavCtx);
