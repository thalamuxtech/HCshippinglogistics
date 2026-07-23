// ─────────────────────────────────────────────────────────────
// Highclass Shipping — Business Constants
// Single source of truth for pricing, stages, services, and rates.
// Mirrors the Implementation Plan sections 5, 6, 8, 11.
// ─────────────────────────────────────────────────────────────

import type { ShipmentStatus, ServiceType, ShippingLine, VehicleClass } from "./types";

// ---- 8-Stage Shipment Lifecycle ----
export interface StageMeta {
  key: ShipmentStatus;
  order: number;
  label: string;
  short: string;
  description: string;
  color: string; // hex for badges/timeline
  colorName: string;
  side: "usa" | "transit" | "destination";
}

export const STAGES: StageMeta[] = [
  {
    key: "collection",
    order: 1,
    label: "Collection (USA)",
    short: "Collection",
    description: "Item picked up from customer or dropped off at USA warehouse.",
    color: "#6366F1",
    colorName: "Indigo",
    side: "usa",
  },
  {
    key: "inspection",
    order: 2,
    label: "Inspection (USA Warehouse)",
    short: "Inspection",
    description: "Item inspected, weighed, dimensioned, documented, and receipted.",
    color: "#F59E0B",
    colorName: "Amber",
    side: "usa",
  },
  {
    key: "loading",
    order: 3,
    label: "Loading (USA Port / Freight)",
    short: "Loading",
    description: "Item loaded onto vessel or flight at the US port or airport.",
    color: "#3B82F6",
    colorName: "Blue",
    side: "usa",
  },
  {
    key: "transit",
    order: 4,
    label: "Transit (Ocean / Air / RORO)",
    short: "Transit",
    description: "Shipment is en route to the destination country.",
    color: "#8B5CF6",
    colorName: "Purple",
    side: "transit",
  },
  {
    key: "clearance",
    order: 5,
    label: "Clearance (Destination Customs)",
    short: "Clearance",
    description: "Shipment is being processed through customs at the destination country.",
    color: "#F97316",
    colorName: "Orange",
    side: "destination",
  },
  {
    key: "offloading",
    order: 6,
    label: "Offloading (Destination Warehouse)",
    short: "Offloading",
    description: "Shipment has arrived at the destination country warehouse or port.",
    color: "#06B6D4",
    colorName: "Cyan",
    side: "destination",
  },
  {
    key: "delivery",
    order: 7,
    label: "Delivery / Pickup",
    short: "Delivery",
    description: "Shipment dispatched for last-mile delivery or available for pickup.",
    color: "#14B8A6",
    colorName: "Teal",
    side: "destination",
  },
  {
    key: "completed",
    order: 8,
    label: "Completed",
    short: "Completed",
    description: "Shipment successfully delivered to the recipient.",
    color: "#22C55E",
    colorName: "Green",
    side: "destination",
  },
];

export const STAGE_MAP: Record<ShipmentStatus, StageMeta> = STAGES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s }),
  {} as Record<ShipmentStatus, StageMeta>
);

export function stageOrder(status: ShipmentStatus): number {
  return STAGE_MAP[status]?.order ?? 0;
}

// ---- Services ----
export const SERVICES: Record<
  ServiceType,
  { label: string; tagline: string; leadTime: string }
> = {
  sea: {
    label: "Sea Cargo",
    tagline: "Containerized ocean freight for boxes, barrels, bags, and furniture.",
    leadTime: "21–30 business weeks after departure",
  },
  air: {
    label: "Air Freight",
    tagline: "Expedited air shipping for time-sensitive cargo.",
    leadTime: "7–10 business days",
  },
  roro: {
    label: "RORO Vehicle Shipping",
    tagline: "Roll-on, roll-off vehicle transport to African ports.",
    leadTime: "Varies by shipping line & route",
  },
};

// ---- Air Freight rate ----
export const AIR_RATE_PER_LB = 5.5;
// Dimensional weight divisor (industry standard for air freight, cubic inches)
export const DIM_WEIGHT_DIVISOR = 166;

// ---- RORO rates by shipping line ----
export const RORO_LINES: Record<
  ShippingLine,
  { label: string; classA: number; classB: number; classC: string }
> = {
  grimaldi: { label: "Grimaldi Lines", classA: 1400, classB: 1400, classC: "Quoted by volume/dimensions" },
  sallaum: { label: "Sallaum Lines", classA: 1380, classB: 1380, classC: "Quoted by volume/dimensions" },
  msc: { label: "MSC (Mediterranean Shipping Company)", classA: 1400, classB: 1400, classC: "Quoted by volume/dimensions" },
};

export const VEHICLE_CLASSES: Record<VehicleClass, { label: string; basis: string }> = {
  class_a: { label: "Class A: Small & Midsize SUV", basis: "Curb weight ≤ 4,000 lbs" },
  class_b: { label: "Class B: Big-size SUV", basis: "Curb weight > 4,000 lbs" },
  class_c: { label: "Class C: Trucks & Trailers", basis: "Priced by volume and dimensions" },
};

// ---- Destination countries ----
export const DESTINATION_COUNTRIES = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "Cameroon",
  "Senegal",
];

// ---- Sea Cargo Price List (all 28 items, effective Jan 1, 2024) ----
export interface SeedPriceItem {
  s_n: number;
  dimensions: string;
  description: string;
  price: number;
  category: string;
}

export const SEA_PRICE_LIST: SeedPriceItem[] = [
  { s_n: 1, dimensions: "16×12×12", description: "Small Box", price: 35, category: "Box" },
  { s_n: 2, dimensions: "18×18×16", description: "Medium Box", price: 50, category: "Box" },
  { s_n: 3, dimensions: "18×18×24", description: "Large Box", price: 65, category: "Box" },
  { s_n: 4, dimensions: "24×18×24", description: "Extra Large Box", price: 90, category: "Box" },
  { s_n: 5, dimensions: "18×18×28", description: "Dish Barrel Box", price: 100, category: "Box" },
  { s_n: 6, dimensions: "24×24×24", description: "Medium Electronic Box", price: 110, category: "Box" },
  { s_n: 7, dimensions: "24×24×27", description: "Large Electronic Box", price: 150, category: "Box" },
  { s_n: 8, dimensions: "24×20×34", description: "Shorty Wardrobe Box", price: 160, category: "Box" },
  { s_n: 9, dimensions: "24×21×46", description: "Wardrobe Box", price: 220, category: "Box" },
  { s_n: 10, dimensions: "50 Gallon / 4ft", description: "Barrel (Tall)", price: 220, category: "Barrel" },
  { s_n: 11, dimensions: "30 Gallon / 3ft", description: "Barrel (Short)", price: 200, category: "Barrel" },
  { s_n: 12, dimensions: "30 Inch Bag", description: "Black Bag (Large)", price: 100, category: "Bag" },
  { s_n: 13, dimensions: "36 Inch Bag", description: "Black Bag (Ex-Large)", price: 130, category: "Bag" },
  { s_n: 14, dimensions: "21×13×9 – 28 inch", description: "Suitcase", price: 80, category: "Suitcase" },
  { s_n: 15, dimensions: "27 Gallon", description: "Tote Large", price: 70, category: "Tote" },
  { s_n: 16, dimensions: "29 Gallon", description: "Tote Ex-Large", price: 90, category: "Tote" },
  { s_n: 17, dimensions: "40 Gallon", description: "Tote Biggest", price: 200, category: "Tote" },
  { s_n: 18, dimensions: "18×18×24", description: "Large Ghana Must Go", price: 60, category: "Bag" },
  { s_n: 19, dimensions: "24×18×24", description: "Ex-Large Ghana Must Go", price: 100, category: "Bag" },
  { s_n: 20, dimensions: "Light Weight", description: "White Sack", price: 60, category: "Sack" },
  { s_n: 21, dimensions: "Heavy Weight", description: "White Sack", price: 80, category: "Sack" },
  { s_n: 22, dimensions: "Light Weight", description: "Grey Sack", price: 120, category: "Sack" },
  { s_n: 23, dimensions: '35"–42"', description: "TV", price: 120, category: "TV" },
  { s_n: 24, dimensions: '50"–60"', description: "TV", price: 250, category: "TV" },
  { s_n: 25, dimensions: '65"–70"', description: "TV", price: 300, category: "TV" },
  { s_n: 26, dimensions: '75"', description: "TV", price: 400, category: "TV" },
  { s_n: 27, dimensions: '80"', description: "TV", price: 650, category: "TV" },
  { s_n: 28, dimensions: "Varies", description: "Furniture Set", price: 1400, category: "Furniture" },
];

export const PRICE_CATEGORIES = Array.from(new Set(SEA_PRICE_LIST.map((i) => i.category)));

// ---- Company info (managed content defaults) ----
export const COMPANY = {
  name: "Highclass Shipping and Logistics Inc.",
  shortName: "Highclass Shipping",
  slogan: "Excellence in handling your valuables.",
  tagline: "Shipping from the USA to Nigeria & across Africa",
  fmcLicensedSince: "2017",
  registration: "FMC-licensed since 2017 · Registered in Maryland, USA & Nigeria (CAC)",
  domain: "highclassshippinglogistics.com",
  webApp: "highclassshippinglogistics.web.app",
  email: "info@highclassshippinglogistics.com",
  usa: {
    label: "USA Office & Warehouse",
    lines: ["6600 Foxley Road", "Gate C", "Upper Marlboro, Maryland 20772"],
    phones: ["+1 (240) 374-8394", "+1 (240) 499-6237"],
  },
  nigeria: {
    label: "Nigeria Office",
    lines: [
      "28 Moleye Street, Alagomeji",
      "(Behind Sweet Sensation), Along Herbert Macaulay Way",
      "Yaba, Lagos",
    ],
    phones: ["+234 808 029 1754", "+234 704 393 7111"],
  },
  storagePolicy: {
    freeDays: 7,
    dailyChargeNaira: 7000,
  },
  terms: [
    "Shipment to Nigeria is solely at the shipper's risk.",
    "The company disclaims responsibility for damage or loss during shipment.",
    "Free storage for 7 days after arrival; ₦7,000 daily storage applies thereafter.",
  ],
};

// ---- Air freight helper ----
export function computeAirPrice(
  weightLb: number,
  dims?: { length: number; width: number; height: number }
): { billableWeight: number; dimWeight: number; price: number } {
  const actual = Math.max(0, weightLb || 0);
  let dimWeight = 0;
  if (dims && dims.length && dims.width && dims.height) {
    dimWeight = (dims.length * dims.width * dims.height) / DIM_WEIGHT_DIVISOR;
  }
  const billableWeight = Math.max(actual, dimWeight);
  return {
    billableWeight: Math.round(billableWeight * 100) / 100,
    dimWeight: Math.round(dimWeight * 100) / 100,
    price: Math.round(billableWeight * AIR_RATE_PER_LB * 100) / 100,
  };
}
