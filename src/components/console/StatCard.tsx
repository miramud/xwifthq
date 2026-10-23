"use client";

import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { HUE, type Hue } from "@/components/workspace/modules";
import { hueHex } from "@/components/workspace/charts";
import { Sparkline } from "./Charts";

/* ------------------------------------------------------------------ */
/*  Top-line KPI card with icon, value, trend chip and sparkline.      */
/*                                                                      */
/*  Worn in the workspace look (see DESIGN.md): white ws-card, a hue    */
/*  icon tile, a 28px tabular figure and a delta pill. The props are    */
/*  the ones the consoles always passed; `hue` is the preferred way to  */
/*  colour it now, and wins over the older iconBg / iconColor / accent. */
/* ------------------------------------------------------------------ */

export interface StatCardProps {
  label: string;
  value: string;
  /** signed percentage vs previous period (e.g. 12.4 or -3.1) */
  delta?: number;
  icon: LucideIcon;
  /** Workspace hue for the icon tile and sparkline. */
  hue?: Hue;
  /** tailwind text-* class for the icon, e.g. "text-primary-600" (legacy) */
  iconColor?: string;
  /** tailwind bg-* class for the icon chip, e.g. "bg-primary-50" (legacy) */
  iconBg?: string;
  /** hex used for the sparkline stroke/fill (legacy; `hue` preferred) */
  accent?: string;
  spark?: number[];
  /** entrance stagger class, e.g. "animate-fade-in-delay-1" */
  animationClass?: string;
  /** A short line under the label: what the figure is measured against. */
  hint?: string;
  /** Paint this one card in the module colour. */
  featured?: boolean;
}

export default function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  hue,
  iconColor,
  iconBg,
  accent,
  spark,
  animationClass = "animate-fade-in",
  hint,
  featured = false,
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  const tile = hue ? HUE[hue].soft : `${iconBg ?? "bg-primary-50"} ${iconColor ?? "text-primary-700"}`;
  const stroke = featured ? "#ffffff" : hue ? hueHex(hue) : (accent ?? hueHex("blue"));

  return (
    <div
      className={`group relative flex h-full flex-col gap-4 overflow-hidden p-5 transition-shadow duration-300 hover:shadow-md ${animationClass} ${
        /* Not ws-card when featured: its unlayered white background would beat the gradient. */
        featured ? "rounded-[1.125rem] bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-600/20" : "ws-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-medium ${featured ? "text-white/85" : "text-neutral-600"}`}>{label}</p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            featured ? "bg-white/15 text-white" : tile
          }`}
        >
          <Icon size={18} aria-hidden />
        </span>
      </div>

      <div>
        <p
          className={`text-[28px] font-bold leading-none tracking-tight tabular-nums ${
            featured ? "text-white" : "text-neutral-900"
          }`}
        >
          {value}
        </p>
        {(delta != null || hint) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {delta != null && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums ${
                  featured
                    ? "bg-white/15 text-white"
                    : positive
                      ? "bg-mint-50 text-mint-700"
                      : "bg-coral-50 text-coral-700"
                }`}
              >
                {positive ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                {positive ? "+" : ""}
                {delta.toFixed(1)}%
              </span>
            )}
            {hint && <span className={featured ? "text-white/80" : "text-neutral-500"}>{hint}</span>}
          </div>
        )}
      </div>

      {spark && spark.length > 1 && (
        <div className="-mb-1 mt-auto h-10 w-full">
          <Sparkline values={spark} color={stroke} className="h-10 w-full" />
        </div>
      )}
    </div>
  );
}
