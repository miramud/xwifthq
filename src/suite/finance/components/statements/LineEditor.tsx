"use client";

import { useId, useMemo, useState } from "react";
import { Ban, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { banking, errorText, type LineReview, type StatementLine } from "@/lib/api/finance-banking-client";
import { amount } from "@/suite/finance/lib/format";
import { CATEGORIES } from "@/suite/finance/components/banking/labels";
import { lookupText, requiredFor, useLookup } from "@/suite/finance/components/banking/lookups";

/**
 * Classify one statement line inline: the account it posts to, the project,
 * cost centre and client or vendor it belongs to (and the person, for an
 * account that needs one), and whether to remember the
 * choice for the next line from the same payee. Save moves on to the next
 * line in the queue; Escape closes without saving.
 */
export default function LineEditor({
  line,
  currency,
  onSaved,
  onClose,
}: {
  line: StatementLine;
  currency: string;
  /** The saved line, and whether to move on to the next. */
  onSaved: (line: StatementLine, next: boolean) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const accounts = useLookup("accounts");
  const projects = useLookup("projects");
  const centres = useLookup("costCentres");
  const parties = useLookup("counterparties");
  const people = useLookup("people");
  const [accountId, setAccountId] = useState(line.account?.id ?? "");
  const [projectId, setProjectId] = useState(line.project?.id ?? "");
  const [costCentreId, setCostCentreId] = useState(line.costCentre?.id ?? "");
  const [counterpartyId, setCounterpartyId] = useState(line.counterparty?.id ?? "");
  const [personId, setPersonId] = useState(line.person?.id ?? line.personId ?? "");
  const [category, setCategory] = useState(line.category ?? "");
  const [clearSplit, setClearSplit] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ignored = line.matchStatus === "ignored";
  const lbl = "mb-1 block text-xs font-semibold text-neutral-600";
  // Dimensions the chosen account insists on (the ledger refuses the journal without them).
  const needs = requiredFor(accountId);
  const needsPerson = needs.includes("person");
  // A person already on the line stays choosable even if they have since left.
  const personOptions = useMemo(() => {
    const id = line.person?.id ?? line.personId;
    if (!id || people.options.some((o) => o.value === id)) return people.options;
    return [{ value: id, label: line.person?.name ?? "Person on this line" }, ...people.options];
  }, [people.options, line.person, line.personId]);
  const mark = (d: string) =>
    needs.includes(d) ? (
      <span className="ml-1 text-error-600">
        <span aria-hidden="true">*</span>
        <span className="sr-only">(required)</span>
      </span>
    ) : null;

  const save = async (body: LineReview, next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await banking.statements.review(line.id, body);
      // The API leaves the project's name off a single saved line; keep the one we know.
      const projectName = projects.options.find((o) => o.value === saved.project?.id)?.label ?? line.project?.name ?? null;
      onSaved({ ...saved, project: saved.project ? { ...saved.project, name: saved.project.name ?? projectName } : null }, next);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const commit = () => {
    if (accountId === "") {
      setError("Choose the account this line posts to, or ignore the line.");
      return;
    }
    const missing = needs.filter(
      (d) => (d === "project" && !projectId) || (d === "cost centre" && !costCentreId) || (d === "counterparty" && !counterpartyId) || (d === "person" && !personId),
    );
    if (missing.length > 0) {
      setError(`This account needs a ${missing.join(" and a ")}. Choose one, or pick another account.`);
      return;
    }
    void save(
      {
        accountId,
        projectId: projectId || null,
        costCentreId: costCentreId || null,
        counterpartyId: counterpartyId || null,
        ...(needsPerson ? { personId } : {}),
        category: category || null,
        ...(clearSplit ? { feeSplit: "clear" as const } : {}),
        remember,
      },
      true,
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    commit();
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          commit();
        }
      }}
      aria-label="Classify this line"
      className="space-y-4 border-t border-neutral-100 bg-neutral-50/70 px-4 py-4 sm:px-5"
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <label htmlFor={`${uid}-account`} className={lbl}>
            Account
          </label>
          <SearchableSelect
            id={`${uid}-account`}
            autoFocus
            value={accountId}
            onChange={setAccountId}
            options={accounts.options}
            placeholder={accounts.status === "loading" ? "Loading accounts…" : "Choose the account"}
            searchPlaceholder="Search by code or name"
            noOptionsText={lookupText(accounts, "accounts")}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-category`} className={lbl}>
            Category
          </label>
          <SearchableSelect
            id={`${uid}-category`}
            value={category}
            onChange={setCategory}
            clearable
            clearLabel="Not set"
            placeholder="Not set"
            options={Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-cp`} className={lbl}>
            Client or vendor
            {mark("counterparty")}
          </label>
          <SearchableSelect id={`${uid}-cp`} value={counterpartyId} onChange={setCounterpartyId} clearable options={parties.options} placeholder={line.counterpartyRaw ? `Not linked (“${line.counterpartyRaw}”)` : "None"} searchPlaceholder="Search clients and vendors" noOptionsText={lookupText(parties, "clients and vendors")} />
        </div>
        <div className="md:col-span-2 xl:col-span-2">
          <label htmlFor={`${uid}-project`} className={lbl}>
            Project
            {mark("project")}
          </label>
          <SearchableSelect id={`${uid}-project`} value={projectId} onChange={setProjectId} clearable options={projects.options} placeholder="None" searchPlaceholder="Search projects" noOptionsText={lookupText(projects, "projects")} />
        </div>
        <div className="md:col-span-2 xl:col-span-2">
          <label htmlFor={`${uid}-cc`} className={lbl}>
            Cost centre
            {mark("cost centre")}
          </label>
          <SearchableSelect id={`${uid}-cc`} value={costCentreId} onChange={setCostCentreId} clearable options={centres.options} placeholder="None" searchPlaceholder="Search cost centres" noOptionsText={lookupText(centres, "cost centres")} />
        </div>
        {needsPerson && (
          <div className="md:col-span-2 xl:col-span-2">
            <label htmlFor={`${uid}-person`} className={lbl}>
              Person
              {mark("person")}
            </label>
            <SearchableSelect id={`${uid}-person`} value={personId} onChange={setPersonId} clearable options={personOptions} placeholder="Choose the person" searchPlaceholder="Search people" noOptionsText={lookupText(people, "people")} />
          </div>
        )}
      </div>

      {line.feeSplit && (
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
          <input type="checkbox" checked={clearSplit} onChange={(e) => setClearSplit(e.target.checked)} className="mt-1 h-4 w-4 accent-primary-600" />
          <span>
            Don&apos;t split the transfer fee
            <span className="block text-xs text-neutral-500">
              Read as {amount(line.feeSplit.principal, currency)} paid + {amount(line.feeSplit.fee, currency)} fee + {amount(line.feeSplit.vat, currency)} VAT. Untick to keep the split.
            </span>
          </span>
        </label>
      )}

      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={!line.counterpartyRaw} className="mt-1 h-4 w-4 accent-primary-600 disabled:opacity-50" />
        <span>
          Remember this for next time
          <span className="block text-xs text-neutral-500">
            {line.counterpartyRaw ? `The next ${line.direction === "DR" ? "payment to" : "receipt from"} “${line.counterpartyRaw}” gets the same account and tags.` : "Only lines with a payee or payer read from the narration can be remembered."}
          </span>
        </span>
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {ignored ? (
            <Button size="sm" variant="ghost" icon={RotateCcw} disabled={busy} onClick={() => void save({ ignore: false }, false)}>
              Stop ignoring
            </Button>
          ) : (
            <Button size="sm" variant="ghost" icon={Ban} disabled={busy} onClick={() => void save({ ignore: true }, true)}>
              Ignore this line
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-neutral-500 lg:inline">Ctrl+Enter saves · Esc closes</span>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" variant="primary" icon={Check} disabled={busy}>
            {busy ? "Saving…" : "Save and next"}
          </Button>
        </div>
      </div>
    </form>
  );
}
