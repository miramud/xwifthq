"use client";

import { useId, useMemo, useState } from "react";
import { CheckCircle2, CircleSlash, FlaskConical, Trash2 } from "lucide-react";
import { Button, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, fieldErrors } from "@/suite/org/components/foundations/shared";
import { banking, errorText, type BankRule, type BankRuleInput, type RuleAction } from "@/lib/api/finance-banking-client";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { CATEGORIES, RULE_ACTIONS, humanise } from "@/suite/finance/components/banking/labels";
import { lookupText, useLookup } from "@/suite/finance/components/banking/lookups";
import { testRule } from "./ruleTester";

/**
 * Create or change a statement rule, with a tester beside the pattern: type
 * a narration as it appears on a statement and see whether the rule catches
 * it, and what it reads as the payee (`cp`) and the purpose.
 */

type Dir = "any" | "DR" | "CR";

export default function RuleDialog({
  rule,
  nextPriority,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
}: {
  rule: BankRule | null;
  nextPriority: number;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (rule: BankRule) => void;
  onDeleted: (id: string) => void;
}) {
  const uid = useId();
  const confirm = useConfirm();
  const accounts = useLookup("accounts");
  const projects = useLookup("projects");
  const centres = useLookup("costCentres");
  const [name, setName] = useState(rule?.name ?? "");
  const [priority, setPriority] = useState(String(rule?.priority ?? nextPriority));
  const [direction, setDirection] = useState<Dir>(rule?.direction ?? "any");
  const [pattern, setPattern] = useState(rule?.pattern ?? "");
  const [min, setMin] = useState(amountInput(rule?.amountMin));
  const [max, setMax] = useState(amountInput(rule?.amountMax));
  const [action, setAction] = useState<RuleAction>(rule?.action ?? "classify");
  const [category, setCategory] = useState(rule?.category ?? "");
  const [accountId, setAccountId] = useState(rule?.accountId ?? "");
  const [costCentreId, setCostCentreId] = useState(rule?.costCentreId ?? "");
  const [projectId, setProjectId] = useState(rule?.projectId ?? "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [sample, setSample] = useState("");
  const [sampleDir, setSampleDir] = useState<"DR" | "CR">(rule?.direction ?? "DR");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lbl = "mb-1.5 block text-sm font-medium text-neutral-700";

  const test = useMemo(
    () => testRule(pattern, sample, { direction: direction === "any" ? null : direction, lineDirection: sampleDir }),
    [pattern, sample, direction, sampleDir],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim() === "") found.name = "Name the rule so people know what it catches.";
    if (pattern.trim() === "") found.pattern = "Type the pattern to look for in the narration.";
    const p = Number(priority);
    if (!Number.isInteger(p) || p < 1 || p > 10000) found.priority = "A whole number from 1 to 10,000. Lower runs first.";
    const lo = min.trim() === "" ? null : parseAmount(min);
    const hi = max.trim() === "" ? null : parseAmount(max);
    if (min.trim() !== "" && lo === null) found.amountMin = "Type an amount like 1,000.00.";
    if (max.trim() !== "" && hi === null) found.amountMax = "Type an amount like 1,000.00.";
    if (lo !== null && hi !== null && lo > hi) found.amountMax = "The most has to be at least the least.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    const body: BankRuleInput = {
      name: name.trim(),
      priority: p,
      direction: direction === "any" ? null : direction,
      pattern: pattern.trim(),
      amountMin: lo,
      amountMax: hi,
      action,
      category: category || null,
      accountId: accountId || null,
      costCentreId: costCentreId || null,
      projectId: projectId || null,
      active,
    };
    setBusy(true);
    try {
      const saved = rule ? await banking.rules.update(rule.id, body) : await banking.rules.create(body);
      onSaved(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!rule) return;
    const ok = await confirm({ title: `Delete “${rule.name}”?`, body: "Lines already classified keep their accounts. New statements won't use this rule.", confirmLabel: "Delete rule" });
    if (!ok) return;
    try {
      await banking.rules.remove(rule.id);
      onDeleted(rule.id);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={rule ? "Edit rule" : "New rule"}
      subtitle="Rules run in priority order on each new statement line; the first that matches wins."
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {rule && canDelete && (
              <Button variant="ghost" icon={Trash2} onClick={() => void remove()} className="text-error-700">
                Delete rule
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : rule ? "Save rule" : "Add rule"}
            </Button>
          </div>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <label htmlFor={`${uid}-name`} className={lbl}>
            Name
          </label>
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Electricity bills" aria-invalid={errors.name ? true : undefined} className={inputClass} />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label htmlFor={`${uid}-priority`} className={lbl}>
            Priority
          </label>
          <input id={`${uid}-priority`} type="number" min={1} max={10000} value={priority} onChange={(e) => setPriority(e.target.value)} aria-invalid={errors.priority ? true : undefined} className={cx(inputClass, "tabular-nums")} />
          <FieldError message={errors.priority} />
        </div>
      </div>

      <div>
        <span className={lbl} aria-hidden>
          Looks at
        </span>
        <div>
          <Segmented
            label="Looks at"
            value={direction}
            onChange={setDirection}
            options={[
              { key: "any", label: "Money in or out" },
              { key: "DR", label: "Money out" },
              { key: "CR", label: "Money in" },
            ]}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${uid}-pattern`} className={lbl}>
          Pattern
        </label>
        <textarea
          id={`${uid}-pattern`}
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          rows={2}
          spellCheck={false}
          maxLength={255}
          placeholder="^CIB/UTO/(?<purpose>[^/]+)/(?<cp>.+)"
          aria-invalid={errors.pattern ? true : undefined}
          aria-describedby={`${uid}-pattern-hint`}
          className={cx(textareaClass, "font-mono text-[13px]")}
        />
        <FieldError message={errors.pattern} />
        <p id={`${uid}-pattern-hint`} className="mt-1.5 text-xs text-neutral-500">
          A regular expression, matched against the narration in capitals. Name a group <code className="rounded bg-neutral-100 px-1">(?&lt;cp&gt;…)</code> to read the payee, <code className="rounded bg-neutral-100 px-1">(?&lt;purpose&gt;…)</code> to read the purpose.
        </p>
      </div>

      <section aria-labelledby={`${uid}-tester`} className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 p-4">
        <h3 id={`${uid}-tester`} className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <FlaskConical size={16} className="text-primary-600" aria-hidden />
          Try it on a narration
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`${uid}-sample`} className="sr-only">
            Narration to test
          </label>
          <input id={`${uid}-sample`} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="CIB/UTO/DIESEL SUPPLY/ADEX VENTURES LTD" className={cx(inputClass, "font-mono text-[13px]")} />
          <Segmented
            label="Test line direction"
            value={sampleDir}
            onChange={setSampleDir}
            options={[
              { key: "DR", label: "Out" },
              { key: "CR", label: "In" },
            ]}
          />
        </div>
        <div className="mt-3 min-h-[2.5rem] text-sm" aria-live="polite">
          {test.status === "empty" ? (
            <p className="text-neutral-500">Paste a narration from a statement to see what this rule does with it.</p>
          ) : test.status === "unsupported" ? (
            <p className="text-sun-700">{test.message}</p>
          ) : test.status === "no_match" ? (
            <p className="flex items-start gap-2 text-neutral-700">
              <CircleSlash size={16} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
              <span>
                <span className="font-semibold">No match.</span> {test.reason ?? "The pattern doesn't occur in this narration."}
              </span>
            </p>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-semibold text-mint-700">
                <CheckCircle2 size={16} aria-hidden />
                Matches: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-medium text-neutral-800">{test.matched}</code>
              </p>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Payee (cp)</dt>
                  <dd className="font-mono text-[13px] text-neutral-900">{test.cp ?? <span className="text-neutral-400">not captured</span>}</dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Purpose</dt>
                  <dd className="font-mono text-[13px] text-neutral-900">{test.purpose ?? <span className="text-neutral-400">not captured</span>}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-min`} className={lbl}>
            Smallest amount <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input id={`${uid}-min`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} aria-invalid={errors.amountMin ? true : undefined} className={cx(inputClass, "tabular-nums")} />
          <FieldError message={errors.amountMin} />
        </div>
        <div>
          <label htmlFor={`${uid}-max`} className={lbl}>
            Largest amount <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input id={`${uid}-max`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={errors.amountMax ? true : undefined} className={cx(inputClass, "tabular-nums")} />
          <FieldError message={errors.amountMax} />
        </div>
        <div>
          <label htmlFor={`${uid}-action`} className={lbl}>
            Then
          </label>
          <SearchableSelect
            id={`${uid}-action`}
            value={action}
            onChange={(v) => setAction(v as RuleAction)}
            options={(Object.keys(RULE_ACTIONS) as RuleAction[]).map((k) => ({ value: k, label: RULE_ACTIONS[k].label, hint: RULE_ACTIONS[k].hint }))}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-cat`} className={lbl}>
            Category
          </label>
          <SearchableSelect id={`${uid}-cat`} value={category} onChange={setCategory} clearable clearLabel="Leave as it is" placeholder="Leave as it is" options={Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: v.label }))} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-account`} className={lbl}>
            Account
          </label>
          <SearchableSelect
            id={`${uid}-account`}
            value={accountId}
            onChange={setAccountId}
            clearable
            clearLabel={rule?.systemKey ? `The system account (${humanise(rule.systemKey)})` : "Leave for review"}
            placeholder={rule?.systemKey ? `The system account (${humanise(rule.systemKey)})` : "Leave for review"}
            options={accounts.options}
            searchPlaceholder="Search by code or name"
            noOptionsText={lookupText(accounts, "accounts")}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-project`} className={lbl}>
            Project
          </label>
          <SearchableSelect id={`${uid}-project`} value={projectId} onChange={setProjectId} clearable placeholder="None" options={projects.options} noOptionsText={lookupText(projects, "projects")} />
        </div>
        <div>
          <label htmlFor={`${uid}-cc`} className={lbl}>
            Cost centre
          </label>
          <SearchableSelect id={`${uid}-cc`} value={costCentreId} onChange={setCostCentreId} clearable placeholder="None" options={centres.options} noOptionsText={lookupText(centres, "cost centres")} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Use this rule</p>
          <p className="text-xs text-neutral-500">Switched off, it is kept but skipped.</p>
        </div>
        <Switch checked={active} onChange={setActive} label="Use this rule" />
      </div>
    </DialogFrame>
  );
}
