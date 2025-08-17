import "@/styles/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "FoxESS + RCE",
  description: "Oblicz zarobek z net-billingu na podstawie godzinowych cen RCE i energii oddanej (feedin).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className={`${inter.className} min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <header className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-black text-white grid place-items-center">⚡</div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{process.env.NEXT_PUBLIC_APP_NAME || "FoxESS + RCE"}</h1>
                  <p className="text-sm muted">Nowoczesny dashboard zarobku z net-billingu</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <a href="https://raporty.pse.pl/report/rce-pln" target="_blank" className="card px-3 py-2 text-sm hover:shadow">RCE (PSE)</a>
                <a href="https://www.foxesscloud.com" target="_blank" className="card px-3 py-2 text-sm hover:shadow">FoxESS Cloud</a>
                <ThemeToggle />
              </div>
            </div>
          </header>
          {children}
          <footer className="mt-10 text-xs muted">
            Dane: PSE (RCE PLN/MWh) & FoxESS Cloud.
          </footer>
        </div>
      </body>
    </html>
  );
}
