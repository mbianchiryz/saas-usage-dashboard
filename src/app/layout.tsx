import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export const metadata: Metadata = {
  title: "SaaS Usage Dashboard",
  description: "Track Anthropic, OpenAI, and Amex spend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Topbar />
          <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px 60px", background: "var(--bg)" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto" }}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
