"use client";

import * as React from "react";
import { FileText, Save } from "lucide-react";
import { getSiteContent, setSiteContent, logActivity } from "@/lib/db";
import { COMPANY } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Textarea, Label, FieldHint } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

interface HomeContent {
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  services_heading: string;
  services_subheading: string;
  enterprise_heading: string;
  enterprise_body: string;
  contact_email: string;
}

const DEFAULTS: HomeContent = {
  hero_title: "Ship from the USA to Nigeria & across Africa",
  hero_subtitle:
    "Sea cargo, air freight, and vehicle (RORO) shipping. Track every box, barrel, and vehicle through all 8 stages, and download your receipt online.",
  hero_cta: "Ship with Highclass",
  services_heading: "Three ways to ship from the USA to Africa",
  services_subheading:
    "From a single suitcase to a 60-container medical project. Rates are published up front and every shipment is tracked to your door.",
  enterprise_heading: "Documentation that clears government and hospital tenders.",
  enterprise_body:
    "Highclass gives you a customer portal, formal digital receipts, and full audit trails. That is the paperwork agencies, hospitals, and embassies need before they can award a contract.",
  contact_email: COMPANY.email,
};

const FIELDS: Array<{
  key: keyof HomeContent;
  label: string;
  hint?: string;
  multiline?: boolean;
}> = [
  { key: "hero_title", label: "Hero title", multiline: true },
  { key: "hero_subtitle", label: "Hero subtitle", multiline: true },
  { key: "hero_cta", label: "Hero button text" },
  { key: "services_heading", label: "Services heading" },
  { key: "services_subheading", label: "Services subheading", multiline: true },
  { key: "enterprise_heading", label: "Enterprise heading" },
  { key: "enterprise_body", label: "Enterprise body", multiline: true },
  { key: "contact_email", label: "Public contact email", hint: "Shown on the marketing site." },
];

export default function AdminContentPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState<HomeContent>(DEFAULTS);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getSiteContent("home");
        if (alive && data) {
          setForm((f) => ({ ...f, ...(data as Partial<HomeContent>) }));
        }
      } catch {
        // keep defaults
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function update(key: keyof HomeContent, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await setSiteContent("home", { ...form });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "updated site content",
        target: "home",
      });
      toast.success("Content saved", "The homepage content has been updated.");
    } catch {
      toast.error("Save failed", "Could not save the site content.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Homepage content</CardTitle>
          <CardDescription>
            Edit the marketing homepage copy. Changes are stored in site content and used where the
            marketing pages read managed content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="space-y-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ))}
            </div>
          ) : (
            FIELDS.map((f) => (
              <div key={f.key}>
                <Label htmlFor={f.key}>{f.label}</Label>
                {f.multiline ? (
                  <Textarea
                    id={f.key}
                    value={form[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                  />
                ) : (
                  <Input
                    id={f.key}
                    value={form[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                  />
                )}
                {f.hint && <FieldHint>{f.hint}</FieldHint>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={saving || loading}>
          <Save className="h-4 w-4" /> Save changes
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <FileText className="h-3.5 w-3.5" /> Content document: <span className="font-mono">home</span>
      </p>
    </div>
  );
}
