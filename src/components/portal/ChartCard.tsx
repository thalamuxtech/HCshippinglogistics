"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const NAVY = "#0B1E3A";
const GOLD = "#D4A017";

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
}

export function ChartCard({
  title,
  description,
  caption,
  action,
  height = 280,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
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
            <ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement}
            </ResponsiveContainer>
          </div>
          <figcaption className="mt-3 text-xs leading-relaxed text-ink-muted">
            {caption}
          </figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}

// ─── Shared tooltip styling ────────────────────────────────
const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    boxShadow: "0 8px 30px rgba(11,30,58,0.12)",
    fontSize: 12,
  },
  labelStyle: { color: NAVY, fontWeight: 600 },
} as const;

// ─── Bar chart (single series, optional per-bar colors) ────
export interface CategoryDatum {
  name: string;
  value: number;
  color?: string;
}

export function CategoryBarChart({
  data,
  color = NAVY,
}: {
  data: CategoryDatum[];
  color?: string;
}) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
      <Tooltip cursor={{ fill: "rgba(11,30,58,0.04)" }} {...tooltipStyle} />
      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.color ?? color} />
        ))}
        <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "#64748B" }} />
      </Bar>
    </BarChart>
  );
}

// ─── Donut chart ───────────────────────────────────────────
export function DonutChart({ data }: { data: CategoryDatum[] }) {
  const palette = [NAVY, GOLD, "#3B82F6", "#8B5CF6", "#14B8A6", "#F97316"];
  return (
    <PieChart>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={55}
        outerRadius={90}
        paddingAngle={2}
        stroke="none"
      >
        {data.map((d, i) => (
          <Cell key={i} fill={d.color ?? palette[i % palette.length]} />
        ))}
      </Pie>
      <Tooltip {...tooltipStyle} />
      <Legend
        verticalAlign="bottom"
        iconType="circle"
        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
      />
    </PieChart>
  );
}

// ─── Trend line/area chart ─────────────────────────────────
export function TrendChart({
  data,
  dataKey = "value",
  color = GOLD,
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  color?: string;
}) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
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
      <Tooltip cursor={{ stroke: "#E2E8F0" }} {...tooltipStyle} />
      <Line
        type="monotone"
        dataKey={dataKey}
        stroke={color}
        strokeWidth={2.5}
        dot={{ r: 3, fill: color, strokeWidth: 0 }}
        activeDot={{ r: 5 }}
      />
    </LineChart>
  );
}
