import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Base Search",
  description: "Search Farcaster posts and Base activity",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
