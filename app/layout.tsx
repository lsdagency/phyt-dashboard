import type { Metadata } from "next";
import "./globals.css";

const APP_NAME = process.env.APP_NAME || "PHYT";

export const metadata: Metadata = {
  title: `${APP_NAME} · App Store Ads Dashboard`,
  description: "Live Apple Search Ads, revenue and product analytics reporting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
