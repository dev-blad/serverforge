import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/providers";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { ConsentScripts } from "@/components/layout/consent-scripts";
import { store } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${store.name} — Padel Rackets, Balls & Kit | UK Padel Shop`, template: `%s | ${store.name}` },
  description:
    "Independent UK padel shop. Padel rackets for every level, tour balls by the tube or box, and expert advice. Free UK delivery over £50, same-day dispatch before 2pm.",
  applicationName: store.name,
  openGraph: { type: "website", siteName: store.name, locale: "en_GB", url: siteUrl, images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#0d3b2e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="min-h-dvh font-sans">
        <Providers>
          {children}
          <CookieBanner />
          <ConsentScripts />
        </Providers>
      </body>
    </html>
  );
}
