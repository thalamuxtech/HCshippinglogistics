import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || "https://highclassshippinglogistics.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/services/sea",
    "/services/air",
    "/services/roro",
    "/pricing",
    "/about",
    "/enterprise",
    "/contact",
    "/track",
    "/signup",
    "/login",
  ];
  return routes.map((r) => ({
    url: `${base}${r}`,
    changeFrequency: r === "" ? "weekly" : "monthly",
    priority: r === "" ? 1 : 0.7,
  }));
}
