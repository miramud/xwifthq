"use client";

import { useId, useState } from "react";
import { Button } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { todayYmd } from "@/components/workspace/Calendar";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { facilities, myVisitors, opsError, opsFieldErrors, type Visitor, type VisitorInput } from "@/lib/api/operations-facilities-client";
import { localHm, localIso, localYmd } from "./labels";
import { useOpsPickers } from "./parts";

/**
 * Registering an expected visitor: what reception needs at the gate. One
 * form, two doors - reception registers anybody for any host
 * (`VisitorDialog`); a member of staff registers their own guest
 * (`HostVisitorDialog`), and is always the host. Both also change a visit
 * that is still expected: pass the `visitor`.
 */

export interface VisitorDraft {
  name: string;
  company: string;
  phone: string;
  email: string;
  purpose: string;
  site: string;
  day: string;
  from: string;
  until: string;
  party: string;
  plate: string;
  notes: string;
}

/** An existing visit as the form shows it. Exported for the tests. */
export function draftFromVisitor(v: Visitor): VisitorDraft {
  return {
    name: v.name,
    company: v.company ?? "",
    phone: v.phone ?? "",
    email: v.email ?? "",
    purpose: v.purpose ?? "",
    site: v.facilityId ?? "",
    day: v.expectedAt ? localYmd(v.expectedAt) : "",
    from: v.expectedAt ? localHm(v.expectedAt) : "",
    until: v.expectedUntil ? localHm(v.expectedUntil) : "",
    party: String(v.partySize ?? 1),
    plate: v.vehiclePlate ?? "",
    notes: v.notes ?? "",
  };
}

/** The checks both doors make before anything is sent. Exported for the tests. */
export function checkVisitor(d: VisitorDraft, needsTime: boolean): Record<string, string> {
  const found: Record<string, string> = {};
  if (!d.name.trim()) found.name = "Enter the visitor's name.";
  if (needsTime && (!d.day || !d.from)) found.expectedAt = "Say when they are expected.";
  if (needsTime && d.day && d.day < todayYmd()) found.expectedAt = "That day has passed. Register a visit from today on.";
  if (d.until && d.from && d.until <= d.from) found.expectedUntil = "The window ends after they arrive.";
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) found.email = "That doesn't look like an email address.";
  const n = Number(d.party);
  if (d.party.trim() && (!Number.isInteger(n) || n < 1 || n > 200)) found.partySize = "Between 1 and 200 people.";
  return found;
}

/** The draft as the API takes it. Exported for the tests. */
export function visitorInput(d: VisitorDraft): Omit<VisitorInput, "hostId"> {
  const t = (v: string) => v.trim() || null;
  return {
    name: d.name.trim(),
    company: t(d.company),
    phone: t(d.phone),
    email: t(d.email),
    purpose: t(d.purpose),
    facilityId: d.site || null,
    expectedAt: d.day && d.from ? localIso(d.day, d.from) : null,
    expectedUntil: d.day && d.from && d.until ? localIso(d.day, d.until) : null,
    partySize: d.party.trim() ? Number(d.party) : 1,
    vehiclePlate: t(d.plate),
    notes: t(d.notes),
  };
}

function VisitorFormDialog({
  title,
  subtitle,
  submitLabel,
  sites,
  on,
  needsTime,
  hostField,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  sites: SelectOption[];
  on: string;
  needsTime: boolean;
  hostField?: (errors: Record<string, string>) => React.ReactNode;
  /** Editing: the visit as it stands. */
  initial?: VisitorDraft;
  onClose: () => void;
  onSubmit: (input: Omit<VisitorInput, "hostId">) => Promise<void>;
}) {
  const uid = useId();
  const [d, setD] = useState<VisitorDraft>(() => initial ?? {
    name: "",
    company: "",
    phone: "",
    email: "",
    purpose: "",
    site: sites.length === 1 ? sites[0].value : "",
    day: on,
    from: "10:00",
    until: "",
    party: "1",
    plate: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof VisitorDraft) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = checkVisitor(d, needsTime);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(visitorInput(d));
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      titleId={`${uid}-t`}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-n`} label="Visitor's name">
          <input id={`${uid}-n`} className={inputClass} value={d.name} maxLength={160} autoComplete="off" onChange={(e) => set("name")(e.target.value)} aria-invalid={errors.name ? true : undefined} />
          <FieldError message={errors.name} />
        </Field>
        <Field id={`${uid}-c`} label="Organisation" hint="Optional">
          <input id={`${uid}-c`} className={inputClass} value={d.company} maxLength={160} onChange={(e) => set("company")(e.target.value)} />
        </Field>
        <Field id={`${uid}-p`} label="Phone" hint="Optional">
          <input id={`${uid}-p`} type="tel" className={inputClass} value={d.phone} maxLength={40} autoComplete="off" onChange={(e) => set("phone")(e.target.value)} />
        </Field>
        <Field id={`${uid}-e`} label="Email" hint="Optional">
          <input id={`${uid}-e`} type="email" className={inputClass} value={d.email} maxLength={255} autoComplete="off" onChange={(e) => set("email")(e.target.value)} aria-invalid={errors.email ? true : undefined} />
          <FieldError message={errors.email} />
        </Field>
        {hostField?.(errors)}
        <Field id={`${uid}-s`} label="Site" hint="Optional">
          <SearchableSelect id={`${uid}-s`} value={d.site} onChange={set("site")} options={sites} clearable placeholder="Choose" noOptionsText="No sites yet" aria-invalid={errors.facilityId ? true : undefined} />
          <FieldError message={errors.facilityId} />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] gap-2 sm:col-span-2">
          <Field id={`${uid}-d`} label="Expected on">
            <input id={`${uid}-d`} type="date" className={inputClass} value={d.day} min={needsTime ? todayYmd() : undefined} onChange={(e) => set("day")(e.target.value)} aria-invalid={errors.expectedAt ? true : undefined} />
          </Field>
          <Field id={`${uid}-f`} label="From">
            <input id={`${uid}-f`} type="time" className={inputClass} value={d.from} onChange={(e) => set("from")(e.target.value)} />
          </Field>
          <Field id={`${uid}-u`} label="Until" hint="Optional">
            <input id={`${uid}-u`} type="time" className={inputClass} value={d.until} onChange={(e) => set("until")(e.target.value)} aria-invalid={errors.expectedUntil ? true : undefined} />
          </Field>
          <div className="col-span-3 -mt-2">
            <FieldError message={errors.expectedAt ?? errors.expectedUntil} />
          </div>
        </div>
        <Field id={`${uid}-ps`} label="People in the party">
          <input id={`${uid}-ps`} type="number" inputMode="numeric" min={1} max={200} className={inputClass} value={d.party} onChange={(e) => set("party")(e.target.value)} aria-invalid={errors.partySize ? true : undefined} />
          <FieldError message={errors.partySize} />
        </Field>
        <Field id={`${uid}-v`} label="Vehicle plate" hint="If they drive in">
          <input id={`${uid}-v`} className={`${inputClass} uppercase`} value={d.plate} maxLength={20} autoComplete="off" onChange={(e) => set("plate")(e.target.value)} placeholder="LND 123 AB" />
        </Field>
      </div>
      <Field id={`${uid}-pu`} label="Purpose of the visit" hint="Optional">
        <input id={`${uid}-pu`} className={inputClass} value={d.purpose} maxLength={255} onChange={(e) => set("purpose")(e.target.value)} placeholder="Meeting with the projects team" />
      </Field>
      <Field id={`${uid}-no`} label="Notes for reception" hint="Optional">
        <textarea id={`${uid}-no`} rows={2} className={textareaClass} value={d.notes} maxLength={2000} onChange={(e) => set("notes")(e.target.value)} placeholder="Bringing equipment; needs parking" />
      </Field>
    </DialogFrame>
  );
}

/** Reception: register a visitor for any host (blank is themselves), or change an expected visit, host included. */
export function VisitorDialog({ sites, on, visitor, onClose, onDone }: { sites: SelectOption[]; on: string; visitor?: Visitor; onClose: () => void; onDone: (v: Visitor) => void }) {
  const uid = useId();
  const { staff } = useOpsPickers();
  const [hostId, setHostId] = useState(visitor?.hostId ?? "");
  // The current host stays choosable even if the staff list doesn't carry them (a leaver, say).
  const hosts: SelectOption[] = staff ?? [];
  const hostOptions = visitor?.hostId && visitor.host && !hosts.some((o) => o.value === visitor.hostId) ? [{ value: visitor.hostId, label: visitor.host }, ...hosts] : hosts;
  return (
    <VisitorFormDialog
      title={visitor ? `Change ${visitor.name}'s visit` : "Register a visitor"}
      subtitle={visitor ? "Only while they are expected. The host is told what changed." : "Reception checks them in with a badge when they arrive; the host is told."}
      submitLabel={visitor ? "Save changes" : "Register the visitor"}
      sites={sites}
      on={on}
      needsTime={false}
      initial={visitor ? draftFromVisitor(visitor) : undefined}
      onClose={onClose}
      hostField={(errors) => (
        <Field id={`${uid}-h`} label="Host" hint={visitor ? undefined : "You, if left blank"}>
          <SearchableSelect id={`${uid}-h`} value={hostId} onChange={setHostId} options={hostOptions} clearable={!visitor} placeholder="Choose" noOptionsText={staff ? "No staff yet" : "Loading…"} aria-invalid={errors.hostId ? true : undefined} />
          <FieldError message={errors.hostId} />
        </Field>
      )}
      onSubmit={async (input) =>
        onDone(visitor ? await facilities.updateVisitor(visitor.id, { ...input, hostId: hostId || null }) : await facilities.registerVisitor({ ...input, hostId: hostId || null }))
      }
    />
  );
}

/** A member of staff registering their own guest, or changing a visit still expected. They are the host. */
export function HostVisitorDialog({ sites, visitor, onClose, onDone }: { sites: SelectOption[]; visitor?: Visitor; onClose: () => void; onDone: (v: Visitor) => void }) {
  return (
    <VisitorFormDialog
      title={visitor ? `Change ${visitor.name}'s visit` : "Register a visitor"}
      subtitle={visitor ? "Reception sees the change straight away. You can change a visit until they arrive." : "Reception will expect them, and you'll be told the moment they check in."}
      submitLabel={visitor ? "Save changes" : "Register my visitor"}
      sites={sites}
      on={todayYmd()}
      needsTime
      initial={visitor ? draftFromVisitor(visitor) : undefined}
      onClose={onClose}
      onSubmit={async (input) =>
        onDone(visitor ? await myVisitors.update(visitor.id, { ...input, expectedAt: input.expectedAt ?? "" }) : await myVisitors.register({ ...input, expectedAt: input.expectedAt ?? "" }))
      }
    />
  );
}
