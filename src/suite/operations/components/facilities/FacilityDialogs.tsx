"use client";

import { useId, useState } from "react";
import { CircleCheck, CircleX, Fuel, PlugZap } from "lucide-react";
import { Button, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { todayYmd } from "@/components/workspace/Calendar";
import { ErrorNote, Field, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { amount, amountInput, monthLabel, parseAmount } from "@/suite/finance/lib/format";
import {
  facilities,
  opsError,
  opsFieldErrors,
  type ContractFull,
  type ContractInput,
  type DieselKind,
  type Facility,
  type FacilityInput,
  type Generator,
  type Lease,
  type LeaseFrequency,
  type LeaseInput,
  type PaidVia,
  type Space,
  type SpaceKind,
  type UtilityAccount,
} from "@/lib/api/operations-facilities-client";
import { LEASE_FREQUENCIES, PAID_VIA, SPACE_KINDS, UTILITY_KINDS, litres } from "./labels";
import { StarPicker, useOpsPickers } from "./parts";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/*
  Every form on the facilities desk: a site, a room, a lease, a utility
  account and its bill, the diesel log, a service contract and its monthly
  confirmation, and a visitor. Each validates what it can before it asks,
  shows the API's own words when it refuses, and scrolls on a small screen.
*/

const opts = (r: Record<string, string>): SelectOption[] => Object.entries(r).map(([value, label]) => ({ value, label }));

const intOrNull = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

/** The save-or-cancel row every dialog ends with. */
function Footer({ onClose, busy, label, busyLabel = "Saving…", danger = false }: { onClose: () => void; busy: boolean; label: string; busyLabel?: string; danger?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}

/** Runs a save, keeping the API's field errors and its message. */
function useSave() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (check: Record<string, string>, save: () => Promise<void>) => {
    setErrors(check);
    if (Object.keys(check).length) return;
    setBusy(true);
    setError(null);
    try {
      await save();
    } catch (e) {
      setErrors(opsFieldErrors(e));
      setError(opsError(e));
      setBusy(false);
    }
  };
  return { errors, error, busy, run };
}

/* ------------------------------- a site ------------------------------ */

export function FacilityDialog({ facility, kinds, onClose, onDone }: { facility?: Facility; kinds: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const f = facility;
  const { staff } = useOpsPickers();
  const [code, setCode] = useState(f?.code ?? "");
  const [name, setName] = useState(f?.name ?? "");
  const [kind, setKind] = useState(f?.kind ?? "office");
  const [ownership, setOwnership] = useState<"owned" | "leased">(f?.ownership ?? "owned");
  const [address, setAddress] = useState(f?.address ?? "");
  const [area, setArea] = useState(f?.areaSqm != null ? String(f.areaSqm) : "");
  const [headcount, setHeadcount] = useState(f?.headcount != null ? String(f.headcount) : "");
  const [tank, setTank] = useState(f?.tankLitres != null ? String(f.tankLitres) : "");
  const [managerId, setManagerId] = useState(f?.managerId ?? "");
  const [active, setActive] = useState(f?.active ?? true);
  const { errors, error, busy, run } = useSave();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check: Record<string, string> = {};
    if (!code.trim()) check.code = "Give the site a short code, like HQ.";
    if (!name.trim()) check.name = "Name the site.";
    const a = intOrNull(area);
    const h = intOrNull(headcount);
    if (Number.isNaN(a) || (a !== null && a < 0)) check.areaSqm = "Enter the area in square metres.";
    if (Number.isNaN(h) || (h !== null && h < 0)) check.headcount = "Enter how many people work here.";
    const t = intOrNull(tank);
    if (Number.isNaN(t) || (t !== null && t < 1)) check.tankLitres = "Enter the tank size in litres, or leave it empty.";
    const input: FacilityInput = { code: code.trim(), name: name.trim(), kind, ownership, address: address.trim() || null, areaSqm: a, headcount: h, tankLitres: t, managerId: managerId || null, ...(f ? { active } : {}) };
    void run(check, async () => {
      if (f) await facilities.update(f.id, input);
      else await facilities.create(input);
      onDone();
    });
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-t`}
      title={f ? `Edit ${f.name}` : "Add a site"}
      subtitle="An office, campus, warehouse or project site your organisation runs."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={f ? "Save changes" : "Add the site"} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <Field id={`${uid}-code`} label="Code">
          <input id={`${uid}-code`} className={inputClass} value={code} maxLength={20} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="HQ" aria-invalid={errors.code ? true : undefined} />
          <FieldError message={errors.code} />
        </Field>
        <Field id={`${uid}-name`} label="Name">
          <input id={`${uid}-name`} className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="Head office, Victoria Island" aria-invalid={errors.name ? true : undefined} />
          <FieldError message={errors.name} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-kind`} label="Kind of site">
          <SearchableSelect id={`${uid}-kind`} value={kind} onChange={setKind} options={opts(kinds)} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Owned or leased</p>
          <Segmented
            label="Owned or leased"
            value={ownership}
            onChange={setOwnership}
            options={[
              { key: "owned", label: "Owned" },
              { key: "leased", label: "Leased" },
            ]}
          />
        </div>
      </div>
      <Field id={`${uid}-addr`} label="Address" hint="Optional">
        <input id={`${uid}-addr`} className={inputClass} value={address} maxLength={255} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-area`} label="Area (m²)" hint="Optional">
          <input id={`${uid}-area`} inputMode="numeric" className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} aria-invalid={errors.areaSqm ? true : undefined} />
          <FieldError message={errors.areaSqm} />
        </Field>
        <Field id={`${uid}-head`} label="Headcount" hint="For cost per head">
          <input id={`${uid}-head`} inputMode="numeric" className={inputClass} value={headcount} onChange={(e) => setHeadcount(e.target.value)} aria-invalid={errors.headcount ? true : undefined} />
          <FieldError message={errors.headcount} />
        </Field>
        <Field id={`${uid}-tank`} label="Diesel tank (litres)" hint="Optional. Diesel bought in can't exceed it">
          <input id={`${uid}-tank`} inputMode="numeric" className={inputClass} value={tank} onChange={(e) => setTank(e.target.value)} aria-invalid={errors.tankLitres ? true : undefined} />
          <FieldError message={errors.tankLitres} />
        </Field>
        <Field id={`${uid}-mgr`} label="Facility manager">
          <SearchableSelect id={`${uid}-mgr`} value={managerId} onChange={setManagerId} options={staff ?? []} clearable noOptionsText={staff ? "No staff yet" : "Loading staff…"} placeholder="Choose" />
        </Field>
      </div>
      {f && (
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
          <span>
            <span className="block text-sm font-semibold text-neutral-900">In use</span>
            <span className="block text-xs text-neutral-500">A site no longer used drops out of staff pickers.</span>
          </span>
          <Switch checked={active} onChange={setActive} label="In use" />
        </label>
      )}
    </DialogFrame>
  );
}

/* ------------------------------- a room ------------------------------ */

export function SpaceDialog({ facilityId, space, onClose, onDone }: { facilityId: string; space?: Space; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const [name, setName] = useState(space?.name ?? "");
  const [kind, setKind] = useState<SpaceKind>(space?.kind ?? "meeting_room");
  const [capacity, setCapacity] = useState(space?.capacity != null ? String(space.capacity) : "");
  const [bookable, setBookable] = useState(space?.bookable ?? true);
  const { errors, error, busy, run } = useSave();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check: Record<string, string> = {};
    if (!name.trim()) check.name = "Name the room.";
    const c = intOrNull(capacity);
    if (Number.isNaN(c) || (c !== null && c < 1)) check.capacity = "Seats is a whole number, at least 1.";
    void run(check, async () => {
      const input = { name: name.trim(), kind, capacity: c, bookable };
      if (space) await facilities.updateSpace(space.id, input);
      else await facilities.addSpace(facilityId, input);
      onDone();
    });
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={space ? `Edit ${space.name}` : "Add a room"}
      subtitle="Bookable rooms show on everybody's room calendar."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={space ? "Save changes" : "Add the room"} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field id={`${uid}-n`} label="Name">
        <input id={`${uid}-n`} className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Board room" aria-invalid={errors.name ? true : undefined} />
        <FieldError message={errors.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-k`} label="Kind">
          <SearchableSelect id={`${uid}-k`} value={kind} onChange={(v) => setKind(v as SpaceKind)} options={opts(SPACE_KINDS)} />
        </Field>
        <Field id={`${uid}-c`} label="Seats" hint="Optional">
          <input id={`${uid}-c`} inputMode="numeric" className={inputClass} value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-invalid={errors.capacity ? true : undefined} />
          <FieldError message={errors.capacity} />
        </Field>
      </div>
      <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
        <span>
          <span className="block text-sm font-semibold text-neutral-900">Staff can book it</span>
          <span className="block text-xs text-neutral-500">It shows under “Book a room or vehicle”.</span>
        </span>
        <Switch checked={bookable} onChange={setBookable} label="Staff can book it" />
      </label>
    </DialogFrame>
  );
}

/* ------------------------------- a lease ----------------------------- */

export function LeaseDialog({
  lease,
  facilityId,
  sites,
  onClose,
  onDone,
}: {
  lease?: Lease;
  /** Fixed when added from a site's page. */
  facilityId?: string;
  sites?: SelectOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const uid = useId();
  const l = lease;
  const { vendors } = useOpsPickers();
  const [site, setSite] = useState(l?.facilityId ?? facilityId ?? "");
  const [landlordId, setLandlordId] = useState(l?.landlordId ?? "");
  const [reference, setReference] = useState(l?.reference ?? "");
  const [startsOn, setStartsOn] = useState(l?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(l?.endsOn ?? "");
  const [rent, setRent] = useState(amountInput(l?.rent));
  const [frequency, setFrequency] = useState<LeaseFrequency>(l?.frequency ?? "annual");
  const [service, setService] = useState(amountInput(l?.serviceCharge));
  const [escalation, setEscalation] = useState(l?.escalationBp ? String(l.escalationBp / 100) : "");
  const [every, setEvery] = useState(l?.escalationEveryMonths ? String(l.escalationEveryMonths) : "12");
  const [notice, setNotice] = useState(l?.noticeDays != null ? String(l.noticeDays) : "90");
  const [lead, setLead] = useState(l?.memoLeadDays != null ? String(l.memoLeadDays) : "14");
  const [notes, setNotes] = useState(l?.notes ?? "");
  const [ended, setEnded] = useState(l?.status === "ended");
  const { errors, error, busy, run } = useSave();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check: Record<string, string> = {};
    if (!site) check.facilityId = "Choose the site.";
    if (!startsOn) check.startsOn = "When does the lease start?";
    if (!endsOn) check.endsOn = "When does it end?";
    if (startsOn && endsOn && endsOn <= startsOn) check.endsOn = "The lease ends after it starts.";
    const rentK = parseAmount(rent);
    if (!rentK) check.rent = "Enter the rent per instalment in naira, like 6,000,000.";
    const sc = service.trim() ? parseAmount(service) : 0;
    if (sc === null) check.serviceCharge = "Enter the service charge in naira.";
    const pct = escalation.trim() ? Number(escalation) : 0;
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) check.escalationBp = "A percentage from 0 to 100.";
    const ev = intOrNull(every);
    if (pct > 0 && (!ev || Number.isNaN(ev) || ev < 1 || ev > 120)) check.escalationEveryMonths = "Every 1 to 120 months.";
    const nd = intOrNull(notice);
    const ld = intOrNull(lead);
    if (Number.isNaN(nd) || (nd !== null && (nd < 0 || nd > 730))) check.noticeDays = "0 to 730 days.";
    if (Number.isNaN(ld) || (ld !== null && (ld < 0 || ld > 90))) check.memoLeadDays = "0 to 90 days.";
    const input: LeaseInput = {
      facilityId: site,
      landlordId: landlordId || null,
      reference: reference.trim() || null,
      startsOn,
      endsOn,
      rent: rentK ?? 0,
      frequency,
      serviceCharge: sc ?? 0,
      escalationBp: Math.round(pct * 100),
      ...(ev && pct > 0 ? { escalationEveryMonths: ev } : {}),
      ...(nd !== null && !Number.isNaN(nd) ? { noticeDays: nd } : {}),
      ...(ld !== null && !Number.isNaN(ld) ? { memoLeadDays: ld } : {}),
      notes: notes.trim() || null,
      ...(l ? { status: ended ? "ended" : "active" } : {}),
    };
    void run(check, async () => {
      if (l) await facilities.updateLease(l.id, input);
      else await facilities.createLease(input);
      onDone();
    });
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-t`}
      title={l ? "Edit the lease" : "Add a lease"}
      subtitle="Each rent instalment becomes a payment memo for Finance before its due date."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={l ? "Save changes" : "Add the lease"} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        {!facilityId && (
          <Field id={`${uid}-site`} label="Site">
            <SearchableSelect id={`${uid}-site`} value={site} onChange={setSite} options={sites ?? []} placeholder="Choose the site" aria-invalid={errors.facilityId ? true : undefined} />
            <FieldError message={errors.facilityId} />
          </Field>
        )}
        <Field id={`${uid}-ll`} label="Landlord" hint="A counterparty">
          <SearchableSelect id={`${uid}-ll`} value={landlordId} onChange={setLandlordId} options={vendors ?? []} clearable placeholder="Choose" noOptionsText={vendors ? "No counterparties yet" : "Loading…"} aria-invalid={errors.landlordId ? true : undefined} />
          <FieldError message={errors.landlordId} />
        </Field>
        <Field id={`${uid}-ref`} label="Reference" hint="Optional">
          <input id={`${uid}-ref`} className={inputClass} value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} placeholder="LSE/HQ/2026" />
        </Field>
        <Field id={`${uid}-s`} label="Starts on">
          <input id={`${uid}-s`} type="date" className={inputClass} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} aria-invalid={errors.startsOn ? true : undefined} />
          <FieldError message={errors.startsOn} />
        </Field>
        <Field id={`${uid}-e`} label="Ends on">
          <input id={`${uid}-e`} type="date" className={inputClass} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} aria-invalid={errors.endsOn ? true : undefined} />
          <FieldError message={errors.endsOn} />
        </Field>
      </div>
      <fieldset className="rounded-2xl border border-neutral-200/80 p-4">
        <legend className="px-1 text-sm font-semibold text-neutral-900">Rent</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={`${uid}-r`} label="Per instalment (₦)">
            <input id={`${uid}-r`} inputMode="decimal" className={inputClass} value={rent} onChange={(e) => setRent(e.target.value)} placeholder="6,000,000" aria-invalid={errors.rent ? true : undefined} />
            <FieldError message={errors.rent} />
          </Field>
          <Field id={`${uid}-f`} label="Paid">
            <SearchableSelect id={`${uid}-f`} value={frequency} onChange={(v) => setFrequency(v as LeaseFrequency)} options={Object.entries(LEASE_FREQUENCIES).map(([value, x]) => ({ value, label: x.label }))} />
          </Field>
          <Field id={`${uid}-sc`} label="Service charge (₦)" hint="Per instalment">
            <input id={`${uid}-sc`} inputMode="decimal" className={inputClass} value={service} onChange={(e) => setService(e.target.value)} aria-invalid={errors.serviceCharge ? true : undefined} />
            <FieldError message={errors.serviceCharge} />
          </Field>
          <Field id={`${uid}-esc`} label="Escalation (%)" hint="Optional">
            <input id={`${uid}-esc`} inputMode="decimal" className={inputClass} value={escalation} onChange={(e) => setEscalation(e.target.value)} placeholder="10" aria-invalid={errors.escalationBp ? true : undefined} />
            <FieldError message={errors.escalationBp} />
          </Field>
          <Field id={`${uid}-ev`} label="Every (months)">
            <input id={`${uid}-ev`} inputMode="numeric" className={inputClass} value={every} onChange={(e) => setEvery(e.target.value)} aria-invalid={errors.escalationEveryMonths ? true : undefined} />
            <FieldError message={errors.escalationEveryMonths} />
          </Field>
          <Field id={`${uid}-ld`} label="Memo lead (days)" hint="Before due">
            <input id={`${uid}-ld`} inputMode="numeric" className={inputClass} value={lead} onChange={(e) => setLead(e.target.value)} aria-invalid={errors.memoLeadDays ? true : undefined} />
            <FieldError message={errors.memoLeadDays} />
          </Field>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field id={`${uid}-nd`} label="Notice (days)">
          <input id={`${uid}-nd`} inputMode="numeric" className={inputClass} value={notice} onChange={(e) => setNotice(e.target.value)} aria-invalid={errors.noticeDays ? true : undefined} />
          <FieldError message={errors.noticeDays} />
        </Field>
        <Field id={`${uid}-no`} label="Notes" hint="Optional">
          <input id={`${uid}-no`} className={inputClass} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {l && (
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
          <span>
            <span className="block text-sm font-semibold text-neutral-900">The lease has ended</span>
            <span className="block text-xs text-neutral-500">No more rent memos are raised for an ended lease.</span>
          </span>
          <Switch checked={ended} onChange={setEnded} label="The lease has ended" />
        </label>
      )}
    </DialogFrame>
  );
}

/* --------------------------- a utility account ----------------------- */

export function UtilityDialog({ facilityId, utility, onClose, onDone }: { facilityId: string; utility?: UtilityAccount; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const u = utility;
  const { vendors } = useOpsPickers();
  const [kind, setKind] = useState(u?.kind ?? "electricity");
  const [providerId, setProviderId] = useState(u?.providerId ?? "");
  const [accountNo, setAccountNo] = useState(u?.accountNo ?? "");
  const [billing, setBilling] = useState<"prepaid" | "postpaid">(u?.billing ?? "postpaid");
  const [unit, setUnit] = useState(u?.unit ?? (u ? "" : "kWh"));
  const [active, setActive] = useState(u?.active ?? true);
  const { errors, error, busy, run } = useSave();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run({}, async () => {
      const input = { facilityId, kind, providerId: providerId || null, accountNo: accountNo.trim() || null, billing, unit: unit.trim() || null, ...(u ? { active } : {}) };
      if (u) await facilities.updateUtility(u.id, input);
      else await facilities.createUtility(input);
      onDone();
    });
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={u ? `Edit the ${u.kindLabel.toLowerCase()} account` : "Add a utility account"}
      subtitle="Monthly bills entered against it feed the spend chart."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={u ? "Save changes" : "Add the account"} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-k`} label="Utility">
          <SearchableSelect id={`${uid}-k`} value={kind} onChange={setKind} options={opts(UTILITY_KINDS)} aria-invalid={errors.kind ? true : undefined} />
          <FieldError message={errors.kind} />
        </Field>
        <Field id={`${uid}-p`} label="Provider" hint="Optional">
          <SearchableSelect id={`${uid}-p`} value={providerId} onChange={setProviderId} options={vendors ?? []} clearable placeholder="Choose" noOptionsText={vendors ? "No counterparties yet" : "Loading…"} />
        </Field>
        <Field id={`${uid}-a`} label="Account or meter number" hint="Optional">
          <input id={`${uid}-a`} className={inputClass} value={accountNo} maxLength={60} onChange={(e) => setAccountNo(e.target.value)} />
        </Field>
        <Field id={`${uid}-u`} label="Unit" hint="kWh, m³…">
          <input id={`${uid}-u`} className={inputClass} value={unit} maxLength={12} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">Billing</p>
        <Segmented
          label="Billing"
          value={billing}
          onChange={setBilling}
          options={[
            { key: "postpaid", label: "Postpaid" },
            { key: "prepaid", label: "Prepaid" },
          ]}
        />
      </div>
      {u && (
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
          <span className="text-sm font-semibold text-neutral-900">Account in use</span>
          <Switch checked={active} onChange={setActive} label="Account in use" />
        </label>
      )}
    </DialogFrame>
  );
}

export function BillDialog({ utility, onClose, onDone }: { utility: UtilityAccount; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const last = todayYmd().slice(0, 7);
  const [month, setMonth] = useState(last);
  const [amt, setAmt] = useState("");
  const [units, setUnits] = useState("");
  const [reference, setReference] = useState("");
  const { errors, error, busy, run } = useSave();
  const replacing = utility.bills.some((b) => b.month === month);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check: Record<string, string> = {};
    if (!/^\d{4}-\d{2}$/.test(month)) check.month = "Choose the month the bill is for.";
    const k = parseAmount(amt);
    if (!k) check.amount = "Enter the amount in naira, like 380,000.";
    const u = units.trim() ? Number(units) : null;
    if (u !== null && (!Number.isFinite(u) || u < 0)) check.units = "Units is a number.";
    void run(check, async () => {
      await facilities.addBill(utility.id, { month, amount: k ?? 0, units: u, reference: reference.trim() || null });
      onDone();
    });
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={`Add a ${utility.kindLabel.toLowerCase()} bill`}
      subtitle={[utility.provider, utility.accountNo].filter(Boolean).join(" · ") || "Enter the month's bill."}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={replacing ? "Replace the bill" : "Add the bill"} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-m`} label="Month">
          <input id={`${uid}-m`} type="month" className={inputClass} value={month} max={last} onChange={(e) => setMonth(e.target.value)} aria-invalid={errors.month ? true : undefined} />
          <FieldError message={errors.month} />
        </Field>
        <Field id={`${uid}-a`} label="Amount (₦)">
          <input id={`${uid}-a`} inputMode="decimal" className={inputClass} value={amt} onChange={(e) => setAmt(e.target.value)} aria-invalid={errors.amount ? true : undefined} />
          <FieldError message={errors.amount} />
        </Field>
        <Field id={`${uid}-u`} label={`Units${utility.unit ? ` (${utility.unit})` : ""}`} hint="Optional">
          <input id={`${uid}-u`} inputMode="decimal" className={inputClass} value={units} onChange={(e) => setUnits(e.target.value)} aria-invalid={errors.units ? true : undefined} />
          <FieldError message={errors.units} />
        </Field>
        <Field id={`${uid}-r`} label="Reference" hint="Optional">
          <input id={`${uid}-r`} className={inputClass} value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
      {replacing && <p className="rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-700">There is already a bill for {monthLabel(month)}. Saving replaces it.</p>}
    </DialogFrame>
  );
}

/* ------------------------------- diesel ------------------------------ */

export function DieselDialog({ facility, tank, generators, onClose, onDone }: { facility: { id: string; name: string }; tank: number; generators: Generator[]; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const { vendors } = useOpsPickers();
  const [kind, setKind] = useState<DieselKind>("diesel_in");
  const [enteredOn, setEnteredOn] = useState(todayYmd());
  const [amountL, setAmountL] = useState("");
  const [cost, setCost] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [paidVia, setPaidVia] = useState("");
  const [assetId, setAssetId] = useState(generators.length === 1 ? generators[0].id : "");
  const [reading, setReading] = useState("");
  const { errors, error, busy, run } = useSave();
  const used = kind === "diesel_used";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check: Record<string, string> = {};
    const l = Number(amountL);
    if (!amountL.trim() || !Number.isFinite(l) || l < 0.1) check.litres = "Enter the litres, at least 0.1.";
    else if (used && l > tank) check.litres = `The tank holds ${litres(tank)} by the log.`;
    if (used && !assetId) check.assetId = "Which generator used it?";
    const k = !used && cost.trim() ? parseAmount(cost) : 0;
    if (k === null) check.amount = "Enter the cost in naira.";
    const r = reading.trim() ? Number(reading) : null;
    if (r !== null && (!Number.isFinite(r) || r < 0)) check.reading = "Running hours is a number.";
    if (!enteredOn || enteredOn > todayYmd()) check.enteredOn = "Choose a day up to today.";
    void run(check, async () => {
      await facilities.diesel({
        kind,
        facilityId: facility.id,
        litres: l,
        enteredOn,
        ...(used ? { assetId, reading: r } : { amount: k ?? 0, vendorId: vendorId || null, paidVia: (paidVia || null) as PaidVia | null }),
      });
      onDone();
    });
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Record diesel"
      subtitle={`${facility.name}: ${litres(tank)} in the tank by the log.`}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={used ? "Record diesel used" : "Record diesel bought"} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div role="radiogroup" aria-label="What happened" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {(
          [
            { key: "diesel_in", label: "Bought into the tank", icon: Fuel },
            { key: "diesel_used", label: "Used by a generator", icon: PlugZap },
          ] as const
        ).map((o) => {
          const on = kind === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setKind(o.key)}
              className={cx(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                on ? "border-primary-300 bg-primary-50 text-primary-800" : "border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300",
              )}
            >
              <o.icon size={18} aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-d`} label="On">
          <input id={`${uid}-d`} type="date" className={inputClass} value={enteredOn} max={todayYmd()} onChange={(e) => setEnteredOn(e.target.value)} aria-invalid={errors.enteredOn ? true : undefined} />
          <FieldError message={errors.enteredOn} />
        </Field>
        <Field id={`${uid}-l`} label="Litres">
          <input id={`${uid}-l`} inputMode="decimal" className={inputClass} value={amountL} onChange={(e) => setAmountL(e.target.value)} aria-invalid={errors.litres ? true : undefined} />
          <FieldError message={errors.litres} />
        </Field>
        {used ? (
          <>
            <Field id={`${uid}-g`} label="Generator">
              <SearchableSelect
                id={`${uid}-g`}
                value={assetId}
                onChange={setAssetId}
                options={generators.map((g) => ({ value: g.id, label: g.name ?? g.tagNo ?? "Generator", hint: g.tagNo ?? undefined }))}
                noOptionsText="No generator is on the asset register (category GEN)."
                placeholder="Choose"
                aria-invalid={errors.assetId ? true : undefined}
              />
              <FieldError message={errors.assetId} />
            </Field>
            <Field id={`${uid}-h`} label="Running hours now" hint="From the hour meter">
              <input id={`${uid}-h`} inputMode="decimal" className={inputClass} value={reading} onChange={(e) => setReading(e.target.value)} aria-invalid={errors.reading ? true : undefined} />
              <FieldError message={errors.reading} />
            </Field>
          </>
        ) : (
          <>
            <Field id={`${uid}-c`} label="Cost (₦)">
              <input id={`${uid}-c`} inputMode="decimal" className={inputClass} value={cost} onChange={(e) => setCost(e.target.value)} aria-invalid={errors.amount ? true : undefined} />
              <FieldError message={errors.amount} />
            </Field>
            <Field id={`${uid}-v`} label="Supplier" hint="Optional">
              <SearchableSelect id={`${uid}-v`} value={vendorId} onChange={setVendorId} options={vendors ?? []} clearable placeholder="Choose" noOptionsText={vendors ? "No vendors yet" : "Loading…"} />
            </Field>
            <Field id={`${uid}-pv`} label="Paid by" hint="Optional" className="sm:col-span-2">
              <SearchableSelect id={`${uid}-pv`} value={paidVia} onChange={setPaidVia} options={opts(PAID_VIA)} clearable placeholder="Choose" />
            </Field>
          </>
        )}
      </div>
    </DialogFrame>
  );
}

/* --------------------------- service contracts ----------------------- */

export function ContractDialog({
  contract,
  services,
  sites,
  facilityId,
  onClose,
  onDone,
}: {
  contract?: ContractFull;
  services: Record<string, string>;
  sites: SelectOption[];
  facilityId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const uid = useId();
  const c = contract;
  const { vendors, staff } = useOpsPickers();
  const [service, setService] = useState(c?.service ?? "");
  const [vendorId, setVendorId] = useState(c?.vendorId ?? "");
  const [site, setSite] = useState(c?.facilityId ?? facilityId ?? "");
  const [reference, setReference] = useState(c?.reference ?? "");
  const [startsOn, setStartsOn] = useState(c?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(c?.endsOn ?? "");
  const [periodAmount, setPeriodAmount] = useState(amountInput(c?.periodAmount));
  const [value, setValue] = useState(amountInput(c?.value));
  const [frequency, setFrequency] = useState<"monthly" | "quarterly">(c?.frequency ?? "monthly");
  const [sla, setSla] = useState(c?.sla ?? "");
  const [scope, setScope] = useState(c?.scope ?? "");
  const [notice, setNotice] = useState(c?.renewalNoticeDays != null ? String(c.renewalNoticeDays) : "60");
  const [officerId, setOfficerId] = useState(c?.officerId ?? "");
  const [status, setStatus] = useState(c?.status ?? "active");
  const { errors, error, busy, run } = useSave();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check: Record<string, string> = {};
    if (!service) check.service = "Choose the service.";
    if (!vendorId) check.vendorId = "Choose the vendor.";
    if (!startsOn) check.startsOn = "When does it start?";
    if (!endsOn) check.endsOn = "When does it end?";
    if (startsOn && endsOn && endsOn <= startsOn) check.endsOn = "The contract ends after it starts.";
    const pa = periodAmount.trim() ? parseAmount(periodAmount) : 0;
    if (pa === null) check.periodAmount = "Enter the amount in naira.";
    const v = value.trim() ? parseAmount(value) : 0;
    if (v === null) check.value = "Enter the value in naira.";
    const n = intOrNull(notice);
    if (Number.isNaN(n) || (n !== null && (n < 0 || n > 365))) check.renewalNoticeDays = "0 to 365 days.";
    const input: ContractInput = {
      service,
      vendorId,
      facilityId: site || null,
      reference: reference.trim() || null,
      startsOn,
      endsOn,
      periodAmount: pa ?? 0,
      value: v ?? 0,
      frequency,
      sla: sla.trim() || null,
      scope: scope.trim() || null,
      ...(n !== null && !Number.isNaN(n) ? { renewalNoticeDays: n } : {}),
      officerId: officerId || null,
      ...(c ? { status: status as ContractInput["status"] } : {}),
    };
    void run(check, async () => {
      if (c) await facilities.updateContract(c.id, input);
      else await facilities.createContract(input);
      onDone();
    });
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-t`}
      title={c ? `Edit ${c.serviceLabel.toLowerCase()} contract` : "Add a service contract"}
      subtitle="Each month is confirmed before the vendor is paid. A disputed month pays nothing."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={c ? "Save changes" : "Add the contract"} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-svc`} label="Service">
          <SearchableSelect id={`${uid}-svc`} value={service} onChange={setService} options={opts(services)} placeholder="Choose" aria-invalid={errors.service ? true : undefined} />
          <FieldError message={errors.service} />
        </Field>
        <Field id={`${uid}-v`} label="Vendor">
          <SearchableSelect id={`${uid}-v`} value={vendorId} onChange={setVendorId} options={vendors ?? []} placeholder="Choose" noOptionsText={vendors ? "No vendors yet" : "Loading…"} aria-invalid={errors.vendorId ? true : undefined} />
          <FieldError message={errors.vendorId} />
        </Field>
        <Field id={`${uid}-site`} label="Site" hint="Optional">
          <SearchableSelect id={`${uid}-site`} value={site} onChange={setSite} options={sites} clearable clearLabel="Every site" placeholder="Every site" />
        </Field>
        <Field id={`${uid}-ref`} label="Reference" hint="Optional">
          <input id={`${uid}-ref`} className={inputClass} value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field id={`${uid}-s`} label="Starts on">
          <input id={`${uid}-s`} type="date" className={inputClass} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} aria-invalid={errors.startsOn ? true : undefined} />
          <FieldError message={errors.startsOn} />
        </Field>
        <Field id={`${uid}-e`} label="Ends on">
          <input id={`${uid}-e`} type="date" className={inputClass} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} aria-invalid={errors.endsOn ? true : undefined} />
          <FieldError message={errors.endsOn} />
        </Field>
        <Field id={`${uid}-pa`} label="Paid each period (₦)">
          <input id={`${uid}-pa`} inputMode="decimal" className={inputClass} value={periodAmount} onChange={(e) => setPeriodAmount(e.target.value)} aria-invalid={errors.periodAmount ? true : undefined} />
          <FieldError message={errors.periodAmount} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Period</p>
          <Segmented
            label="Period"
            value={frequency}
            onChange={setFrequency}
            options={[
              { key: "monthly", label: "Monthly" },
              { key: "quarterly", label: "Quarterly" },
            ]}
          />
        </div>
        <Field id={`${uid}-val`} label="Contract value (₦)" hint="Optional">
          <input id={`${uid}-val`} inputMode="decimal" className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={errors.value ? true : undefined} />
          <FieldError message={errors.value} />
        </Field>
        <Field id={`${uid}-n`} label="Renewal notice (days)">
          <input id={`${uid}-n`} inputMode="numeric" className={inputClass} value={notice} onChange={(e) => setNotice(e.target.value)} aria-invalid={errors.renewalNoticeDays ? true : undefined} />
          <FieldError message={errors.renewalNoticeDays} />
        </Field>
        <Field id={`${uid}-o`} label="Contract officer" hint="Confirms each month">
          <SearchableSelect id={`${uid}-o`} value={officerId} onChange={setOfficerId} options={staff ?? []} clearable placeholder="Choose" noOptionsText={staff ? "No staff yet" : "Loading…"} />
        </Field>
        <Field id={`${uid}-sla`} label="Service level" hint="Optional">
          <input id={`${uid}-sla`} className={inputClass} value={sla} maxLength={255} onChange={(e) => setSla(e.target.value)} placeholder="Respond within 4 hours" />
        </Field>
      </div>
      <Field id={`${uid}-sc`} label="Scope" hint="Optional">
        <RichTextEditor id={`${uid}-sc`} value={scope} onChange={setScope} />
      </Field>
      {c && (
        <Field id={`${uid}-st`} label="Status">
          <SearchableSelect
            id={`${uid}-st`}
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "active", label: "Active" },
              { value: "ended", label: "Ended" },
              { value: "terminated", label: "Terminated" },
            ]}
          />
        </Field>
      )}
    </DialogFrame>
  );
}

/** Confirm a month of service (which raises its payment) or dispute it (which pays nothing). */
export function ConfirmMonthDialog({ contract, period, onClose, onDone }: { contract: ContractFull; period: string; onClose: () => void; onDone: (c: ContractFull) => void }) {
  const uid = useId();
  const [confirmed, setConfirmed] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const { errors, error, busy, run } = useSave();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check: Record<string, string> = {};
    if (!confirmed && !notes.trim()) check.notes = "Say what was not delivered.";
    void run(check, async () => {
      onDone(await facilities.confirm(contract.id, { period, confirmed, rating, notes: notes.trim() || null }));
    });
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={`${contract.serviceLabel}: ${monthLabel(period)}`}
      subtitle={`${contract.vendor ?? "The vendor"}${contract.facility ? ` at ${contract.facility}` : ""}. Was the service delivered?`}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={confirmed ? `Confirm and raise ${amount(contract.periodAmount)}` : "Dispute the month"} danger={!confirmed} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div role="radiogroup" aria-label="Was it delivered" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {(
          [
            { on: true, label: "Delivered", hint: "Raise the payment memo", icon: CircleCheck, cls: "border-mint-500/40 bg-mint-50 text-mint-700" },
            { on: false, label: "Not delivered", hint: "Dispute it. Nothing is paid", icon: CircleX, cls: "border-rose-500/40 bg-rose-50 text-rose-700" },
          ] as const
        ).map((o) => {
          const sel = confirmed === o.on;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => setConfirmed(o.on)}
              className={cx(
                "flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                sel ? o.cls : "border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300",
              )}
            >
              <o.icon size={20} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs opacity-80">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-neutral-700">How was the service?</p>
        <StarPicker value={rating} onChange={setRating} label="Rate the service" />
      </div>
      <Field id={`${uid}-n`} label={confirmed ? "Notes" : "What was not delivered"} hint={confirmed ? "Optional" : "Required"}>
        <textarea id={`${uid}-n`} rows={3} className={textareaClass} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} aria-invalid={errors.notes ? true : undefined} />
        <FieldError message={errors.notes} />
      </Field>
    </DialogFrame>
  );
}

/* ------------------------------- visitors ---------------------------- */

/* Registering a visitor moved to `VisitorForm` (reception and hosts share it). */
export { VisitorDialog } from "./VisitorForm";
