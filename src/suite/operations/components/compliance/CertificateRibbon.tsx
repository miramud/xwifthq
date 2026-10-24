"use client";

import Link from "next/link";
import { Briefcase, Star } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { hueHex } from "@/components/workspace/charts";
import { day } from "@/suite/finance/lib/format";
import type { Certificate } from "@/lib/api/operations-compliance-client";
import { CERT_STATE, daysBetween, monthTicks, percentAt, ribbonWindow } from "./labels";

/**
 * Every certificate the organisation must hold, as a ribbon from the day it
 * was issued to the day it lapses, on one time axis with today drawn across
 * them all. What has run out sits to the left of the line; how long each
 * has left reads as the ribbon still to the right of it. The time already
 * used is drawn pale, the time left in full colour, and a certificate not on
 * file is a hatched track that says so. Mandatory certificates that have
 * expired are named in red.
 */
export function CertificateRibbon({ certificates, today, hrefFor }: { certificates: Certificate[]; today: string; hrefFor?: (c: Certificate) => string | null }) {
  if (certificates.length === 0) {
    return <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">No obligation on the register is a certificate yet.</p>;
  }

  // Expired first, then by expiry: what to renew reads top-down.
  const order = { expired: 0, expiring: 1, missing: 2, valid: 3 } as const;
  const rows = [...certificates].sort((a, b) => order[a.state] - order[b.state] || (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999") || a.name.localeCompare(b.name));
  const w = ribbonWindow(certificates, today);
  const ticks = monthTicks(w);
  const todayAt = percentAt(today, w);

  return (
    <figure className="space-y-3">
      <div className="hidden grid-cols-[15rem_minmax(0,1fr)] gap-4 sm:grid" aria-hidden>
        <span />
        <div className="relative h-12 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {ticks.map((t) => (
            <span key={t.date} className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: `${percentAt(t.date, w)}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="relative space-y-2.5">
        {rows.map((c) => {
          const meta = CERT_STATE[c.state];
          const Icon = meta.icon;
          const href = hrefFor?.(c) ?? null;
          const lapsedMandatory = c.mandatory && c.state === "expired";
          const left = c.expiresOn ? daysBetween(today, c.expiresOn) : null;
          const issued = c.issuedOn ?? (c.expiresOn ? shiftYear(c.expiresOn, -1) : null);
          const from = issued ? percentAt(issued, w) : 0;
          const to = c.expiresOn ? percentAt(c.expiresOn, w) : 0;
          const used = Math.max(0, Math.min(to, todayAt) - from);
          const rest = Math.max(0, to - Math.max(from, todayAt));
          const say =
            c.state === "missing"
              ? `${c.name}: no certificate on file`
              : `${c.name}: ${meta.label.toLowerCase()}${c.issuedOn ? `, issued ${day(c.issuedOn)}` : ""}${c.expiresOn ? `, expires ${day(c.expiresOn)}` : ""}${left !== null ? (left < 0 ? `, ${-left} days ago` : `, ${left} days left`) : ""}`;
          const name = (
            <span className="flex min-w-0 items-center gap-2">
              <Icon size={15} className="shrink-0" style={{ color: hueHex(meta.hue) }} aria-hidden />
              <span className={cx("truncate text-sm font-semibold", lapsedMandatory ? "text-error-700" : "text-neutral-900")}>{c.name}</span>
              {c.mandatory && <Star size={12} className={cx("shrink-0", lapsedMandatory ? "fill-error-600 text-error-600" : "fill-neutral-300 text-neutral-400")} aria-label="Mandatory" />}
              {c.bidPack && <Briefcase size={12} className="shrink-0 text-neutral-400" aria-label="In the bid pack" />}
            </span>
          );
          return (
            <li key={c.obligationId} className="grid gap-1.5 sm:grid-cols-[15rem_minmax(0,1fr)] sm:items-center sm:gap-4">
              {href ? (
                <Link href={href} className="min-w-0 rounded-lg outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                  {name}
                </Link>
              ) : (
                name
              )}
              <div role="img" aria-label={say} className={cx("relative h-7 rounded-lg", lapsedMandatory ? "bg-error-500/5 ring-1 ring-error-500/25" : "bg-neutral-50")}>
                {c.state === "missing" || !c.expiresOn ? (
                  <span className="ws-hatch absolute inset-0 flex items-center rounded-lg px-3 text-xs font-medium text-neutral-600">No certificate on file</span>
                ) : (
                  <>
                    {used > 0 && <span className="absolute inset-y-1 rounded-l-md opacity-30" style={{ left: `${from}%`, width: `${used}%`, background: hueHex(meta.hue) }} />}
                    {rest > 0 && <span className="absolute inset-y-1 rounded-r-md" style={{ left: `${Math.max(from, todayAt)}%`, width: `${rest}%`, background: hueHex(meta.hue) }} />}
                    {/* The lapse date: a cap on the ribbon's end. */}
                    <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full" style={{ left: `${to}%`, background: hueHex(meta.hue) }} aria-hidden />
                    <span
                      className={cx(
                        "absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                        lapsedMandatory ? "text-error-700" : "text-neutral-700",
                        to > 78 ? "-translate-x-full pr-2" : "pl-2",
                      )}
                      style={{ left: `${to}%` }}
                      aria-hidden
                    >
                      {left === null ? "" : left < 0 ? `Lapsed ${day(c.expiresOn)}` : left === 0 ? "Lapses today" : `${left}d left`}
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {/* Today, across every row. */}
        <li aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden sm:left-[calc(15rem+1rem)] sm:block">
          <span className="absolute inset-y-[-0.5rem] w-0 border-l-2 border-dashed border-primary-500" style={{ left: `${todayAt}%` }} />
          <span className="absolute -top-11 -translate-x-1/2 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ left: `${todayAt}%` }}>
            Today
          </span>
        </li>
      </ul>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-xs text-neutral-600">
        {(["valid", "expiring", "expired", "missing"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cx("h-2.5 w-4 rounded-sm", s === "missing" && "ws-hatch")} style={s === "missing" ? undefined : { background: hueHex(CERT_STATE[s].hue) }} aria-hidden />
            {CERT_STATE[s].label}
            <span className="font-semibold tabular-nums text-neutral-900">{certificates.filter((c) => c.state === s).length}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <Star size={12} className="fill-neutral-300 text-neutral-400" aria-hidden /> Mandatory
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Briefcase size={12} className="text-neutral-400" aria-hidden /> In the bid pack
        </span>
        <span className="text-neutral-500">Pale: time used · full colour: time left</span>
      </figcaption>
    </figure>
  );
}

function shiftYear(ymd: string, years: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`;
}
