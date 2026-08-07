import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || "https://highclassshippinglogistics.com";

// Priority reflects commercial value, not page count: the service and pricing
// pages are what people search for and are where conversions start, so they rank
// above the trust pages, which in turn rank above the utility pages. A sitemap
// where everything is 0.7 tells a crawler nothing about what matters.
const ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[0]["changeFrequency"] }[] =
  [
    { path: "", priority: 1.0, freq: "weekly" },
    { path: "/services/sea", priority: 0.9, freq: "monthly" },
    { path: "/services/air", priority: 0.9, freq: "monthly" },
    { path: "/services/roro", priority: 0.9, freq: "monthly" },
    // Pricing changes whenever the admin edits the price list, and it is a heavily
    // searched page ("cost to ship a barrel to Nigeria"), so it is crawled often.
    { path: "/pricing", priority: 0.9, freq: "weekly" },
    { path: "/order", priority: 0.8, freq: "monthly" },
    { path: "/enterprise", priority: 0.7, freq: "monthly" },
    { path: "/about", priority: 0.6, freq: "monthly" },
    { path: "/contact", priority: 0.6, freq: "monthly" },
    { path: "/track", priority: 0.5, freq: "monthly" },
    { path: "/privacy", priority: 0.2, freq: "yearly" },
  ];

export default function sitemap(): MetadataRoute.Sitemap {
  // Build time is the honest answer for a statically exported site: it is when
  // the deployed content last actually changed.
  const lastModified = new Date();
  return ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
