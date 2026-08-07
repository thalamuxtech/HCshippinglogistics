import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { OrganizationSchema } from "@/components/marketing/StructuredData";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Organisation + WebSite schema, emitted once for every marketing page.
          Search engines and AI answer engines read this to identify the business,
          its two branches and the countries it serves. */}
      <OrganizationSchema />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
