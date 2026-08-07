import type { Metadata } from "next";

// Metadata lives in a layout because the page itself is a client component and
// client components cannot export metadata.
export const metadata: Metadata = {
  title: "Track Your Shipment",
  description:
    "Enter your Customer ID or tracking number to see your shipment stage, amount due, proof of delivery and downloadable invoices.",
  alternates: { canonical: "/track" },
  openGraph: {
    title: "Track Your Shipment",
    description: "Enter your Customer ID or tracking number to see your shipment stage, amount due, proof of delivery and downloadable invoices.",
    url: "/track",
    images: ["/og.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
