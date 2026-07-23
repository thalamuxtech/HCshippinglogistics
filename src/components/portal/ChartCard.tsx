"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Sector,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  type TooltipProps,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BLUE = "#0A5BE0";
const BLUE_LIGHT = "#2E74EC";

// Brand-forward palette for multi-series charts (blues + supporting hues).
const PALETTE = ["#0A5BE0", "#0B1E3A", "#2E74EC", "#8B5CF6", "#14B8A6", "#F97316", "#EC4899", "#22C55E"];

// ─── Wrapper card ──────────────────────────────────────────
export interface ChartCardProps {
  title: string;
  description?: string;
  /** Accessible caption / fallback describing the chart data in words. */
  caption: string;
  action?: React.ReactNode;
  height?: number;
  children: React.ReactNode;
  className?: string;
  /** When true, render children directly (they manage their own sizing, e.g.
   *  the donut which has its own layout + ResponsiveContainer). */
  raw?: boolean;
}

export function ChartCard({
  title,
  description,
  caption,
  action,
  height = 288,
  children,
  className,
  raw = false,
}: ChartCardProps) {
  return (
    <Card
      className={cn(
        "group flex animate-fade-up flex-col overflow-hidden transition-shadow duration-300 hover:shadow-premium",
        className
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex-1">
        <figure className="m-0">
          <div style={{ width: "100%", height }} role="img" aria-label={caption}>
            {raw ? (
              children
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {children as React.ReactElement}
              </ResponsiveContainer>
            )}
          </div>
          <figcaption className="mt-3 text-xs leading-relaxed text-ink-muted">{caption}</figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}

// ─── Shared premium tooltip ────────────────────────────────
function PremiumTooltip({
  active,
  payload,
  label,
  valueLabel,
  currency,
}: TooltipProps<number, string> & { valueLabel?: string; currency?: boolean }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const val = typeof p.value === "number" ? p.value : Number(p.value) || 0;
  // Prefer an explicit datum color; never use a gradient url() as a swatch color.
  const datumColor = p.payload && (p.payload.color as string | undefined);
  const pColor = typeof p.color === "string" && !p.color.startsWith("url(") ? p.color : undefined;
  const swatch = datumColor || pColor || BLUE;
  return (
    <div className="rounded-xl border border-border bg-white/95 px-3.5 py-2.5 shadow-premium backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: swatch }} />
        <span className="text-xs font-semibold text-navy">{label ?? p.name}</span>
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-navy">
        {currency ? `$${val.toLocaleString()}` : val.toLocaleString()}
        {valueLabel && <span className="ml-1 text-xs font-normal text-ink-muted">{valueLabel}</span>}
      </div>
    </div>
  );
}

// ─── Bar chart (single series, optional per-bar colors) ────
export interface CategoryDatum {
  name: string;
  value: number;
  color?: string;
}

export function CategoryBarChart({
  data,
  color = BLUE,
  valueLabel = "shipments",
}: {
  data: CategoryDatum[];
  color?: string;
  valueLabel?: string;
}) {
  const gid = React.useId().replace(/:/g, "");
  return (
    <BarChart data={data} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
      <defs>
        {/* A vertical gradient per distinct color so every bar glows top-to-base. */}
        {data.map((d, i) => {
          const base = d.color ?? color;
          return (
            <linearGradient key={i} id={`bar-${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={base} stopOpacity={0.95} />
              <stop offset="100%" stopColor={base} stopOpacity={0.55} />
            </linearGradient>
          );
        })}
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" vertical={false} />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: "#64748B" }}
        tickLine={false}
        axisLine={{ stroke: "#E2E8F0" }}
        interval={0}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fontSize: 11, fill: "#64748B" }}
        tickLine={false}
        axisLine={false}
        width={40}
      />
      <Tooltip
        cursor={{ fill: "rgba(10,91,224,0.06)", radius: 6 }}
        content={<PremiumTooltip valueLabel={valueLabel} />}
      />
      <Bar
        dataKey="value"
        radius={[8, 8, 0, 0]}
        maxBarSize={54}
        isAnimationActive
        animationBegin={120}
        animationDuration={900}
        animationEasing="ease-out"
      >
        {data.map((d, i) => (
          <Cell key={i} fill={`url(#bar-${gid}-${i})`} />
        ))}
        <LabelList
          dataKey="value"
          position="top"
          style={{ fontSize: 11, fontWeight: 600, fill: "#334155" }}
        />
      </Bar>
    </BarChart>
  );
}

// ─── Donut chart with center total + active-slice expand ───
function renderActiveShape(props: unknown) {
  const p = props as {
    cx: number;
    cy: number;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    fill: string;
  };
  return (
    <g>
      <Sector
        cx={p.cx}
        cy={p.cy}
        innerRadius={p.innerRadius}
        outerRadius={p.outerRadius + 6}
        startAngle={p.startAngle}
        endAngle={p.endAngle}
        fill={p.fill}
        cornerRadius={4}
      />
    </g>
  );
}

export function DonutChart({
  data,
  centerLabel = "Total",
}: {
  data: CategoryDatum[];
  centerLabel?: string;
}) {
  const gid = React.useId().replace(/:/g, "");
  const [active, setActive] = React.useState<number | undefined>(undefined);
  const total = data.reduce((a, b) => a + b.value, 0);

  const colorFor = (d: CategoryDatum, i: number) => d.color ?? PALETTE[i % PALETTE.length];

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
      <div className="relative h-[200px] w-full max-w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((d, i) => {
                const base = colorFor(d, i);
                return (
                  <linearGradient key={i} id={`slice-${gid}-${i}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={base} stopOpacity={1} />
                    <stop offset="100%" stopColor={base} stopOpacity={0.72} />
                  </linearGradient>
                );
              })}
            </defs>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              cornerRadius={5}
              stroke="none"
              activeIndex={active}
              activeShape={renderActiveShape}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(undefined)}
              isAnimationActive
              animationBegin={150}
              animationDuration={950}
              animationEasing="ease-out"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={`url(#slice-${gid}-${i})`} />
              ))}
            </Pie>
            <Tooltip content={<PremiumTooltip valueLabel="shipments" />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-extrabold text-navy">
            {(active != null ? data[active]?.value : total)?.toLocaleString()}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
            {active != null ? data[active]?.name : centerLabel}
          </span>
        </div>
      </div>

      {/* Custom legend with values + share */}
      <ul className="w-full space-y-2 sm:w-auto sm:min-w-[130px]">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={i}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm transition-colors",
                active === i ? "bg-secondary" : ""
              )}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(undefined)}
            >
              <span className="flex items-center gap-2 text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: colorFor(d, i) }}
                />
                {d.name}
              </span>
              <span className="font-mono text-xs font-semibold text-navy">
                {d.value}
                <span className="ml-1 font-normal text-ink-muted">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Trend area chart with gradient fill + animated draw ───
export function TrendChart({
  data,
  dataKey = "value",
  color = BLUE,
  valueLabel = "shipments",
  currency = false,
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  color?: string;
  valueLabel?: string;
  currency?: boolean;
}) {
  const gid = React.useId().replace(/:/g, "");
  return (
    <AreaChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
      <defs>
        <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`stroke-${gid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={BLUE_LIGHT} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" vertical={false} />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: "#64748B" }}
        tickLine={false}
        axisLine={{ stroke: "#E2E8F0" }}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fontSize: 11, fill: "#64748B" }}
        tickLine={false}
        axisLine={false}
        width={40}
      />
      <Tooltip
        cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 4" }}
        content={<PremiumTooltip valueLabel={valueLabel} currency={currency} />}
      />
      <Area
        type="monotone"
        dataKey={dataKey}
        stroke={`url(#stroke-${gid})`}
        strokeWidth={3}
        fill={`url(#area-${gid})`}
        dot={{ r: 3.5, fill: "#fff", stroke: color, strokeWidth: 2 }}
        activeDot={{ r: 6, fill: color, stroke: "#fff", strokeWidth: 2 }}
        isAnimationActive
        animationBegin={120}
        animationDuration={1100}
        animationEasing="ease-out"
      />
    </AreaChart>
  );
}
