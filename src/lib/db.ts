// ─────────────────────────────────────────────────────────────
// Firestore data-access layer — typed collection helpers.
// All reads/writes go through here so RBAC + shapes stay consistent.
// ─────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Shipment,
  StatusLog,
  AppUser,
  PriceListItem,
  DigitalReceipt,
  SailingNotice,
  NotificationLog,
  ContactInquiry,
  ActivityLog,
  ShipmentStatus,
  Role,
  InventoryItem,
  RoroDocument,
} from "./types";

export const COL = {
  users: "users",
  shipments: "shipments",
  statusLogs: "shipment_status_logs",
  priceList: "price_list",
  receipts: "digital_receipts",
  roroDocs: "roro_documents",
  sailingNotices: "sailing_notices",
  notifications: "notifications",
  usaInventory: "usa_inventory",
  destInventory: "destination_inventory",
  contact: "contact_inquiries",
  activity: "activity_log",
  siteContent: "site_content",
  counters: "counters",
} as const;

// ---- Atomic counter (tracking serials, access-code serials) ----
export async function nextCounter(name: string): Promise<number> {
  const ref = doc(db, COL.counters, name);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const next = current + 1;
    tx.set(ref, { value: next, updated_at: serverTimestamp() }, { merge: true });
    return next;
  });
}

// ---- Users ----
export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, COL.users, uid));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as AppUser) : null;
}

export async function createUserDoc(uid: string, data: Partial<AppUser>): Promise<void> {
  await setDoc(doc(db, COL.users, uid), {
    ...data,
    is_active: data.is_active ?? true,
    created_at: serverTimestamp(),
  });
}

export async function updateUserDoc(uid: string, data: Partial<AppUser>): Promise<void> {
  await updateDoc(doc(db, COL.users, uid), { ...data });
}

export async function listUsers(role?: Role): Promise<AppUser[]> {
  const cons: QueryConstraint[] = [];
  if (role) cons.push(where("role", "==", role));
  const snap = await getDocs(query(collection(db, COL.users), ...cons));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as AppUser);
}

// ---- Shipments ----
export async function createShipment(data: Partial<Shipment>): Promise<string> {
  const ref = await addDoc(collection(db, COL.shipments), {
    ...data,
    currency: data.currency ?? "USD",
    current_status: data.current_status ?? "collection",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function getShipment(id: string): Promise<Shipment | null> {
  const snap = await getDoc(doc(db, COL.shipments, id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as Shipment) : null;
}

export async function updateShipment(id: string, data: Partial<Shipment>): Promise<void> {
  await updateDoc(doc(db, COL.shipments, id), { ...data, updated_at: serverTimestamp() });
}

// Set payment status + deposit/balance for a shipment (admin/office).
export async function setPayment(
  id: string,
  params: { total: number; deposit: number }
): Promise<{ payment_status: "paid" | "partial" | "unpaid"; balance: number }> {
  const deposit = Math.max(0, Math.min(params.deposit, params.total));
  const balance = Math.round((params.total - deposit) * 100) / 100;
  const payment_status = balance <= 0 ? "paid" : deposit > 0 ? "partial" : "unpaid";
  await updateDoc(doc(db, COL.shipments, id), {
    deposit,
    balance,
    payment_status,
    paid_at: payment_status === "paid" ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  });
  return { payment_status, balance };
}

export async function listShipmentsByCustomer(customerId: string): Promise<Shipment[]> {
  const snap = await getDocs(
    query(
      collection(db, COL.shipments),
      where("customer_id", "==", customerId),
      orderBy("created_at", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Shipment);
}

export async function listShipments(constraints: QueryConstraint[] = []): Promise<Shipment[]> {
  const snap = await getDocs(query(collection(db, COL.shipments), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Shipment);
}

export async function listAllShipments(max = 500): Promise<Shipment[]> {
  const snap = await getDocs(
    query(collection(db, COL.shipments), orderBy("created_at", "desc"), fbLimit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Shipment);
}

// ---- Status logs (append-only) + advance stage ----
export async function advanceStage(params: {
  shipmentId: string;
  status: ShipmentStatus;
  notes?: string;
  updatedBy: string;
  updatedByName?: string;
  photos?: string[];
  docs?: string[];
}): Promise<void> {
  const { shipmentId, status, notes, updatedBy, updatedByName, photos, docs } = params;
  await addDoc(collection(db, COL.statusLogs), {
    shipment_id: shipmentId,
    status,
    notes: notes ?? "",
    updated_by: updatedBy,
    updated_by_name: updatedByName ?? "",
    photos: photos ?? [],
    docs: docs ?? [],
    created_at: serverTimestamp(),
  });
  await updateShipment(shipmentId, { current_status: status });
}

export async function listStatusLogs(shipmentId: string): Promise<StatusLog[]> {
  // Single-field query, then sort newest-first in memory so no composite index is required.
  const snap = await getDocs(
    query(collection(db, COL.statusLogs), where("shipment_id", "==", shipmentId))
  );
  const logs = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as object) }) as StatusLog
  );
  return logs.sort((a, b) => {
    const ta = (a.created_at as { seconds?: number } | undefined)?.seconds ?? 0;
    const tb = (b.created_at as { seconds?: number } | undefined)?.seconds ?? 0;
    return tb - ta;
  });
}

// ---- Price list ----
export async function listPriceItems(): Promise<PriceListItem[]> {
  const snap = await getDocs(query(collection(db, COL.priceList), orderBy("s_n", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as PriceListItem);
}

export async function upsertPriceItem(id: string, data: Partial<PriceListItem>): Promise<void> {
  await setDoc(doc(db, COL.priceList, id), data, { merge: true });
}

// ---- Receipts ----
export async function createReceipt(data: Partial<DigitalReceipt>): Promise<string> {
  const ref = await addDoc(collection(db, COL.receipts), {
    ...data,
    currency: data.currency ?? "USD",
    generated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function listReceiptsForShipment(shipmentId: string): Promise<DigitalReceipt[]> {
  const snap = await getDocs(
    query(collection(db, COL.receipts), where("shipment_id", "==", shipmentId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as DigitalReceipt);
}

/** All receipts across the whole platform (admin). Newest first. */
export async function listAllReceipts(max = 500): Promise<DigitalReceipt[]> {
  const snap = await getDocs(
    query(collection(db, COL.receipts), orderBy("generated_at", "desc"), fbLimit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as DigitalReceipt);
}

// Invoice deletion is handled server-side by the deleteReceiptPdf Cloud Function
// (Admin SDK) so it also removes the Storage PDF and cannot be blocked by rules.

/** All receipts across a customer's shipments, paired with the owning shipment. */
export async function listReceiptsForCustomer(
  customerId: string
): Promise<{ receipt: DigitalReceipt; shipment: Shipment }[]> {
  const shipments = await listShipmentsByCustomer(customerId);
  const perShipment = await Promise.all(
    shipments.map(async (s) => {
      const receipts = await listReceiptsForShipment(s.id);
      return receipts.map((receipt) => ({ receipt, shipment: s }));
    })
  );
  return perShipment.flat();
}

// ---- Sailing notices ----
export async function createSailingNotice(data: Partial<SailingNotice>): Promise<string> {
  const ref = await addDoc(collection(db, COL.sailingNotices), {
    ...data,
    sent_at: serverTimestamp(),
  });
  return ref.id;
}

export async function listSailingNotices(): Promise<SailingNotice[]> {
  const snap = await getDocs(
    query(collection(db, COL.sailingNotices), orderBy("sent_at", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as SailingNotice);
}

// ---- Notifications ----
export async function logNotification(data: Partial<NotificationLog>): Promise<void> {
  await addDoc(collection(db, COL.notifications), { ...data, created_at: serverTimestamp() });
}

export async function listNotificationsForCustomer(customerId: string): Promise<NotificationLog[]> {
  const snap = await getDocs(
    query(
      collection(db, COL.notifications),
      where("customer_id", "==", customerId),
      orderBy("created_at", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as NotificationLog);
}

// ---- Contact inquiries ----
export async function createInquiry(data: Partial<ContactInquiry>): Promise<string> {
  const ref = await addDoc(collection(db, COL.contact), {
    ...data,
    status: "new",
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function listInquiries(): Promise<ContactInquiry[]> {
  const snap = await getDocs(query(collection(db, COL.contact), orderBy("created_at", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as ContactInquiry);
}

export async function updateInquiry(id: string, data: Partial<ContactInquiry>): Promise<void> {
  await updateDoc(doc(db, COL.contact, id), { ...data });
}

// ---- Activity log (append-only) ----
export async function logActivity(data: Partial<ActivityLog>): Promise<void> {
  try {
    await addDoc(collection(db, COL.activity), { ...data, created_at: serverTimestamp() });
  } catch {
    // Non-fatal: activity logging should never break a user action.
  }
}

export async function listActivity(max = 100): Promise<ActivityLog[]> {
  const snap = await getDocs(
    query(collection(db, COL.activity), orderBy("created_at", "desc"), fbLimit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as ActivityLog);
}

// ---- Site content (marketing, admin-managed) ----
export async function getSiteContent(docId: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, COL.siteContent, docId));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function setSiteContent(docId: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db, COL.siteContent, docId), { ...data, updated_at: serverTimestamp() }, { merge: true });
}

// ---- Destination warehouse inventory (nigeria_office) ----
export async function listDestinationInventory(country?: string): Promise<InventoryItem[]> {
  const cons: QueryConstraint[] = [];
  if (country) cons.push(where("destination_country", "==", country));
  const snap = await getDocs(query(collection(db, COL.destInventory), ...cons));
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as InventoryItem);
  // Sort client-side by received_at desc so no composite index is required.
  return rows.sort((a, b) => {
    const at = a.received_at?.toMillis?.() ?? 0;
    const bt = b.received_at?.toMillis?.() ?? 0;
    return bt - at;
  });
}

export async function addInventoryItem(
  col: string,
  data: Partial<InventoryItem>
): Promise<string> {
  const ref = await addDoc(collection(db, col), {
    ...data,
    received_at: data.received_at ?? serverTimestamp(),
  });
  return ref.id;
}

export async function updateInventoryItem(
  col: string,
  id: string,
  data: Partial<InventoryItem>
): Promise<void> {
  await updateDoc(doc(db, col, id), { ...data });
}

// ---- RORO consignee documents ----
export async function listRoroDocs(constraints: QueryConstraint[] = []): Promise<RoroDocument[]> {
  const snap = await getDocs(query(collection(db, COL.roroDocs), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as RoroDocument);
}

export { serverTimestamp, Timestamp, where, orderBy, fbLimit as limit };
