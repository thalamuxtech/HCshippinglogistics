import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || "https://highclassshippinglogistics.com";

// Staff and customer-data routes. /login included so the staff sign-in page is
// never indexed or surfaced in search for the public site.
const PRIVATE = ["/login", "/admin", "/office", "/dispatch", "/portal"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      // AI answer engines are named explicitly rather than left to the wildcard.
      // Being cited by AI Overviews, ChatGPT and Perplexity is now a real source
      // of enquiries, and several of these crawlers look for their own token
      // before falling back to "*". Listing them makes the permission
      // unambiguous, and keeps the private routes disallowed for them too.
      { userAgent: "Googlebot", allow: "/", disallow: PRIVATE },
      { userAgent: "Google-Extended", allow: "/", disallow: PRIVATE },
      { userAgent: "Bingbot", allow: "/", disallow: PRIVATE },
      { userAgent: "GPTBot", allow: "/", disallow: PRIVATE },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: PRIVATE },
      { userAgent: "ChatGPT-User", allow: "/", disallow: PRIVATE },
      { userAgent: "PerplexityBot", allow: "/", disallow: PRIVATE },
      { userAgent: "ClaudeBot", allow: "/", disallow: PRIVATE },
      { userAgent: "Applebot", allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
