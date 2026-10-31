import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMAJ AI — Verified Delegation",
  description: "Turn goals into actionable plans with Meta AI. Approve delegated tasks, recover from failures, and verify outcomes with proof receipts. Part of SMAJ PI HUB, built for the Pi Network Ecosystem.",
  icons: {
    icon: { url: "/image.png", type: "image/png", sizes: "1254x1254" },
    apple: { url: "/image.png", type: "image/png", sizes: "1254x1254" },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
