// ─────────────────────────────────────────────────────────────
// Highclass Shipping, Domain Types
// ─────────────────────────────────────────────────────────────

import type { Timestamp } from "firebase/firestore";

export type Role = "admin" | "nigeria_office" | "dispatcher" | "customer";

export type ServiceType = "sea" | "air" | "roro";

export type VehicleClass = "class_a" | "class_b" | "class_c";

export type ShippingLine = "grimaldi" | "sallaum" | "msc";

export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface Receiver {
  full_name: string;
  phone: string;
  address?: string;
  city?: string;
}

// 8-stage lifecycle (ordered)
export type ShipmentStatus =
  | "collection"
  | "inspection"
  | "loading"
  | "transit"
  | "clearance"
  | "offloading"
  | "delivery"
  | "completed";

export interface AppUser {
  id: string; // durable customer_id / uid, never reassigned
  email: string;
  phone?: string;
  full_name: string;
  role: Role;
  assigned_country?: string; // for nigeria_office (and future country offices)
  access_code_hash?: string;
  access_code_prefix?: string;
  access_code_issued_at?: Timestamp | null;
  access_code_version?: number;
  birth_year_month?: string; // YYMM
  zip_code?: string;
  dob?: string; // YYYY-MM-DD (public order flow)
  age?: number | null; // computed from dob, backend record only
  address?: string; // sender full address
  customer_code?: string;
  // Per-user menu/feature overrides for staff. null/undefined = role defaults;
  // otherwise the exact set of FeatureKeys this user may access (bounded by role).
  allowed_features?: string[] | null;
  is_active: boolean;
  deleted?: boolean;
  notify_email?: boolean;
  notify_sms?: boolean;
  created_at?: Timestamp | null;
}

export interface Dimensions {
  length?: number;
  width?: number;
  height?: number;
}

export interface ShipmentItem {
  price_list_id?: string;
  description: string;
  category?: string;
  dimensions?: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  /**
   * Customer-described item that is not on the price list. Carried at 0 until the
   * office sets a price, so it is visible on the order rather than dropped.
   */
  needs_quote?: boolean;
}

export interface Shipment {
  id: string;
  tracking_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  service_type: ServiceType;
  items?: ShipmentItem[]; // sea cargo line items
  item_category?: string;
  // Customer-declared fragile cargo. Surfaced to the warehouse, the destination
  // office and the rider so handling instructions travel with the shipment.
  fragile?: boolean;
  fragile_note?: string;
  dimensions?: Dimensions;
  weight?: number; // lbs (air)
  dimensional_weight?: number; // lbs (air)
  declared_value?: number;
  current_status: ShipmentStatus;
  vehicle_class?: VehicleClass | null;
  vehicle_details?: string;
  curb_weight?: number;
  destination_country: string;
  destination_city?: string;
  shipping_line?: ShippingLine | null;
  door_to_door?: boolean;
  pickup_address?: string;
  delivery_address?: string;
  assigned_dispatcher_id?: string | null;
  // Container assignment: the vessel container carrying this shipment, e.g. "15" / "19B".
  container_number?: string | null;
  container_shipped_on?: string | null; // ISO date the container sailed (YYYY-MM-DD)
  // Do Not Release: packages must be withheld at the destination warehouse until
  // cleared (typically pay-on-delivery / unpaid balance). Auto-set from payment,
  // with a manual admin override.
  dnr?: boolean;
  dnr_override?: boolean | null; // null = follow payment; true/false = manual lock
  // Dispatcher-raised request to lift a DNR hold; admin reviews and clears it.
  dnr_release_requested?: boolean;
  dnr_release_requested_by?: string | null;
  dnr_release_requested_by_name?: string | null;
  dnr_release_requested_at?: Timestamp | null;
  dnr_release_note?: string | null;
  total_price: number;
  currency: string;
  // ── Pricing adjustments set by staff after the order is placed ──
  // Pickup is quoted, not fixed: the cost depends on distance and volume, so the
  // customer is told at signup that it will be added, and staff set it here.
  pickup_fee?: number;
  pickup_fee_pending?: boolean;
  /** Discount as a percentage of the pre-discount subtotal, or a flat amount. */
  discount_type?: "percent" | "amount" | null;
  discount_value?: number;
  discount_reason?: string;
  /** Money actually taken off, stored so the invoice and portal agree exactly. */
  discount_amount?: number;
  /** Subtotal before discount, items + pickup. Kept for a clear breakdown. */
  subtotal?: number;
  // Payment
  payment_status?: PaymentStatus;
  deposit?: number;
  balance?: number;
  paid_at?: Timestamp | null;
  // Receiver / consignee (for the receipt)
  receiver?: Receiver;
  // ── Hand-over record (who released the cargo, and how) ──
  // Materialized onto the shipment when it is completed so admin lists can show
  // "delivered by" without reading the per-shipment status log. The append-only
  // log remains the authoritative audit trail.
  handover_method?: "delivery" | "warehouse_pickup";
  delivered_by?: string | null; // uid of the rider / office staff who released it
  delivered_by_name?: string | null;
  delivered_at?: Timestamp | null;
  /** Who physically took the goods, signed for at the door or at the counter. */
  received_by_name?: string | null;
  proof_photos?: string[];
  // Latest generated receipt (for quick access)
  receipt_number?: string;
  receipt_pdf_url?: string;
  notes?: string;
  created_at?: Timestamp | null;
  updated_at?: Timestamp | null;
}

export interface StatusLog {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  notes?: string;
  updated_by: string;
  updated_by_name?: string;
  photos?: string[];
  docs?: string[];
  created_at?: Timestamp | null;
}

export interface PriceListItem {
  id: string;
  s_n: number;
  dimensions: string;
  description: string;
  price: number;
  category: string;
  effective_date: string;
}

export interface DigitalReceipt {
  id: string;
  shipment_id: string;
  receipt_number: string;
  generated_at?: Timestamp | null;
  generated_by: string;
  pdf_url?: string;
  amount: number;
  deposit?: number;
  balance?: number;
  payment_status?: PaymentStatus;
  currency: string;
}

export interface RoroDocument {
  id: string;
  shipment_id: string;
  title_url?: string;
  exporter_id?: string;
  consignee_details?: { name: string; address: string; phone: string };
  shipping_line: ShippingLine;
  vehicle_class: VehicleClass;
  curb_weight?: number;
}

export interface SailingNotice {
  id: string;
  sent_by: string;
  subject: string;
  body: string;
  filters: {
    service_type?: ServiceType;
    shipping_line?: ShippingLine;
    destination?: string;
    container_number?: string;
  };
  recipient_count: number;
  recipient_ids: string[];
  sent_at?: Timestamp | null;
}

export interface NotificationLog {
  id: string;
  customer_id: string;
  shipment_id?: string;
  channel: "email" | "sms";
  type: string;
  subject?: string;
  status: "sent" | "delivered" | "failed" | "queued";
  created_at?: Timestamp | null;
}

export interface InventoryItem {
  id: string;
  shipment_id: string;
  tracking_number?: string;
  item_description: string;
  destination_country?: string;
  received_at?: Timestamp | null;
  dispatched_at?: Timestamp | null;
  location_notes?: string;
}

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  inquiry_type?: string;
  status: "new" | "in_progress" | "closed";
  created_at?: Timestamp | null;
}

export interface ActivityLog {
  id: string;
  actor_id: string;
  actor_name?: string;
  actor_role?: Role;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
  created_at?: Timestamp | null;
}
