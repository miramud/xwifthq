"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount as money } from "@/suite/finance/lib/format";
import {
  events,
  opsError,
  opsFieldErrors,
  type DashboardLine,
  type EventFull,
  type GenerateResult,
  type GenerateWhat,
  type OpsOptions,
  type TravelMode,
} from "@/lib/api/operations-travel-client";
import { MODE, dateSpan, gradeOnRecord } from "../travel/labels";
import { MoneyInput, optionsFrom } from "../travel/shared";

/**
 * From one approved budget line, in one step: a draft purchase request for
 * a vendor, a draft trip for staff, or an advance to the lead for small
 * on-site costs. Each takes its money from the line.
 */

const DEFAULT_FOR: Record<string, GenerateWhat> = { vendor: "purchase_request", travel: "travel", advance: "advance" };

/** "Elsewhere in Nigeria" is usually reached by road; everywhere else by air. */
const modeFor = (destinationClass: string): TravelMode => (destinationClass === "local_tier3" ? "road" : "air");

let rowKey = 0;

export default function GenerateDialog({
  event,
  line,
  options,
  onDone,
  onClose,
}: {
  event: EventFull;
  line: DashboardLine;
  options: OpsOptions | null;
  onDone: (result: GenerateResult) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [what, setWhat] = useState<GenerateWhat>(DEFAULT_FOR[line.channel] ?? "purchase_request");
  const [advance, setAdvance] = useState<number | null>(line.available > 0 ? line.available : null);
  const [travellers, setTravellers] = useState<{ key: number; userId: string; grade: string }[]>([{ key: ++rowKey, userId: "", grade: "officer" }]);
  const [destinationClass, setDestinationClass] = useState("");
  const [destination, setDestination] = useState(event.location ?? "");
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState<TravelMode>("air");
  const [modeChosen, setModeChosen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const staff = (options?.staff ?? []).map((s) => ({ value: s.id, label: s.name }));
  const grades = optionsFrom(options?.travelGrades);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (what === "advance") {
      if (!advance || advance <= 0) found.amount = "Enter the advance.";
    }
    if (what === "travel") {
      if (!destinationClass) found.destinationClass = "Choose the destination class.";
      if (!destination.trim()) found.destination = "Say where they are going.";
      travellers.forEach((t, i) => {
        if (!t.userId) found[`travellers.${i}.userId`] = "Choose a member of staff.";
      });
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await events.me.generate(
        event.id,
        line.id,
        what === "advance"
          ? { what, amount: advance ?? 0 }
          : what === "travel"
            ? {
                what,
                travellers: travellers.map((t) => ({ userId: t.userId, grade: t.grade })),
                destinationClass,
                destination: destination.trim(),
                origin: origin.trim() || null,
                mode,
              }
            : { what },
      );
      onDone(result);
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-title`}
      title={`Line ${line.lineNo}: ${line.description}`}
      subtitle={
        <span>
          <Money value={line.available} className="font-semibold text-neutral-700" /> left of <Money value={line.budget} />
        </span>
      }
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Raising…" : what === "purchase_request" ? "Raise the purchase request" : what === "travel" ? "Raise the travel request" : "Request the advance"}
          </Button>
        </div>
      }
    >
      <Segmented
        label="What to raise"
        value={what}
        onChange={setWhat}
        options={[
          { key: "purchase_request", label: "Purchase request" },
          { key: "travel", label: "Travel" },
          { key: "advance", label: "Advance" },
        ]}
      />

      {what === "purchase_request" && (
        <p className="text-sm text-neutral-600">
          A draft purchase request for &ldquo;{line.description}&rdquo; at <Money value={line.budget} className="font-semibold text-neutral-900" />, needed by the first day of the event. You finish and send it from its page; procurement then sources the vendor.
        </p>
      )}

      {what === "advance" && (
        <>
          <p className="text-sm text-neutral-600">
            An advance to {event.lead ?? "the event lead"} for small on-site costs, sent straight to the FCU and retired with receipts. Meals and tea paid to individuals go this way only.
          </p>
          <Field id={`${uid}-amount`} label="Advance (₦)">
            <MoneyInput id={`${uid}-amount`} value={advance} onChange={setAdvance} invalid={Boolean(errors.amount)} describedBy={`${uid}-amount-hint`} />
            <p id={`${uid}-amount-hint`} className="mt-1.5 text-xs text-neutral-500">
              Up to {money(line.available)}, what is left on the line.
            </p>
            <FieldError message={errors.amount} />
          </Field>
        </>
      )}

      {what === "travel" && (
        <>
          <p className="text-sm text-neutral-600">
            A draft trip for {dateSpan(event.startsOn, event.endsOn)}: out the day before, back the day after, costed from the travel policy and paid from this line. Check it and send it from the trip&apos;s page.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${uid}-class`} label="Destination class">
              <SearchableSelect
                id={`${uid}-class`}
                value={destinationClass}
                onChange={(v) => {
                  setDestinationClass(v);
                  if (!modeChosen) setMode(modeFor(v));
                }}
                options={optionsFrom(options?.destinationClasses)}
                placeholder="Choose the class"
                searchPlaceholder="Search destination classes"
                aria-invalid={errors.destinationClass ? true : undefined}
              />
              <FieldError message={errors.destinationClass} />
            </Field>
            <Field id={`${uid}-dest`} label="Destination">
              <input id={`${uid}-dest`} className={inputClass} value={destination} onChange={(e) => setDestination(e.target.value)} aria-invalid={errors.destination ? true : undefined} />
              <FieldError message={errors.destination} />
            </Field>
            <Field id={`${uid}-origin`} label="Travelling from" hint="Optional">
              <input
                id={`${uid}-origin`}
                className={inputClass}
                value={origin}
                maxLength={120}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="The organisation's city, if left blank"
                aria-invalid={errors.origin ? true : undefined}
              />
              <FieldError message={errors.origin} />
            </Field>
            <div>
              <p aria-hidden className="mb-1.5 text-sm font-medium text-neutral-700">
                Going by
              </p>
              <Segmented
                label="Going by"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setModeChosen(true);
                }}
                options={(["air", "road", "rail"] as const).map((k) => ({ key: k, label: MODE[k].label }))}
              />
              <FieldError message={errors.mode} />
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-neutral-700">Who is travelling</legend>
            <ul className="space-y-2">
              {travellers.map((t, i) => (
                <li key={t.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
                  <div>
                    <SearchableSelect
                      value={t.userId}
                      onChange={(v) => setTravellers(travellers.map((x) => (x.key === t.key ? { ...x, userId: v, grade: gradeOnRecord(options, v) } : x)))}
                      options={staff}
                      placeholder="Choose a member of staff"
                      searchPlaceholder="Search staff"
                      aria-label={`Traveller ${i + 1}`}
                      aria-invalid={errors[`travellers.${i}.userId`] ? true : undefined}
                    />
                    <FieldError message={errors[`travellers.${i}.userId`]} />
                  </div>
                  <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    <SearchableSelect
                      value={t.grade}
                      onChange={(v) => setTravellers(travellers.map((x) => (x.key === t.key ? { ...x, grade: v } : x)))}
                      options={grades}
                      searchPlaceholder="Search grades"
                      aria-label={`Grade of traveller ${i + 1}`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={travellers.length === 1}
                    onClick={() => setTravellers(travellers.filter((x) => x.key !== t.key))}
                    aria-label={`Remove traveller ${i + 1}`}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => setTravellers([...travellers, { key: ++rowKey, userId: "", grade: "officer" }])}>
              Add a traveller
            </Button>
          </fieldset>
        </>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
