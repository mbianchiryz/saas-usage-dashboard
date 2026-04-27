import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { MobileNavProvider } from "@/components/MobileNavProvider";

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
      <body className="app-shell">
        <MobileNavProvider>
          <Sidebar />
          <div className="app-main">
            <Topbar />
            <main className="app-content">
              <div className="app-content-inner">{children}</div>
            </main>
          </div>
        </MobileNavProvider>
      </body>
    </html>
  );
}
