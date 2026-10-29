import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMAJ Verified Delegation",
  description: "Meta-powered, authorized, independently verified actions for SMAJ PI HUB.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
