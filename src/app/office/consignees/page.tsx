"use client";

import * as React from "react";
import { Search, ClipboardList, User, MapPin, Phone, Ship } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, listRoroDocs, where } from "@/lib/db";
import type { RoroDocument, Shipment } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { RORO_LINES, VEHICLE_CLASSES } from "@/lib/constants";

interface ConsigneeRow extends RoroDocument {
  tracking_number?: string;
  destination_city?: string;
}

export default function OfficeConsigneesPage() {
  const { user } = useAuth();
  const country = user?.assigned_country || "Nigeria";
  const [rows, setRows] = React.useState<ConsigneeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        // RORO shipments destined for this office's country.
        const shipments = await listShipments([
          where("destination_country", "==", country),
          where("service_type", "==", "roro"),
        ]).catch(async () =>
          (await listShipments([where("destination_country", "==", country)])).filter(
            (s) => s.service_type === "roro"
          )
        );
        const byShipment = new Map<string, Shipment>(shipments.map((s) => [s.id, s]));
        const ids = shipments.map((s) => s.id);
        let docs: RoroDocument[] = [];
        if (ids.length) {
          // Firestore "in" supports up to 30 values; chunk to be safe.
          const chunks: string[][] = [];
          for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
          const results = await Promise.all(
            chunks.map((c) => listRoroDocs([where("shipment_id", "in", c)]).catch(() => []))
          );
          docs = results.flat();
        }
        const mapped: ConsigneeRow[] = docs.map((d) => {
          const s = byShipment.get(d.shipment_id);
          return {
            ...d,
            tracking_number: s?.tracking_number,
            destination_city: s?.destination_city,
          };
        });
        if (active) setRows(mapped);
      } catch {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [country]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.consignee_details?.name?.toLowerCase().includes(needle) ||
        r.tracking_number?.toLowerCase().includes(needle) ||
        r.consignee_details?.phone?.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          RORO Consignees
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Consignee details for vehicle (RORO) shipments arriving in {country}.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search consignee, tracking #, or phone…"
          className="pl-10"
          aria-label="Search consignees"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No RORO consignees"
          description={`Vehicle shipments bound for ${country} with consignee documents will appear here.`}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-gold" />
                  {r.consignee_details?.name || "Consignee"}
                </CardTitle>
                {r.tracking_number && (
                  <span className="font-mono text-xs font-semibold text-navy">
                    {r.tracking_number}
                  </span>
                )}
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <p className="flex items-start gap-2 text-ink">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                  {r.consignee_details?.address || "Address on file"}
                  {r.destination_city ? ` · ${r.destination_city}` : ""}
                </p>
                <p className="flex items-center gap-2 text-ink">
                  <Phone className="h-4 w-4 shrink-0 text-ink-muted" />
                  {r.consignee_details?.phone || "—"}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Badge variant="navy" className="gap-1.5">
                    <Ship className="h-3.5 w-3.5" />
                    {RORO_LINES[r.shipping_line]?.label ?? r.shipping_line}
                  </Badge>
                  {r.vehicle_class && (
                    <Badge variant="gold">
                      {VEHICLE_CLASSES[r.vehicle_class]?.label ?? r.vehicle_class}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
