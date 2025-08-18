import "./globals.css";
import type { Metadata } from "next";
import "./theme.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "FoxESS + RCE Dashboard",
  description: "PV eksport & ceny RCE – zarobek, wykresy, tabela",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div>
      </body>
    </html>
  );
}
