"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/components/providers/AuthProvider";
import { getShipment, advanceStage } from "@/lib/db";
import { sendStageUpdateEmail } from "@/lib/notify";
import type { Shipment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { PageLoader, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

export default function DispatchJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const { user } = useAuth();
  const toast = useToast();

  const [job, setJob] = React.useState<Shipment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const s = await getShipment(id);
        // Only the assigned dispatcher may view this job (rules also enforce this).
        if (active) setJob(s && s.assigned_dispatcher_id === user.id ? s : null);
      } catch {
        if (active) setJob(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, user?.id]);

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
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-gold" />
          <span className="font-mono text-lg font-bold text-navy">{job.tracking_number}</span>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <p className="text-base font-semibold leading-snug text-navy">
              {job.delivery_address ||
                [job.destination_city, job.destination_country].filter(Boolean).join(", ") ||
                "Address on file"}
            </p>
          </div>

          <a
            href={job.customer_phone ? `tel:${job.customer_phone}` : undefined}
            className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-base text-ink active:bg-secondary/50 focus-ring"
          >
            <Phone className="h-5 w-5 shrink-0 text-navy" />
            <span className="font-medium">
              {job.customer_name || "Customer"}
              {job.customer_phone ? ` · ${job.customer_phone}` : ""}
            </span>
          </a>

          <div className="flex items-start gap-2.5">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
            <span className="text-sm text-ink-muted">
              {job.items?.[0]?.description ||
                job.item_category ||
                job.vehicle_details ||
                "Shipment items"}
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

          {/* Big Mark Delivered button — min 56px height, high contrast */}
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
