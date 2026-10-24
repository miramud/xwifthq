"use client";

import { useEffect, useId, useState } from "react";
import { CalendarRange, DoorOpen, PackageCheck, Printer, QrCode, TriangleAlert } from "lucide-react";
import { Button, Chip, Panel, Segmented, buttonClass, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { AgendaList, CalendarNav, MonthCalendar, monthTitle, todayYmd, ymd, type CalendarEvent } from "@/components/workspace/Calendar";
import { Legend } from "@/components/workspace/charts";
import { ErrorNote, Field, Skeleton } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { day } from "@/suite/finance/lib/format";
import { gatePasses, opsError, type AssetCondition, type GatePass } from "@/lib/api/operations-assets-client";
import { CONDITION, CONDITION_ORDER, daysFrom, plural, stampOf } from "./labels";
import { PdfLink } from "@/suite/operations/components/procurement/ui";

/* Gate passes: what is out of the building, when it is due back, the printable pass, and checking it back in. */

/** Where a pass stands, in words. */
export function passState(p: GatePass, today = todayYmd()): { label: string; hue: "rose" | "sun" | "sky" | "mint" } {
  if (p.returnedAt) return { label: "Back in", hue: "mint" };
  if (p.overdue) {
    const late = -(daysFrom(today, p.dueBackOn) ?? 0);
    return { label: late > 0 ? `${plural(late, "day")} overdue` : "Overdue", hue: "rose" };
  }
  const left = daysFrom(today, p.dueBackOn);
  if (left === 0) return { label: "Due back today", hue: "sun" };
  if (left !== null && left <= 2) return { label: `Due back in ${plural(left, "day")}`, hue: "sun" };
  return { label: p.dueBackOn ? `Due back ${day(p.dueBackOn)}` : "Out", hue: "sky" };
}

export function PassStateChip({ pass }: { pass: GatePass }) {
  const s = passState(pass);
  return (
    <Chip hue={s.hue} icon={pass.overdue && !pass.returnedAt ? TriangleAlert : pass.returnedAt ? PackageCheck : DoorOpen}>
      {s.label}
    </Chip>
  );
}

/** The desk's gate-pass panel: open passes (overdue first) as a list or on a calendar from out to due back. */
export function GatePassBoard({ canCheckIn, refreshKey = 0 }: { canCheckIn: boolean; refreshKey?: number }) {
  const [passes, setPasses] = useState<GatePass[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showAll, setShowAll] = useState(false);
  const [printing, setPrinting] = useState<string | null>(null);
  const [checking, setChecking] = useState<GatePass | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    gatePasses.list(!showAll).then(
      (p) => {
        if (!alive) return;
        setPasses(p);
        setError(null);
      },
      (e: unknown) => alive && setError(`Gate passes didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [showAll, reload, refreshKey]);

  const sorted = [...(passes ?? [])].sort((a, b) => Number(b.overdue && !b.returnedAt) - Number(a.overdue && !a.returnedAt) || (a.dueBackOn ?? "").localeCompare(b.dueBackOn ?? ""));
  const overdue = sorted.filter((p) => p.overdue && !p.returnedAt).length;

  return (
    <Panel
      title="Gate passes"
      subtitle={passes === null ? "Assets out of the building on a temporary take-out" : overdue ? `${plural(overdue, "pass", "passes")} overdue` : "What is out of the building and when it comes back"}
      icon={DoorOpen}
      hue={overdue ? "rose" : "sun"}
      actions={
        <Segmented
          label="Show passes as"
          value={view}
          onChange={setView}
          options={[
            { key: "list", label: "List" },
            { key: "calendar", label: "Calendar" },
          ]}
        />
      }
    >
      {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
      {passes === null && !error ? (
        <Skeleton className="h-32" />
      ) : view === "calendar" ? (
        <PassCalendar passes={sorted} />
      ) : sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">{showAll ? "No gate passes yet." : "Nothing is out on a gate pass."} A pass is issued when a take-out request is fulfilled.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {sorted.map((p) => (
            <li key={p.id} className={cx("flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between", p.overdue && !p.returnedAt && "-mx-2 rounded-2xl bg-rose-50/60 px-2")}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono font-semibold text-neutral-900">{p.number}</span>
                  <PassStateChip pass={p} />
                </p>
                <p className="mt-1 truncate text-sm text-neutral-700">
                  {p.assets.map((a) => `${a.tagNo ?? ""} ${a.name}`.trim()).join(", ")}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {p.holder ?? "-"}
                  {p.destination && ` · to ${p.destination}`} · out {stampOf(p.outAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="ghost" icon={QrCode} onClick={() => setPrinting(p.id)} aria-label={`Show pass ${p.number ?? ""}`.trim()}>
                  Show pass
                </Button>
                <PdfLink href={gatePasses.pdfUrl(p.id)} label="Print" name={p.number} />
                {canCheckIn && !p.returnedAt && (
                  <Button size="sm" variant="primary" icon={PackageCheck} onClick={() => setChecking(p)}>
                    Check in
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Include passes already checked back in
      </label>
      {printing && <GatePassPrint id={printing} onClose={() => setPrinting(null)} />}
      {checking && (
        <CheckInDialog
          pass={checking}
          onClose={() => setChecking(null)}
          onDone={() => {
            setChecking(null);
            setReload((k) => k + 1);
          }}
        />
      )}
    </Panel>
  );
}

/** Each pass as a bar from the day it went out to the day it is due back (or came back); an agenda on a phone. */
function PassCalendar({ passes }: { passes: GatePass[] }) {
  const t = todayYmd();
  const [cursor, setCursor] = useState(() => ({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }));
  const shift = (n: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const events: CalendarEvent[] = passes
    .filter((p) => p.outAt)
    .map((p) => {
      const from = (p.outAt ?? "").slice(0, 10);
      const to = p.returnedAt ? p.returnedAt.slice(0, 10) : (p.dueBackOn ?? from);
      return { id: p.id, date: from, endDate: to < from ? from : to, title: p.assets.map((a) => a.tagNo ?? a.name).join(", ") || (p.number ?? "Pass"), meta: p.holder ?? undefined, hue: passState(p, t).hue, allDay: true };
    });
  return (
    <section aria-label="Gate passes from out to due back">
      <CalendarNav
        title={monthTitle(cursor.y, cursor.m)}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => setCursor({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 })}
      />
      <div className="hidden md:block">
        <MonthCalendar year={cursor.y} month={cursor.m} events={events} spanning maxLanes={3} />
      </div>
      <div className="md:hidden">
        <AgendaList
          events={events}
          from={ymd(cursor.y, cursor.m, 1)}
          to={ymd(cursor.y, cursor.m, new Date(cursor.y, cursor.m + 1, 0).getDate())}
          statusChips={false}
          emptyLabel="Nothing is out this month."
        />
      </div>
      <div className="mt-4">
        <Legend
          items={[
            { label: "Out", hue: "sky" },
            { label: "Due soon", hue: "sun" },
            { label: "Overdue", hue: "rose" },
            { label: "Back in", hue: "mint" },
          ]}
        />
      </div>
    </section>
  );
}

/** The printable pass: its number as a QR code for the gate to scan. */
export function GatePassPrint({ id, onClose }: { id: string; onClose: () => void }) {
  const uid = useId();
  const [pass, setPass] = useState<(GatePass & { qr: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    gatePasses.get(id).then(
      (p) => alive && setPass(p),
      (e: unknown) => alive && setError(`The pass didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <DialogFrame
      titleId={`${uid}-title`}
      title="Gate pass"
      subtitle="Show it at the gate or print the PDF. Its code proves the pass is genuine."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Close</Button>
          <a href={gatePasses.pdfUrl(id)} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
            <Printer size={17} aria-hidden />
            Print PDF
          </a>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {!pass && !error && <Skeleton className="h-64" />}
      {pass && (
        // Printing shows the pass alone, not the page behind the dialog.
        <style>{`@media print { body * { visibility: hidden !important; } .gate-pass, .gate-pass * { visibility: visible !important; } .gate-pass { position: fixed; inset: 0; margin: 0 auto; max-width: 32rem; } }`}</style>
      )}
      {pass && (
        <article className="gate-pass rounded-2xl border-2 border-dashed border-neutral-300 p-5" aria-label={`Gate pass ${pass.number ?? ""}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Gate pass</p>
              <p className="mt-1 font-mono text-xl font-bold text-neutral-900">{pass.number}</p>
              <div className="mt-2">
                <PassStateChip pass={pass} />
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pass.qr} alt={`QR code for gate pass ${pass.number ?? ""}`} width={128} height={128} className="h-32 w-32 shrink-0 rounded-lg bg-white p-1 ring-1 ring-neutral-200" />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-neutral-500">Holder</dt>
              <dd className="mt-0.5 font-semibold text-neutral-900">{pass.holder ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500">Going to</dt>
              <dd className="mt-0.5 text-neutral-900">{pass.destination ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500">Out</dt>
              <dd className="mt-0.5 tabular-nums text-neutral-900">{stampOf(pass.outAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500">Due back</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">{day(pass.dueBackOn)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-neutral-500">Purpose</dt>
              <dd className="mt-0.5 text-neutral-900">{pass.purpose ?? "-"}</dd>
            </div>
          </dl>
          <ul className="mt-5 space-y-1.5 border-t border-dashed border-neutral-300 pt-4 text-sm">
            {pass.assets.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <span className="font-mono font-semibold text-neutral-900">{a.tagNo ?? "-"}</span>
                <span className="text-neutral-700">{a.name}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </DialogFrame>
  );
}

/** Checking a pass back in: each asset goes back to what it was before it went out. */
export function CheckInDialog({ pass, onDone, onClose }: { pass: GatePass; onDone: (p: GatePass) => void; onClose: () => void }) {
  const uid = useId();
  const [cond, setCond] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <DialogFrame
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onDone(await gatePasses.checkIn(pass.id, (cond || null) as AssetCondition | null));
        } catch (err) {
          setError(opsError(err));
          setBusy(false);
        }
      }}
      titleId={`${uid}-title`}
      title={`Check in ${pass.number ?? "the pass"}`}
      subtitle={`${pass.assets.map((a) => a.tagNo ?? a.name).join(", ")} back from ${pass.destination ?? "outside"}.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Checking in…" : "Check it in"}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-cond`} label="Condition it came back in" hint="Optional">
        <SearchableSelect
          id={`${uid}-cond`}
          value={cond}
          onChange={setCond}
          clearable
          clearLabel="As it went out"
          placeholder="As it went out"
          searchPlaceholder="Search conditions"
          options={CONDITION_ORDER.map((c) => ({ value: c, label: CONDITION[c].label }))}
        />
      </Field>
      <p className="flex items-start gap-2 text-sm text-neutral-600">
        <CalendarRange size={16} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
        Each asset goes back to where it was before it went out: with its holder, or in store.
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
