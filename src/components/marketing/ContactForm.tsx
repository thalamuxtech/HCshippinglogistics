"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { createInquiry } from "@/lib/db";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label, FieldError } from "@/components/ui/input";

const INQUIRY_TYPES = ["General", "Enterprise", "Quote", "Support"] as const;

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  inquiry_type: string;
  message: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  inquiry_type: "General",
  message: "",
};

export function ContactForm() {
  const { success, error } = useToast();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!form.email.trim()) next.email = "Please enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Please enter a valid email address.";
    if (!form.message.trim()) next.message = "Please tell us how we can help.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await createInquiry({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        inquiry_type: form.inquiry_type,
        message: form.message.trim(),
      });
      success("Message sent", "Thank you — our team will respond within one business day.");
      setForm(EMPTY);
      setErrors({});
    } catch {
      error("Could not send", "Something went wrong. Please try again or email us directly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="cf-name" required>
            Full name
          </Label>
          <Input
            id="cf-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
          />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="cf-email" required>
            Email
          </Label>
          <Input
            id="cf-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="jane@company.com"
            autoComplete="email"
          />
          <FieldError>{errors.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="cf-phone">Phone</Label>
          <Input
            id="cf-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
          />
        </div>
        <div>
          <Label htmlFor="cf-company">Company / Organization</Label>
          <Input
            id="cf-company"
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="Acme Health Systems"
            autoComplete="organization"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="cf-type" required>
          Inquiry type
        </Label>
        <Select
          id="cf-type"
          value={form.inquiry_type}
          onChange={(e) => set("inquiry_type", e.target.value)}
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="cf-message" required>
          How can we help?
        </Label>
        <Textarea
          id="cf-message"
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="Tell us about your shipment, timeline, or project requirements…"
          rows={5}
        />
        <FieldError>{errors.message}</FieldError>
      </div>

      <Button type="submit" variant="gold" size="lg" loading={submitting} className="w-full sm:w-auto">
        {submitting ? "Sending…" : "Send message"}
        {!submitting && <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}
