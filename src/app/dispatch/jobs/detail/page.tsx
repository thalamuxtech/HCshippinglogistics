"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Package,
  Camera,
  CheckCircle2,
  AlertTriangle,
  X,
  Truck,
  Lock,
  Container,
} from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/components/providers/AuthProvider";
import { getShipment, advanceStage, requestDnrRelease } from "@/lib/db";
import { sendStageUpdateEmail } from "@/lib/notify";
import type { Shipment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { PageLoader, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { isDnr } from "@/lib/utils";

function DispatchJobDetailPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id") ?? "";
  const { user } = useAuth();
  const toast = useToast();

  const [job, setJob] = React.useState<Shipment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);

  const loadJob = React.useCallback(async () => {
    const s = await getShipment(id);
    // A dispatcher may open any shipment that has arrived at the destination
    // (offloading / delivery / completed), or one explicitly assigned to them.
    const arrived = s && ["offloading", "delivery", "completed"].includes(s.current_status);
    return s && (arrived || s.assigned_dispatcher_id === user?.id) ? s : null;
  }, [id, user?.id]);

  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const s = await loadJob();
        if (active) setJob(s);
      } catch {
        if (active) setJob(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadJob, user?.id]);

  React.useEffect(() => {
    // Clean up object URLs on unmount / change.
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPhotos((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function handleDelivered() {
    if (!job || !user) return;
    if (isDnr(job)) {
      toast.error("On hold", "This shipment is Do-Not-Release until the office clears it.");
      return;
    }
    setSubmitting(true);
    try {
      // Upload proof-of-delivery photos to Storage.
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const path = `shipments/${job.id}/pod/${Date.now()}_${i}_${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        urls.push(await getDownloadURL(storageRef));
      }

      await advanceStage({
        shipmentId: job.id,
        status: "completed",
        notes: notes.trim() || "Delivered by dispatcher.",
        updatedBy: user.id,
        updatedByName: user.full_name,
        photos: urls,
      });

      await sendStageUpdateEmail({
        shipmentId: job.id,
        customerId: job.customer_id,
        status: "completed",
        extraNote: notes.trim() || undefined,
      });

      toast.success("Delivered!", "Marked complete and customer notified.");
      router.push("/dispatch/completed");
    } catch {
      toast.error("Could not complete", "Check your connection and try again.");
      setSubmitting(false);
    }
  }

  async function handleRequestRelease() {
    if (!job || !user) return;
    setRequesting(true);
    try {
      await requestDnrRelease(job.id, { id: user.id, name: user.full_name }, notes.trim() || undefined);
      const s = await loadJob();
      setJob(s);
      toast.success("Release requested", "The office has been asked to lift the hold.");
    } catch {
      toast.error("Could not send request", "Please try again.");
    } finally {
      setRequesting(false);
    }
  }

  if (loading) return <PageLoader label="Loading job…" />;

  if (!job) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="Job not found"
        description="This job may have been reassigned or completed."
        action={
          <Button variant="outline" onClick={() => router.push("/dispatch")}>
            <ArrowLeft className="h-4 w-4" /> Back to jobs
          </Button>
        }
      />
    );
  }

  const alreadyDone = job.current_status === "completed";
  const onHold = isDnr(job);
  // The admin controls when a rider can deliver: only actionable once the
  // shipment reaches the "delivery" stage AND it is not on a Do-Not-Release hold.
  const readyToDeliver = job.current_status === "delivery" && !onHold;

  return (
    <div className="space-y-5">
      <Link
        href="/dispatch"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-navy focus-ring rounded-md"
      >
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>

      {/* Job summary */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Truck className="h-5 w-5 text-gold" />
          <span className="font-mono text-lg font-bold text-navy">{job.tracking_number}</span>
          {job.container_number && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              <Container className="h-3.5 w-3.5" /> CNT #{job.container_number}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <p className="text-base font-semibold leading-snug text-navy">
              {job.receiver?.address ||
                job.delivery_address ||
                [job.destination_city, job.destination_country].filter(Boolean).join(", ") ||
                "Pickup at warehouse"}
            </p>
          </div>

          {(() => {
            const rName = job.receiver?.full_name || job.customer_name || "Recipient";
            const rPhone = job.receiver?.phone || job.customer_phone || "";
            return (
              <a
                href={rPhone ? `tel:${rPhone}` : undefined}
                className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-base text-ink active:bg-secondary/50 focus-ring"
              >
                <Phone className="h-5 w-5 shrink-0 text-navy" />
                <span className="font-medium">
                  {rName}
                  {rPhone ? ` · ${rPhone}` : ""}
                </span>
              </a>
            );
          })()}

          <div className="flex items-start gap-2.5">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
            <span className="text-sm text-ink-muted">
              {job.items?.length
                ? job.items
                    .map((it) => `${it.quantity && it.quantity > 1 ? `${it.quantity}x ` : ""}${it.description}`)
                    .join(", ")
                : job.item_category || job.vehicle_details || "Shipment items"}
            </span>
          </div>

          {job.notes && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">{job.notes}</span>
            </div>
          )}
        </div>
      </div>

      {alreadyDone ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
          <span className="text-base font-semibold text-emerald-700">
            This delivery is already completed.
          </span>
        </div>
      ) : onHold ? (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
            <div>
              <p className="text-base font-semibold text-red-800">
                Do Not Release (DNR), payment outstanding
              </p>
              <p className="mt-0.5 text-sm text-red-700">
                Do not hand over this package. Ask the office to lift the hold before releasing it.
              </p>
            </div>
          </div>

          {job.dnr_release_requested ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Release requested. Waiting for the office to lift the hold.
            </div>
          ) : (
            <>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note for the office (e.g. customer is here to collect)"
                className="bg-white"
              />
              <Button
                variant="primary"
                onClick={handleRequestRelease}
                loading={requesting}
                disabled={requesting}
                className="w-full"
              >
                <Lock className="h-4 w-4" /> Request release from office
              </Button>
            </>
          )}
        </div>
      ) : !readyToDeliver ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <p className="text-base font-semibold text-amber-800">Not ready for delivery yet</p>
            <p className="mt-0.5 text-sm text-amber-700">
              The office will move this shipment to the delivery stage when it is ready for you.
              You will be able to complete it then.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 rounded-2xl border border-border bg-white p-5 shadow-card">
          {/* Proof of delivery */}
          <div>
            <Label>Proof of delivery (photo)</Label>
            <label className="mt-1 flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/30 p-4 text-center transition-colors active:bg-secondary/60 focus-within:ring-2 focus-within:ring-gold">
              <Camera className="h-7 w-7 text-navy" />
              <span className="text-sm font-medium text-navy">Take / add photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={onPickPhotos}
                className="sr-only"
                aria-label="Add proof of delivery photo"
              />
            </label>

            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Proof ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-navy/80 text-white active:bg-navy focus-ring"
                      aria-label={`Remove photo ${i + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery notes */}
          <div>
            <Label htmlFor="notes">Delivery notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Handed to recipient at front door"
            />
          </div>

          {/* Big Mark Delivered button, min 56px height, high contrast */}
          <Button
            variant="gold"
            onClick={handleDelivered}
            loading={submitting}
            className="h-14 w-full text-lg"
          >
            <CheckCircle2 className="h-6 w-6" /> Mark Delivered
          </Button>
        </div>
      )}
    </div>
  );
}


export default function Page() {
  return (
    <React.Suspense fallback={<PageLoader label="Loading…" />}>
      <DispatchJobDetailPageInner />
    </React.Suspense>
  );
}
