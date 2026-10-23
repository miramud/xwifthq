import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { HUE, type Hue } from "@/components/workspace/modules";
import type { KpiItem } from "@/lib/suite-data";

// kit.tsx is a client module, so its cx() cannot be called from this Server Component.
const cx = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(" ");

/**
 * The stat row of a preview module, in the workspace look.
 *
 * The figures are illustrative and their deltas are pre-formatted strings
 * with a direction only — not "good" or "bad" — so the delta pill is neutral
 * slate rather than the mint/coral of a real stat card. The first card is
 * painted in the module's hue, as every dashboard's featured card is.
 */
export function PreviewKpis({ items, hue }: { items: readonly KpiItem[]; hue: Hue }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, i) => {
        const Icon = item.icon;
        const featured = i === 0;
        const Trend = item.trend === "up" ? ArrowUpRight : item.trend === "down" ? ArrowDownRight : ArrowRight;
        return (
          <div
            key={item.label}
            className={cx(
              "flex flex-col gap-4 p-5",
              // Not ws-card when featured: its unlayered white background beats the hue.
              featured ? cx("rounded-[1.125rem] shadow-lg", HUE[hue].tile) : "ws-card",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={cx("text-sm font-medium", featured ? "opacity-90" : "text-neutral-600")}>{item.label}</p>
              <span
                className={cx(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  featured ? "bg-white/20" : HUE[hue].soft,
                )}
              >
                <Icon size={18} aria-hidden />
              </span>
            </div>
            <div>
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums">{item.value}</p>
              {item.delta && (
                <p className="mt-2 flex items-center gap-2 text-xs">
                  <span
                    className={cx(
                      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums",
                      featured ? "bg-white/20" : "bg-neutral-100 text-neutral-700",
                    )}
                  >
                    <Trend size={12} aria-hidden />
                    {item.delta}
                  </span>
                  <span className={featured ? "opacity-90" : "text-neutral-500"}>vs last period</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
