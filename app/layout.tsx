import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GROE — Resilience Platform",
  description: "Cybersecurity team burnout recovery platform by Green Shoe Consulting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
