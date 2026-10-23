"use client";

import { useId, useMemo, useState } from "react";
import { BellRing, CalendarCheck2, CalendarRange, Hourglass, PenLine, Plus, X } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { compliance, opsError, opsFieldErrors, type DueRule, type DueRuleType, type Obligation, type ObligationInput } from "@/lib/api/operations-compliance-client";
import { usePickerOptions } from "@/suite/operations/components/assets/parts";
import { DEFAULT_REMINDERS, MONTH_OPTIONS, dueRuleText, sortOffsets } from "./labels";

/**
 * Add an obligation to the register, or change one: what it is, who owns it,
 * how its due date is worked out, when the reminders go, and what kind of
 * thing it is (a certificate, mandatory, in the bid pack, with a fee).
 */

const RULES: { type: DueRuleType; label: string; hint: string; icon: typeof CalendarRange }[] = [
  { type: "day_of_month", label: "Day of the month", hint: "Remittances: PAYE on the 10th", icon: CalendarRange },
  { type: "annual_date", label: "Date each year", hint: "CAC returns on 30 June", icon: CalendarCheck2 },
  { type: "after_fy_end", label: "After the year end", hint: "Tax returns, 6 months on", icon: Hourglass },
  { type: "expiry", label: "On expiry", hint: "Renew when the certificate lapses", icon: BellRing },
  { type: "fixed", label: "Set by hand", hint: "A date you choose", icon: PenLine },
];

const SUGGESTED_OFFSETS = [90, 60, 30, 14, 7, 3, 1];

export function ObligationDialog({
  obligation,
  categories,
  frequencies,
  owners,
  onClose,
  onDone,
}: {
  obligation?: Obligation;
  categories: Record<string, string>;
  frequencies: Record<string, string>;
  owners: string[];
  onClose: () => void;
  onDone: (o: Obligation) => void;
}) {
  const uid = useId();
  const o = obligation;
  const rule = o?.dueRule ?? null;
  const { staff } = usePickerOptions();
  const [name, setName] = useState(o?.name ?? "");
  const [authority, setAuthority] = useState(o?.authority ?? "");
  const [category, setCategory] = useState(o?.category ?? "");
  const [frequency, setFrequency] = useState(o?.frequency ?? "annual");
  const [ownerRole, setOwnerRole] = useState(o?.ownerRole ?? "");
  const [ownerId, setOwnerId] = useState(o?.ownerId ?? "");
  const [ruleType, setRuleType] = useState<DueRuleType>(rule?.type ?? "annual_date");
  const [dayN, setDayN] = useState(String(rule?.day ?? (rule?.type === "day_of_month" ? 10 : 31)));
  const [monthN, setMonthN] = useState(String(rule?.month ?? 12));
  const [months, setMonths] = useState(String(rule?.months ?? 6));
  const [following, setFollowing] = useState(Boolean(rule?.offsetMonths));
  const [firstDueOn, setFirstDueOn] = useState("");
  const [reminders, setReminders] = useState<number[]>(sortOffsets(o?.reminderDays?.length ? o.reminderDays : DEFAULT_REMINDERS));
  const [custom, setCustom] = useState("");
  const [evidence, setEvidence] = useState(o?.evidenceRequired ?? "");
  const [isCertificate, setIsCertificate] = useState(o?.isCertificate ?? false);
  const [mandatory, setMandatory] = useState(o?.mandatory ?? true);
  const [bidPack, setBidPack] = useState(o?.bidPack ?? false);
  const [needsPayment, setNeedsPayment] = useState(o?.needsPayment ?? false);
  const [fee, setFee] = useState(amountInput(o?.typicalFee));
  const [active, setActive] = useState(o?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ownerOptions = useMemo(() => {
    const set = new Set([...owners, ...(ownerRole ? [ownerRole] : [])]);
    return [...set].map((r) => ({ value: r, label: r }));
  }, [owners, ownerRole]);

  const onChange = frequency === "on_change";

  const buildRule = (): DueRule | null => {
    if (onChange) return null;
    switch (ruleType) {
      case "day_of_month":
        return { type: "day_of_month", day: Number(dayN), ...(following ? { offsetMonths: 1 } : {}) };
      case "annual_date":
        return { type: "annual_date", month: Number(monthN), day: Number(dayN) };
      case "after_fy_end":
        return { type: "after_fy_end", months: Number(months) };
      default:
        return { type: ruleType };
    }
  };

  const addCustom = () => {
    const n = Math.round(Number(custom));
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      setErrors((e) => ({ ...e, reminderDays: "A reminder goes 1 to 365 days before." }));
      return;
    }
    setReminders((r) => sortOffsets([...r, n]));
    setCustom("");
    setErrors((e) => {
      const rest = { ...e };
      delete rest.reminderDays;
      return rest;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name the obligation.";
    if (!category) next.category = "Choose a category.";
    if (!frequency) next.frequency = "Choose how often it falls due.";
    if (!onChange && (ruleType === "day_of_month" || ruleType === "annual_date")) {
      const d = Number(dayN);
      if (!Number.isInteger(d) || d < 1 || d > (ruleType === "day_of_month" ? 28 : 31)) next.dueRule = ruleType === "day_of_month" ? "Choose a day from 1 to 28." : "Choose a day from 1 to 31.";
    }
    if (!onChange && ruleType === "after_fy_end") {
      const m = Number(months);
      if (!Number.isInteger(m) || m < 1 || m > 24) next.dueRule = "Choose 1 to 24 months.";
    }
    if (!o && !onChange && ruleType === "fixed" && !firstDueOn) next.firstDueOn = "Choose the first due date.";
    const typicalFee = needsPayment && fee.trim() ? parseAmount(fee) : null;
    if (needsPayment && fee.trim() && typicalFee === null) next.typicalFee = "Enter the fee in naira, like 25,000.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const input: ObligationInput = {
      name: name.trim(),
      authority: authority.trim() || null,
      category,
      frequency,
      ownerRole: ownerRole || null,
      ownerId: ownerId || null,
      dueRule: buildRule(),
      reminderDays: reminders,
      evidenceRequired: evidence.trim() || null,
      isCertificate,
      mandatory,
      bidPack,
      needsPayment,
      typicalFee: needsPayment ? typicalFee : null,
      ...(o ? { active } : { firstDueOn: firstDueOn || null }),
    };
    setBusy(true);
    setError(null);
    try {
      onDone(o ? await compliance.update(o.id, input) : await compliance.create(input));
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  const preview = onChange ? "Whenever something changes" : dueRuleText(buildRule(), frequency);

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      size="lg"
      titleId={`${uid}-title`}
      title={o ? "Edit this obligation" : "Add an obligation"}
      subtitle={o ? "Changes apply from the next occurrence; what is open keeps its due date." : "Its first occurrence goes on the calendar straight away."}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : o ? "Save changes" : "Add to the register"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-name`} label="What has to be done" className="sm:col-span-2">
          <input
            id={`${uid}-name`}
            className={inputClass}
            value={name}
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            placeholder="NITDA registration as an IT service provider"
            aria-invalid={errors.name ? true : undefined}
          />
          <FieldError message={errors.name} />
        </Field>
        <Field id={`${uid}-auth`} label="Authority" hint="Optional">
          <input id={`${uid}-auth`} className={inputClass} value={authority} maxLength={160} onChange={(e) => setAuthority(e.target.value)} placeholder="NITDA" />
        </Field>
        <Field id={`${uid}-cat`} label="Category">
          <SearchableSelect
            id={`${uid}-cat`}
            value={category}
            onChange={setCategory}
            options={Object.entries(categories).map(([value, label]) => ({ value, label }))}
            placeholder="Choose a category"
            searchPlaceholder="Search categories"
            aria-invalid={errors.category ? true : undefined}
          />
          <FieldError message={errors.category} />
        </Field>
        <Field id={`${uid}-role`} label="Owner role" hint="Filters the calendar">
          <SearchableSelect
            id={`${uid}-role`}
            value={ownerRole}
            onChange={setOwnerRole}
            options={ownerOptions}
            clearable
            clearLabel="No owner role"
            placeholder="Finance, Company secretary…"
            searchPlaceholder="Search or type a new role"
            onCreate={(text) => {
              const v = text.trim();
              if (v) setOwnerRole(v);
              return v ? { value: v, label: v } : undefined;
            }}
            createLabel={(t) => `Use “${t}”`}
          />
        </Field>
        <Field id={`${uid}-person`} label="Person responsible" hint="Optional">
          <SearchableSelect
            id={`${uid}-person`}
            value={ownerId}
            onChange={setOwnerId}
            options={staff ?? []}
            clearable
            clearLabel="Nobody in particular"
            placeholder={staff === null ? "Loading staff…" : "Choose a member of staff"}
            searchPlaceholder="Search staff"
            noOptionsText={staff === null ? "Loading staff…" : "No staff found."}
          />
          <FieldError message={errors.ownerId} />
        </Field>
        <Field id={`${uid}-freq`} label="How often" className="sm:col-span-2">
          <SearchableSelect
            id={`${uid}-freq`}
            value={frequency}
            onChange={setFrequency}
            options={Object.entries(frequencies).map(([value, label]) => ({ value, label }))}
            placeholder="Choose how often"
            searchPlaceholder="Search"
            aria-invalid={errors.frequency ? true : undefined}
          />
          <FieldError message={errors.frequency} />
        </Field>
      </div>

      {!onChange && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-neutral-700">When it falls due</legend>
          <div role="radiogroup" aria-label="How the due date is worked out" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RULES.map((r) => {
              const on = ruleType === r.type;
              const Icon = r.icon;
              return (
                <button
                  key={r.type}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setRuleType(r.type);
                    if (r.type === "day_of_month" && Number(dayN) > 28) setDayN("10");
                  }}
                  className={cx(
                    "flex min-h-[5.5rem] cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                    on ? "border-primary-500 bg-primary-50/70 ring-1 ring-primary-500" : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50",
                  )}
                >
                  <Icon size={16} className={on ? "text-primary-700" : "text-neutral-500"} aria-hidden />
                  <span className={cx("text-[13px] font-semibold", on ? "text-primary-800" : "text-neutral-800")}>{r.label}</span>
                  <span className="text-[11px] leading-snug text-neutral-500">{r.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl bg-neutral-50 p-4">
            {ruleType === "day_of_month" && (
              <div className="flex flex-wrap items-end gap-3">
                <Field id={`${uid}-dom`} label="Day">
                  <input id={`${uid}-dom`} type="number" min={1} max={28} className={cx(inputClass, "w-24")} value={dayN} onChange={(e) => setDayN(e.target.value)} />
                </Field>
                <label className="flex h-11 cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={following} onChange={(e) => setFollowing(e.target.checked)} />
                  Of the month after the period it covers
                </label>
              </div>
            )}
            {ruleType === "annual_date" && (
              <div className="flex flex-wrap items-end gap-3">
                <Field id={`${uid}-ad`} label="Day">
                  <input id={`${uid}-ad`} type="number" min={1} max={31} className={cx(inputClass, "w-24")} value={dayN} onChange={(e) => setDayN(e.target.value)} />
                </Field>
                <Field id={`${uid}-am`} label="Month" className="min-w-[12rem] flex-1">
                  <SearchableSelect id={`${uid}-am`} value={monthN} onChange={setMonthN} options={MONTH_OPTIONS} searchPlaceholder="Search months" />
                </Field>
              </div>
            )}
            {ruleType === "after_fy_end" && (
              <Field id={`${uid}-fy`} label="Months after the financial year ends">
                <input id={`${uid}-fy`} type="number" min={1} max={24} className={cx(inputClass, "w-28")} value={months} onChange={(e) => setMonths(e.target.value)} />
              </Field>
            )}
            {ruleType === "expiry" && <p className="text-sm text-neutral-600">Each renewal falls due on the day the certificate on file expires. Its expiry date is recorded when the renewal is completed.</p>}
            {ruleType === "fixed" && <p className="text-sm text-neutral-600">The first due date below; each one after it follows the frequency.</p>}
            {!o && (ruleType === "fixed" || ruleType === "expiry") && (
              <Field id={`${uid}-first`} label="First due on" hint={ruleType === "fixed" ? "Required" : "Optional: defaults to 30 days from today"} className="mt-3">
                <input id={`${uid}-first`} type="date" className={cx(inputClass, "w-48")} value={firstDueOn} onChange={(e) => setFirstDueOn(e.target.value)} aria-invalid={errors.firstDueOn ? true : undefined} />
                <FieldError message={errors.firstDueOn} />
              </Field>
            )}
            <p className="mt-3 text-xs text-neutral-500">
              Due: <span className="font-semibold text-neutral-800">{preview}</span>
            </p>
            <FieldError message={errors.dueRule ?? errors["dueRule.type"] ?? errors["dueRule.day"]} />
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">Reminders before it is due</legend>
        <ul className="flex flex-wrap gap-1.5" aria-label="Reminder days">
          {sortOffsets([...SUGGESTED_OFFSETS, ...reminders]).map((d) => {
            const on = reminders.includes(d);
            return (
              <li key={d}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReminders((r) => (on ? r.filter((x) => x !== d) : sortOffsets([...r, d])))}
                  className={cx(
                    "inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-[13px] font-semibold tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                    on ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70",
                  )}
                >
                  {d} {d === 1 ? "day" : "days"}
                  {on && <X size={12} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor={`${uid}-custom`} className="sr-only">
            Another reminder, in days before
          </label>
          <input
            id={`${uid}-custom`}
            type="number"
            min={1}
            max={365}
            className={cx(inputClass, "h-9 w-32")}
            value={custom}
            placeholder="Days before"
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <Button size="sm" icon={Plus} onClick={addCustom} disabled={!custom}>
            Add
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          {reminders.length === 0 ? "No reminders: only the overdue notice goes out." : `The owner hears ${reminders.join(", ")} days before, and again if it goes overdue.`}
        </p>
        <FieldError message={errors.reminderDays} />
      </fieldset>

      <Field id={`${uid}-ev`} label="Evidence that proves it was done" hint="Shown on every occurrence">
        <textarea
          id={`${uid}-ev`}
          className={textareaClass}
          rows={2}
          maxLength={2000}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="The receipt (Remita RRR or bank evidence) and the return filed."
        />
      </Field>

      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
        <Toggle label="It is a certificate" hint="Has an issue and an expiry date, shown on the validity timeline" checked={isCertificate} onChange={setIsCertificate} />
        <Toggle label="Mandatory" hint="An expired one is flagged in red everywhere" checked={mandatory} onChange={setMandatory} />
        <Toggle label="Goes in the bid pack" hint="Included in the bid-readiness pack while valid" checked={bidPack} onChange={setBidPack} />
        <Toggle label="Needs a payment" hint="Offers a draft payment memo for the fee" checked={needsPayment} onChange={setNeedsPayment} />
        {needsPayment && (
          <div className="px-4 py-3">
            <Field id={`${uid}-fee`} label="Typical fee (₦)" hint="Optional; fills the memo">
              <input id={`${uid}-fee`} inputMode="decimal" className={cx(inputClass, "w-48")} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="25,000" aria-invalid={errors.typicalFee ? true : undefined} />
              <FieldError message={errors.typicalFee} />
            </Field>
          </div>
        )}
        {o && <Toggle label="Active" hint="A paused obligation raises no new occurrences and sends no reminders" checked={active} onChange={setActive} />}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        <p className="text-xs text-neutral-500">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
