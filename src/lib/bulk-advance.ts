// ─────────────────────────────────────────────────────────────
// Bulk stage advance — shared by the admin and destination-office
// shipment lists so both portals enforce the SAME rules.
//
// Real ops move a whole batch through one stage at a time (a container
// clears customs, a vessel departs, a truck leaves the warehouse), so a
// single physical event should be one action instead of N manual edits.
// ─────────────────────────────────────────────────────────────

import { advanceStage, logNotification, logActivity } from "./db";
import { sendStageUpdateEmail } from "./notify";
import { STAGE_MAP, stageOrder } from "./constants";
import type { Shipment, ShipmentStatus, Role } from "./types";

// Destination office is limited to the destination half of the lifecycle
// (stages 5-8), mirroring the per-shipment detail pages. Admin may set any stage.
export const OFFICE_MIN_STAGE = 5;

export function stagesForRole(role: Role): ShipmentStatus[] {
  const all = Object.values(STAGE_MAP)
    .slice()
    .sort((a, b) => a.order - b.order);
  const allowed = role === "admin" ? all : all.filter((s) => s.order >= OFFICE_MIN_STAGE);
  return allowed.map((s) => s.key);
}

export type BulkSkipReason = "already-at-stage" | "backward" | "not-allowed-for-role";

export interface BulkPlanEntry {
  shipment: Shipment;
  skip?: BulkSkipReason;
}

export interface BulkPlan {
  advance: Shipment[];
  skipped: { shipment: Shipment; reason: BulkSkipReason }[];
}

/**
 * Decide what a bulk advance would actually do, WITHOUT writing anything.
 * Splitting the decision from the execution lets the UI show the operator
 * exactly what will change (and what will not) before they commit.
 *
 * Skips, rather than errors, because a mixed batch is the normal case: an
 * operator selects a whole container and some items are already at the target
 * stage. Silently re-advancing those would spam customers with duplicate
 * emails and pollute the audit trail with no-op entries.
 */
export function planBulkAdvance(
  shipments: Shipment[],
  target: ShipmentStatus,
  role: Role
): BulkPlan {
  const allowed = new Set(stagesForRole(role));
  const targetOrder = stageOrder(target);
  const plan: BulkPlan = { advance: [], skipped: [] };

  for (const s of shipments) {
    if (!allowed.has(target)) {
      plan.skipped.push({ shipment: s, reason: "not-allowed-for-role" });
      continue;
    }
    if (s.current_status === target) {
      plan.skipped.push({ shipment: s, reason: "already-at-stage" });
      continue;
    }
    // Never walk a shipment backwards in bulk. Correcting a mistake is a
    // deliberate, per-shipment decision made on the detail page.
    if (stageOrder(s.current_status) > targetOrder) {
      plan.skipped.push({ shipment: s, reason: "backward" });
      continue;
    }
    plan.advance.push(s);
  }
  return plan;
}

export const SKIP_LABEL: Record<BulkSkipReason, string> = {
  "already-at-stage": "already at this stage",
  backward: "would move backwards",
  "not-allowed-for-role": "stage not permitted for your role",
};

export interface BulkFailure {
  shipment: Shipment;
  stage: "advance" | "notify";
  message: string;
}

export interface BulkResult {
  advanced: Shipment[];
  failures: BulkFailure[];
  skipped: { shipment: Shipment; reason: BulkSkipReason }[];
  notified: number;
  notifyFailed: number;
}

// Email pacing: transactional providers rate-limit bursts, and a 40-barrel
// container would otherwise fire 40 sends at once. Send in small batches with a
// short gap — a stage update is not latency-critical.
const EMAIL_BATCH = 5;
const EMAIL_GAP_MS = 350;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Execute a bulk advance. Each shipment gets its OWN append-only status-log
 * entry (via advanceStage) so the audit trail stays per-shipment, and a failure
 * on one shipment never aborts the rest — the caller receives the per-shipment
 * failures so it can tell the operator exactly which ones need attention.
 */
export async function runBulkAdvance(params: {
  shipments: Shipment[];
  target: ShipmentStatus;
  notes?: string;
  notify: boolean;
  actor: { id: string; full_name: string; role: Role };
  onProgress?: (done: number, total: number) => void;
}): Promise<BulkResult> {
  const { shipments, target, notes, notify, actor, onProgress } = params;
  const plan = planBulkAdvance(shipments, target, actor.role);

  const result: BulkResult = {
    advanced: [],
    failures: [],
    skipped: plan.skipped,
    notified: 0,
    notifyFailed: 0,
  };

  const total = plan.advance.length;
  let done = 0;
  onProgress?.(0, total);

  // Phase 1 — advance every shipment (the operation that must not be lost).
  for (const ship of plan.advance) {
    try {
      await advanceStage({
        shipmentId: ship.id,
        status: target,
        notes: notes?.trim() || undefined,
        updatedBy: actor.id,
        updatedByName: actor.full_name,
      });
      result.advanced.push(ship);
    } catch (e) {
      result.failures.push({
        shipment: ship,
        stage: "advance",
        message: e instanceof Error ? e.message : "Update failed",
      });
    }
    done += 1;
    onProgress?.(done, total);
  }

  // Phase 2 — notify, paced, and only for shipments that actually advanced.
  if (notify && result.advanced.length > 0) {
    for (let i = 0; i < result.advanced.length; i += EMAIL_BATCH) {
      const batch = result.advanced.slice(i, i + EMAIL_BATCH);
      await Promise.all(
        batch.map(async (ship) => {
          try {
            const res = await sendStageUpdateEmail({
              shipmentId: ship.id,
              customerId: ship.customer_id,
              status: target,
              extraNote: notes?.trim() || undefined,
            });
            if (res?.ok === false) throw new Error("Provider rejected the send");
            result.notified += 1;
            await logNotification({
              customer_id: ship.customer_id,
              shipment_id: ship.id,
              channel: "email",
              type: "stage_update",
              subject: `Shipment ${ship.tracking_number} → ${STAGE_MAP[target].label}`,
              status: "sent",
            });
          } catch (e) {
            result.notifyFailed += 1;
            result.failures.push({
              shipment: ship,
              stage: "notify",
              message: e instanceof Error ? e.message : "Email failed",
            });
            // Record the attempt so the notification log reflects reality.
            try {
              await logNotification({
                customer_id: ship.customer_id,
                shipment_id: ship.id,
                channel: "email",
                type: "stage_update",
                subject: `Shipment ${ship.tracking_number} → ${STAGE_MAP[target].label}`,
                status: "failed",
              });
            } catch {
              /* logging must never break the batch */
            }
          }
        })
      );
      if (i + EMAIL_BATCH < result.advanced.length) await sleep(EMAIL_GAP_MS);
    }
  }

  // One audit entry summarising the batch (each shipment already has its own log).
  if (result.advanced.length > 0) {
    try {
      await logActivity({
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: `bulk-advanced ${result.advanced.length} shipment${
          result.advanced.length !== 1 ? "s" : ""
        } to ${STAGE_MAP[target].short}`,
        meta: {
          count: result.advanced.length,
          status: target,
          failed: result.failures.length,
          skipped: result.skipped.length,
          notified: result.notified,
        },
      });
    } catch {
      /* audit summary is best-effort */
    }
  }

  return result;
}
