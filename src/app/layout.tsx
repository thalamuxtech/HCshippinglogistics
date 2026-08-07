import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { IdleTimeout } from "@/components/providers/IdleTimeout";
import { ToastProvider } from "@/components/ui/toast";
import { COMPANY } from "@/lib/constants";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://highclassshippinglogistics.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${COMPANY.name}: ${COMPANY.tagline}`,
    template: `%s · ${COMPANY.shortName}`,
  },
  description:
    "FMC-licensed (since 2017) USA-to-Africa freight forwarder. Sea Cargo, Air Freight, and RORO vehicle shipping to Nigeria and across Africa. Real-time tracking, digital receipts, and secure portal access.",
  keywords: [
    "USA to Africa shipping",
    "Nigeria freight forwarder",
    "sea cargo",
    "air freight",
    "RORO vehicle shipping",
    "FMC licensed",
    "barrel shipping Nigeria",
  ],
  applicationName: COMPANY.shortName,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
    ],
    apple: "/brand/icon-192.png",
  },
  // Canonical for the home page. The site answers on two hosts, so every page
  // declares which URL should carry the ranking signals.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: `${COMPANY.name}: ${COMPANY.tagline}`,
    description:
      "FMC-licensed USA-to-Africa freight forwarder. Sea cargo, air freight and RORO vehicle shipping to Nigeria and across Africa, with 8-stage tracking and digital invoices.",
    siteName: COMPANY.shortName,
    url: siteUrl,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${COMPANY.shortName}: shipping from the USA to Nigeria and across Africa`,
      },
    ],
  },
  // Without this, links shared on X/Twitter render as a bare URL with no image.
  twitter: {
    card: "summary_large_image",
    title: `${COMPANY.name}`,
    description: COMPANY.tagline,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Allow full-length text snippets, large image previews and full video
      // previews. Google defaults are conservative, and richer previews earn more
      // clicks and give AI answer engines more to quote.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1E3A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <ToastProvider>
          <AuthProvider>
            {children}
            {/* Renders nothing unless a staff session is active; inside
                AuthProvider so it can read that session. */}
            <IdleTimeout />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
