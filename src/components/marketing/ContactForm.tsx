"use client";

import * as React from "react";
import { Send, Check } from "lucide-react";
import { motion } from "framer-motion";
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
  const { error } = useToast();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
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
      setForm(EMPTY);
      setErrors({});
      setSent(true);
    } catch {
      error("Could not send", "Something went wrong. Please try again or email us directly.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center py-8 text-center"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50"
        >
          <motion.span
            className="absolute inset-0 rounded-full ring-2 ring-emerald-300"
            initial={{ scale: 0.6, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
          />
          <Check className="h-10 w-10 text-emerald-600" strokeWidth={3} />
        </motion.span>
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-5 text-xl font-extrabold text-navy"
        >
          Thank you, we&apos;ve got your message
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32 }}
          className="mt-2 max-w-sm text-sm text-ink-muted"
        >
          Our team will get back to you within one business day. For anything urgent, call the
          office numbers listed on this page.
        </motion.p>
        <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </motion.div>
    );
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
