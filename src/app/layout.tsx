import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
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
  openGraph: {
    type: "website",
    title: `${COMPANY.name}`,
    description: COMPANY.tagline,
    siteName: COMPANY.shortName,
    url: siteUrl,
  },
  robots: { index: true, follow: true },
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
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
