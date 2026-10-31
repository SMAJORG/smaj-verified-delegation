import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMAJ AI | Unified Task Platform",
  description: "Meta-powered planning, approval, and independently verified actions across the SMAJ PI HUB ecosystem.",
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
