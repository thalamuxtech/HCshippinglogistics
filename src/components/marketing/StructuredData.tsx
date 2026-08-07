// ─────────────────────────────────────────────────────────────
// JSON-LD structured data.
//
// Two audiences, one job:
//  - Google, for rich results (business panel, breadcrumbs, FAQ accordions) and
//    for Local/Maps eligibility via the two physical addresses.
//  - AI answer engines (AI Overviews, ChatGPT, Perplexity), which lean heavily on
//    schema.org to decide *what a site is* and whether to cite it. Prose alone
//    leaves them guessing; explicit types, areaServed and offer data do not.
//
// Rendered as a plain <script> tag rather than next/script: this must be in the
// server-rendered HTML so a crawler that does not execute JavaScript still sees
// it, which is exactly the case for several AI crawlers.
// ─────────────────────────────────────────────────────────────

import { COMPANY } from "@/lib/constants";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://highclassshippinglogistics.com";

/** One <script type="application/ld+json"> with the given object. */
function Ld({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // The payload is our own static data, never user input, so there is no
      // injection surface here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Organisation + both branches, emitted once site-wide from the marketing layout.
 * MovingCompany is the closest schema.org type for freight forwarding and is what
 * makes the business eligible for a local/knowledge panel.
 */
export function OrganizationSchema() {
  const org = {
    "@context": "https://schema.org",
    "@type": ["Organization", "MovingCompany"],
    "@id": `${SITE}/#organization`,
    name: COMPANY.name,
    alternateName: COMPANY.shortName,
    url: SITE,
    logo: `${SITE}/brand/icon-512.png`,
    image: `${SITE}/og.png`,
    description:
      "FMC-licensed freight forwarder shipping sea cargo, air freight and vehicles (RORO) from the USA to Nigeria and across Africa, with 8-stage tracking and digital invoices.",
    email: COMPANY.email,
    foundingDate: COMPANY.fmcLicensedSince,
    slogan: COMPANY.slogan,
    // Both branches. Multiple addresses are what makes the business
    // discoverable in each country rather than only the country of origin.
    address: [
      {
        "@type": "PostalAddress",
        streetAddress: COMPANY.usa.lines[0],
        addressLocality: "Upper Marlboro",
        addressRegion: "MD",
        postalCode: "20774",
        addressCountry: "US",
      },
      {
        "@type": "PostalAddress",
        streetAddress: COMPANY.nigeria.lines[0],
        addressLocality: "Yaba, Lagos",
        addressRegion: "Lagos",
        addressCountry: "NG",
      },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: COMPANY.usa.phones[0],
        contactType: "customer service",
        areaServed: "US",
        availableLanguage: ["English"],
      },
      {
        "@type": "ContactPoint",
        telephone: COMPANY.nigeria.phones[0],
        contactType: "customer service",
        areaServed: "NG",
        availableLanguage: ["English"],
      },
    ],
    areaServed: [
      { "@type": "Country", name: "Nigeria" },
      { "@type": "Country", name: "Ghana" },
      { "@type": "Country", name: "Kenya" },
      { "@type": "Country", name: "South Africa" },
      { "@type": "Country", name: "Cameroon" },
      { "@type": "Country", name: "Senegal" },
      { "@type": "Country", name: "United States" },
    ],
    knowsAbout: [
      "Sea cargo shipping",
      "Air freight",
      "RORO vehicle shipping",
      "Barrel shipping to Nigeria",
      "Customs clearance",
      "Freight forwarding",
    ],
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "license",
      name: "FMC Licensed Freight Forwarder",
      recognizedBy: {
        "@type": "GovernmentOrganization",
        name: "Federal Maritime Commission",
      },
    },
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    url: SITE,
    name: COMPANY.shortName,
    publisher: { "@id": `${SITE}/#organization` },
    // Lets Google offer a shipment-tracking search box directly in results.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE}/track?id={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <Ld data={org} />
      <Ld data={website} />
    </>
  );
}

/** A single service page (sea / air / RORO). */
export function ServiceSchema({
  name,
  description,
  path,
  serviceType,
}: {
  name: string;
  description: string;
  path: string;
  serviceType: string;
}) {
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "Service",
        name,
        description,
        serviceType,
        url: `${SITE}${path}`,
        provider: { "@id": `${SITE}/#organization` },
        areaServed: [
          { "@type": "Country", name: "Nigeria" },
          { "@type": "Country", name: "Ghana" },
          { "@type": "Country", name: "Kenya" },
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: `${name} rates`,
          url: `${SITE}/pricing`,
        },
      }}
    />
  );
}

/**
 * Breadcrumbs. Google renders these in place of a bare URL, which measurably
 * improves click-through on deep pages.
 */
export function BreadcrumbSchema({
  trail,
}: {
  trail: { name: string; path: string }[];
}) {
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: trail.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: `${SITE}${c.path}`,
        })),
      }}
    />
  );
}

/**
 * FAQ. This is the single highest-leverage schema for AI answer engines: a
 * question-and-answer pair is exactly the shape they quote, so it is the most
 * likely part of the site to be cited verbatim.
 */
export function FaqSchema({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  return (
    <Ld
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }}
    />
  );
}
