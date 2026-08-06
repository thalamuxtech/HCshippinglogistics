"use client";

// ─────────────────────────────────────────────────────────────
// Date-of-birth picker — three scrolling rollers (day · month name · year).
//
// Replaces <input type="date">, which is a poor fit here: browsers render it in
// the visitor's locale, so the same field reads DD/MM/YYYY for a Lagos customer
// and MM/DD/YYYY for one in Maryland — ambiguous exactly where it matters. Native
// pickers also open on the current month, so reaching a 1985 birthday takes many
// taps. Spelling the month out removes the ambiguity entirely.
//
// Optional by design: the value is only reported once all three columns are set,
// and clearing any one of them clears the field.
//
// Implementation notes:
//  - Native scroll + CSS snap does the work. A JS-driven wheel would need pointer
//    capture, inertia and momentum to feel right; the browser already has all of
//    that, and it gives keyboard and screen-reader support for free.
//  - Each column is a listbox of real buttons, so it is operable by keyboard and
//    announced properly. The roller is a visual treatment, not a custom widget.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Days in a given month, honouring leap years once a year is known. */
function daysInMonth(month: number | null, year: number | null): number {
  if (month === null) return 31;
  if (month === 1) {
    if (year === null) return 29; // allow the 29th until a year rules it out
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
}

const ITEM_H = 40; // px — must match the item height class below

function Column({
  label,
  items,
  selectedIndex,
  onSelect,
  width,
}: {
  label: string;
  items: { value: number; text: string }[];
  selectedIndex: number;
  onSelect: (value: number) => void;
  width: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const userScrolled = React.useRef(false);

  // Keep the chosen row centred. `auto` on first paint so the field does not
  // animate on load; smooth afterwards so a change reads as a roll.
  React.useEffect(() => {
    const el = ref.current;
    if (!el || selectedIndex < 0) return;
    el.scrollTo({
      top: selectedIndex * ITEM_H,
      behavior: userScrolled.current ? "smooth" : "auto",
    });
    userScrolled.current = true;
  }, [selectedIndex]);

  return (
    <div className={cn("flex flex-col", width)}>
      <span className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <div className="relative">
        {/* Centre highlight band — the "selected" slot of the roller. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-10 -translate-y-1/2 rounded-lg bg-gold/10 ring-1 ring-gold/30"
          aria-hidden
        />
        {/* Fades top and bottom so rows appear to roll out of view. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-white to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-white to-transparent"
          aria-hidden
        />
        <div
          ref={ref}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          className="hc-roller relative z-10 h-[120px] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth focus-ring rounded-lg"
        >
          {/* Half-item spacers let the first and last rows reach the centre. */}
          <div className="h-10" aria-hidden />
          {items.map((it, i) => {
            const active = i === selectedIndex;
            return (
              <button
                key={it.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(it.value)}
                className={cn(
                  "flex h-10 w-full snap-center items-center justify-center text-sm transition-colors",
                  active ? "font-bold text-navy" : "text-ink-muted hover:text-navy"
                )}
              >
                {it.text}
              </button>
            );
          })}
          <div className="h-10" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function DateOfBirthPicker({
  /** ISO YYYY-MM-DD, or "" when unset. */
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
}) {
  // Parse the incoming ISO value; any part may be missing while the user picks.
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const [day, setDay] = React.useState<number | null>(parsed ? Number(parsed[3]) : null);
  const [month, setMonth] = React.useState<number | null>(parsed ? Number(parsed[2]) - 1 : null);
  const [year, setYear] = React.useState<number | null>(parsed ? Number(parsed[1]) : null);

  // Re-sync when the form clears or prefills the field from outside.
  React.useEffect(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) {
      setYear(Number(m[1]));
      setMonth(Number(m[2]) - 1);
      setDay(Number(m[3]));
    } else if (value === "") {
      setYear(null);
      setMonth(null);
      setDay(null);
    }
  }, [value]);

  // ── Typed entry (declared before `emit`, which writes to it) ──
  const [typing, setTyping] = React.useState(false);
  const [typed, setTyped] = React.useState(() =>
    parsed ? `${parsed[3]}/${parsed[2]}/${parsed[1]}` : ""
  );

  const thisYear = new Date().getFullYear();
  // 18–100 is the plausible range for someone shipping cargo; listing 1900
  // onwards would just add scrolling.
  const years = React.useMemo(
    () => Array.from({ length: 83 }, (_, i) => thisYear - 18 - i),
    [thisYear]
  );

  const maxDay = daysInMonth(month, year);
  const days = React.useMemo(
    () => Array.from({ length: maxDay }, (_, i) => i + 1),
    [maxDay]
  );

  // Report upward only when the date is complete. Clamps the day first, so
  // picking 31 then February cannot emit an impossible date like 2-31.
  const emit = React.useCallback(
    (d: number | null, mo: number | null, y: number | null) => {
      if (d === null || mo === null || y === null) {
        if (value !== "") onChange("");
        return;
      }
      const clamped = Math.min(d, daysInMonth(mo, y));
      const iso = `${y}-${String(mo + 1).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
      // Keep the typed box showing whatever the rollers say, so switching between
      // the two never shows a stale value.
      setTyped(
        `${String(clamped).padStart(2, "0")}/${String(mo + 1).padStart(2, "0")}/${y}`
      );
      if (iso !== value) onChange(iso);
    },
    [onChange, value]
  );

  function pickDay(d: number) {
    setDay(d);
    emit(d, month, year);
  }
  function pickMonth(mo: number) {
    setMonth(mo);
    // A shorter month must pull the day back rather than leave an invalid one.
    const clamped = day !== null ? Math.min(day, daysInMonth(mo, year)) : null;
    if (clamped !== day) setDay(clamped);
    emit(clamped, mo, year);
  }
  function pickYear(y: number) {
    setYear(y);
    const clamped = day !== null ? Math.min(day, daysInMonth(month, y)) : null;
    if (clamped !== day) setDay(clamped);
    emit(clamped, month, y);
  }

  const complete = day !== null && month !== null && year !== null;

  // Day-first, explicitly labelled, because DD/MM and MM/DD both look valid and
  // guessing would silently record the wrong birthday.
  function onTyped(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    // Re-insert separators as they type so the shape is self-evident.
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    setTyped(parts.join("/"));

    if (digits.length < 8) return;
    const d = Number(digits.slice(0, 2));
    const mo = Number(digits.slice(2, 4)) - 1;
    const y = Number(digits.slice(4, 8));
    // Reject impossible input rather than clamping it into a different date.
    if (mo < 0 || mo > 11) return;
    if (y < 1900 || y > thisYear) return;
    if (d < 1 || d > daysInMonth(mo, y)) return;
    setDay(d);
    setMonth(mo);
    setYear(y);
    emit(d, mo, y);
  }

  return (
    <div id={id}>
      <div className="rounded-xl border border-border bg-white p-3">
        <div className="flex gap-2">
          <Column
            label="Day"
            width="w-[64px] shrink-0"
            items={days.map((d) => ({ value: d, text: String(d) }))}
            selectedIndex={day === null ? -1 : day - 1}
            onSelect={pickDay}
          />
          <Column
            label="Month"
            width="flex-1"
            items={MONTHS.map((m, i) => ({ value: i, text: m }))}
            selectedIndex={month ?? -1}
            onSelect={pickMonth}
          />
          <Column
            label="Year"
            width="w-[76px] shrink-0"
            items={years.map((y) => ({ value: y, text: String(y) }))}
            selectedIndex={year === null ? -1 : years.indexOf(year)}
            onSelect={pickYear}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <p className="text-xs text-ink-muted">
            {complete ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                {day} {MONTHS[month!]} {year}
              </span>
            ) : (
              "Scroll or tap to pick — optional."
            )}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {/* Typing is faster than scrolling for anyone who knows their date,
                so both routes stay available rather than forcing the roller. */}
            <button
              type="button"
              onClick={() => setTyping((v) => !v)}
              className="rounded text-xs font-semibold text-gold-700 hover:underline focus-ring"
            >
              {typing ? "Use the picker" : "Type it instead"}
            </button>
            {(day !== null || month !== null || year !== null) && (
              <button
                type="button"
                onClick={() => {
                  setDay(null);
                  setMonth(null);
                  setYear(null);
                  setTyped("");
                  onChange("");
                }}
                className="rounded text-xs font-semibold text-ink-muted hover:text-navy hover:underline focus-ring"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {typing && (
          <div className="mt-2 border-t border-border pt-2">
            <label htmlFor={`${id ?? "dob"}-typed`} className="sr-only">
              Date of birth, day slash month slash year
            </label>
            <input
              id={`${id ?? "dob"}-typed`}
              inputMode="numeric"
              autoComplete="bday"
              placeholder="DD / MM / YYYY"
              value={typed}
              onChange={(e) => onTyped(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 font-mono text-sm text-ink placeholder:text-ink-muted/60 focus-ring"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Day first, e.g. <span className="font-mono">04/09/1985</span>. The picker above
              updates as you type.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
