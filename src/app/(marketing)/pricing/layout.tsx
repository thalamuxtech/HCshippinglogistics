import type { Metadata } from "next";

// Metadata lives in a layout because the page itself is a client component and
// client components cannot export metadata.
export const metadata: Metadata = {
  title: "Shipping Rates USA to Nigeria & Africa: Sea, Air & RORO Pricing",
  description:
    "Published per-item rates for sea cargo (boxes, barrels, bags, furniture), air freight per pound, and RORO vehicle shipping by line and class. No hidden fees.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Shipping Rates USA to Nigeria & Africa: Sea, Air & RORO Pricing",
    description: "Published per-item rates for sea cargo (boxes, barrels, bags, furniture), air freight per pound, and RORO vehicle shipping by line and class. No hidden fees.",
    url: "/pricing",
    images: ["/og.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
