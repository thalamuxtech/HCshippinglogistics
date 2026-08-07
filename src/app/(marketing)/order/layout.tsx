import type { Metadata } from "next";

// Metadata lives in a layout because the page itself is a client component and
// client components cannot export metadata.
export const metadata: Metadata = {
  title: "Start a Shipment: Get an Instant Sea, Air or RORO Quote",
  description:
    "Build your shipment and see the price as you go. Sea cargo priced per item, air freight by weight, RORO by vehicle class. No account needed to order.",
  alternates: { canonical: "/order" },
  openGraph: {
    title: "Start a Shipment: Get an Instant Sea, Air or RORO Quote",
    description: "Build your shipment and see the price as you go. Sea cargo priced per item, air freight by weight, RORO by vehicle class. No account needed to order.",
    url: "/order",
    images: ["/og.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
