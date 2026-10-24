"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  hrm,
  type CaseKind,
  type CaseOutcome,
  type Employee,
  type RelationsCase,
} from "@/lib/api/hrm-client";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { formatDate } from "@/suite/hrm/lib/format";
import {
  Dialog,
  ErrorNote,
  Field,
  FormActions,
  INPUT,
  useSubmit,
} from "./Dialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

/**
 * Running a case, as opposed to reading one.
 *
 * Every step of the disciplinary and grievance process had an endpoint, a
 * policy and tests, and no way in: the board listed cases and charted them and
 * offered not one action. An institution could see that somebody had a
 * disciplinary open and could not put the allegation to them, investigate it,
 * hold a hearing or decide it.
 *
 * The shape here follows the process rather than the API. Each stage offers
 * only what comes next, because a screen that offers "decide" beside "serve
 * the allegation" invites somebody to skip the step that makes the decision
 * defensible, and the service would refuse anyway, after they had typed it.
 *
 * Two things it is careful with.
 *
 * **It never pre-fills a decision.** The outcome dropdown starts empty even
 * where the ladder has an obvious next rung. Suggesting one on a form is how
 * "what does the policy say" turns into "what did the software already pick".
 *
 * **It says what each choice does to the record.** A verbal warning that
 * counts for six months and a final written warning that counts for two years
 * are different acts, and the lifespan is on the form rather than in a policy
 * document nobody has open.
 */

/* Mirrors CaseOutcome in the API. The TS union already does; these carry the
   applicability and default lifespan that go with each value. */
const OUTCOMES: {
  value: CaseOutcome;
  label: string;
  kinds: CaseKind[];
  lifespanMonths: number | null;
  note?: string;
}[] = [
  {
    value: "no_case",
    label: "No case to answer",
    kinds: ["disciplinary", "grievance"],
    lifespanMonths: null,
    note: "Nothing goes on their record and there is nothing to appeal.",
  },
  {
    value: "informal_advice",
    label: "Informal advice",
    kinds: ["disciplinary", "grievance"],
    lifespanMonths: null,
    note: "A conversation. It does not count towards any future escalation.",
  },
  {
    value: "verbal_warning",
    label: "Verbal warning",
    kinds: ["disciplinary"],
    lifespanMonths: 6,
  },
  {
    value: "written_warning",
    label: "Written warning",
    kinds: ["disciplinary"],
    lifespanMonths: 12,
  },
  {
    value: "final_written_warning",
    label: "Final written warning",
    kinds: ["disciplinary"],
    lifespanMonths: 24,
  },
  {
    value: "dismissal",
    label: "Dismissal",
    kinds: ["disciplinary"],
    lifespanMonths: null,
    note: "This does not end the employment on its own. Record the departure on the Leavers board.",
  },
  { value: "upheld", label: "Upheld", kinds: ["grievance"], lifespanMonths: null },
  {
    value: "partly_upheld",
    label: "Partly upheld",
    kinds: ["grievance"],
    lifespanMonths: null,
  },
  {
    value: "not_upheld",
    label: "Not upheld",
    kinds: ["grievance"],
    lifespanMonths: null,
  },
];

type Action =
  | "allegation"
  | "investigate"
  | "findings"
  | "hearing"
  | "decide"
  | "appeal"
  | "withdraw";

export default function CaseWorkflow({
  caseId,
  onChanged,
}: {
  caseId: string;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<RelationsCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    hrm.relations
      .get(caseId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, reloadKey]);

  const done = () => {
    setAction(null);
    setReloadKey((k) => k + 1);
    onChanged();
  };

  if (error !== null) {
    return (
      <div className="flex items-center gap-2 bg-neutral-50 px-5 py-4 text-sm text-neutral-600">
        <AlertTriangle size={15} className="shrink-0 text-warning-600" />
        {error}
      </div>
    );
  }

  if (detail === null) {
    return <div className="h-32 animate-pulse bg-neutral-50" />;
  }

  return (
    <div className="space-y-3 bg-neutral-50 px-5 py-4">
      {detail.detail !== null && detail.detail !== undefined && (
        <RichTextView value={detail.detail} size="sm" className="text-neutral-700" />
      )}

      <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <Fact label="Status" value={detail.statusLabel} />
        <Fact label="Opened" value={formatDate(detail.openedOn)} />
        {detail.investigator != null && (
          <Fact label="Investigator" value={detail.investigator} />
        )}
        {detail.hearingAt != null && (
          <Fact label="Hearing" value={formatDate(detail.hearingAt)} />
        )}
        {detail.heardBy != null && <Fact label="Heard by" value={detail.heardBy} />}
        {detail.companionOffered != null && (
          <Fact
            label="Companion"
            /* A statutory right in most policies, so its absence is a finding
               rather than a blank. */
            value={detail.companionOffered ? "Offered" : "Not offered"}
          />
        )}
        {detail.outcomeLabel != null && (
          <Fact label="Outcome" value={detail.outcomeLabel} />
        )}
        {detail.warningExpiresOn != null && (
          <Fact
            label="Stops counting"
            value={formatDate(detail.warningExpiresOn)}
          />
        )}
      </dl>

      {detail.investigationFindings != null && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-[11px] font-medium text-neutral-500">Findings</p>
          <RichTextView value={detail.investigationFindings} size="sm" className="mt-1 text-neutral-700" />
        </div>
      )}

      {detail.appealGrounds != null && (
        <div className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
          <p className="text-[11px] font-medium text-neutral-600">
            They have appealed
          </p>
          <RichTextView value={detail.appealGrounds} size="sm" className="mt-1 text-neutral-700" />
          {detail.appealOutcome != null && (
            <p className="mt-2 text-xs text-neutral-600">
              Appeal {detail.appealOutcome}
              {detail.appealReason != null && `: ${richExcerpt(detail.appealReason, 200)}`}
            </p>
          )}
        </div>
      )}

      <Steps status={detail.status} onPick={setAction} />

      {detail.events !== undefined && detail.events.length > 0 && (
        <ol className="space-y-1.5 border-t border-neutral-200 pt-3">
          {detail.events.map((event) => (
            <li key={event.id} className="flex gap-2 text-[11px]">
              <span className="shrink-0 text-neutral-400">
                {formatDate(event.occurredAt)}
              </span>
              <span className="min-w-0 text-neutral-600">
                {event.note ? richExcerpt(event.note, 400) : event.kind}
                {event.recordedBy != null && (
                  <span className="text-neutral-400"> · {event.recordedBy}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {action !== null && (
        <ActionDialog
          action={action}
          caseRow={detail}
          onClose={() => setAction(null)}
          onDone={done}
        />
      )}
    </div>
  );
}

/**
 * What can happen next.
 *
 * Driven by status rather than by listing everything the API accepts. The
 * service enforces the real ordering, `scheduleHearing` refuses a case where
 * the allegation has not been put, and a screen that offers the refused thing
 * only finds out after somebody has written three paragraphs.
 */
function Steps({
  status,
  onPick,
}: {
  status: RelationsCase["status"];
  onPick: (action: Action) => void;
}) {
  const steps: { action: Action; label: string }[] = [];

  if (status === "open") {
    steps.push({ action: "allegation", label: "Put the allegation" });
    steps.push({ action: "investigate", label: "Start investigating" });
  }

  if (status === "investigating") {
    steps.push({ action: "findings", label: "Record findings" });
    steps.push({ action: "hearing", label: "Schedule a hearing" });
  }

  if (status === "hearing_scheduled") {
    steps.push({ action: "hearing", label: "Move the hearing" });
  }

  if (status === "open" || status === "investigating" || status === "hearing_scheduled") {
    steps.push({ action: "decide", label: "Decide it" });
    steps.push({ action: "withdraw", label: "Withdraw" });
  }

  if (status === "under_appeal") {
    steps.push({ action: "appeal", label: "Decide the appeal" });
  }

  if (steps.length === 0) {
    return (
      <p className="border-t border-neutral-200 pt-3 text-[11px] text-neutral-500">
        This case is finished. Nothing further can be recorded against it.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
      {steps.map((step) => (
        <button
          key={step.action}
          type="button"
          onClick={() => onPick(step.action)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            step.action === "withdraw"
              ? "border border-neutral-200 text-neutral-600 hover:bg-white"
              : "bg-white text-neutral-800 shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-50"
          }`}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ActionDialog({
  action,
  caseRow,
  onClose,
  onDone,
}: {
  action: Action;
  caseRow: RelationsCase;
  onClose: () => void;
  onDone: () => void;
}) {
  switch (action) {
    case "allegation":
      return <AllegationForm caseRow={caseRow} onClose={onClose} onDone={onDone} />;
    case "investigate":
      return <InvestigateForm caseRow={caseRow} onClose={onClose} onDone={onDone} />;
    case "findings":
      return <FindingsForm caseRow={caseRow} onClose={onClose} onDone={onDone} />;
    case "hearing":
      return <HearingForm caseRow={caseRow} onClose={onClose} onDone={onDone} />;
    case "decide":
      return <DecideForm caseRow={caseRow} onClose={onClose} onDone={onDone} />;
    case "appeal":
      return <AppealForm caseRow={caseRow} onClose={onClose} onDone={onDone} />;
    case "withdraw":
      return <WithdrawForm caseRow={caseRow} onClose={onClose} onDone={onDone} />;
  }
}

type FormProps = {
  caseRow: RelationsCase;
  onClose: () => void;
  onDone: () => void;
};

function AllegationForm({ caseRow, onClose, onDone }: FormProps) {
  const [note, setNote] = useState("");
  const { submit, saving, error } = useSubmit(onDone);

  return (
    <Dialog
      title="Put the allegation to them"
      subtitle="What they are said to have done, in the words they will be given. Nothing can be decided until this is recorded."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => submit(e, () => hrm.relations.serveAllegation(caseRow.id, note))}
        className="space-y-3"
      >
        <Field
          id="allegation-note"
          label="The allegation"
          hint="Specific enough to answer. “Poor attitude” is not something anybody can defend themselves against."
        >
          <RichTextEditor id="allegation-note" minHeight={154} describedBy="allegation-note-hint" value={note} onChange={setNote} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Record it"
          saving={saving}
          disabled={note.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

function InvestigateForm({ caseRow, onClose, onDone }: FormProps) {
  const [investigatorId, setInvestigatorId] = useState("");
  const [note, setNote] = useState("");
  const people = useEmployees();
  const { submit, saving, error } = useSubmit(onDone);

  return (
    <Dialog
      title="Start investigating"
      subtitle="Who is looking into it, and anything worth recording about how."
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.relations.investigate(caseRow.id, {
              investigatorId: investigatorId === "" ? null : investigatorId,
              note: note === "" ? null : note,
            }),
          )
        }
        className="space-y-3"
      >
        <Field
          id="investigator"
          label="Investigator"
          hint="Somebody with no part in what is alleged. Leave blank if it has not been decided yet."
        >
          <SearchableSelect
            id="investigator"
            aria-describedby="investigator-hint"
            value={investigatorId}
            onChange={setInvestigatorId}
            options={[
              { value: "", label: "Not assigned yet" },
              ...peopleOptions(people),
            ]}
          />
        </Field>

        <Field id="investigate-note" label="Note">
          <RichTextEditor id="investigate-note" minHeight={102} value={note} onChange={setNote} />
        </Field>

        <ErrorNote error={error} />
        <FormActions onCancel={onClose} submitLabel="Start" saving={saving} />
      </form>
    </Dialog>
  );
}

function FindingsForm({ caseRow, onClose, onDone }: FormProps) {
  const [findings, setFindings] = useState("");
  const { submit, saving, error } = useSubmit(onDone);

  return (
    <Dialog
      title="Record the findings"
      subtitle="What the investigation established."
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () => hrm.relations.recordFindings(caseRow.id, findings))
        }
        className="space-y-3"
      >
        <Field
          id="findings"
          label="Findings"
          hint="Kept with HR. The person is given the allegation and the outcome; this is the working record behind them."
        >
          <RichTextEditor id="findings" variant="full" describedBy="findings-hint" value={findings} onChange={setFindings} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Record"
          saving={saving}
          disabled={findings.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

function HearingForm({ caseRow, onClose, onDone }: FormProps) {
  const [hearingAt, setHearingAt] = useState("");
  const [heardById, setHeardById] = useState("");
  const [companionOffered, setCompanionOffered] = useState(true);
  const [note, setNote] = useState("");
  const people = useEmployees();
  const { submit, saving, error } = useSubmit(onDone);

  return (
    <Dialog
      title="Schedule the hearing"
      subtitle="When it is, who is hearing it, and whether they were told they can bring somebody."
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.relations.scheduleHearing(caseRow.id, {
              hearingAt,
              heardById: heardById === "" ? null : heardById,
              companionOffered,
              note: note === "" ? null : note,
            }),
          )
        }
        className="space-y-3"
      >
        <Field id="hearing-at" label="When">
          <input
            id="hearing-at"
            type="datetime-local"
            value={hearingAt}
            onChange={(e) => setHearingAt(e.target.value)}
            required
            className={INPUT}
          />
        </Field>

        <Field
          id="heard-by"
          label="Heard by"
          hint="Not the investigator. Someone deciding on findings they gathered themselves is a common procedural failure."
        >
          <SearchableSelect
            id="heard-by"
            aria-describedby="heard-by-hint"
            value={heardById}
            onChange={setHeardById}
            options={[
              { value: "", label: "Not decided yet" },
              ...peopleOptions(people),
            ]}
          />
        </Field>

        {/*
          Ticked by default, because it is a right in almost every policy and
          the failure mode is forgetting to offer it rather than choosing not
          to. Recorded either way, an unticked box here is evidence.
        */}
        <div className="flex items-start gap-2 rounded-xl border border-neutral-200 px-3 py-2.5">
          <input
            id="companion"
            type="checkbox"
            aria-describedby="companion-hint"
            checked={companionOffered}
            onChange={(e) => setCompanionOffered(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <label htmlFor="companion" className="text-xs text-neutral-700">
              They were told they can be accompanied
            </label>
            <p id="companion-hint" className="mt-0.5 text-[11px] text-neutral-500">
              Recorded on the case either way. A hearing held without the offer
              is one your organisation will struggle to defend.
            </p>
          </div>
        </div>

        <Field id="hearing-note" label="Note">
          <RichTextEditor id="hearing-note" minHeight={76} value={note} onChange={setNote} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Schedule"
          saving={saving}
          disabled={hearingAt === ""}
        />
      </form>
    </Dialog>
  );
}

function DecideForm({ caseRow, onClose, onDone }: FormProps) {
  const [outcome, setOutcome] = useState<CaseOutcome | "">("");
  const [reason, setReason] = useState("");
  const [lifespan, setLifespan] = useState<string>("");
  const [decidedById, setDecidedById] = useState("");
  const people = useEmployees();
  const { submit, saving, error } = useSubmit(onDone);

  const available = OUTCOMES.filter((o) => o.kinds.includes(caseRow.kind));
  const chosen = available.find((o) => o.value === outcome) ?? null;

  return (
    <Dialog
      title="Decide the case"
      subtitle="The outcome, and the reasons the person will be given."
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.relations.decide(caseRow.id, {
              outcome: outcome as CaseOutcome,
              reason,
              decidedById: decidedById === "" ? null : decidedById,
              lifespanMonths: lifespan === "" ? null : Number(lifespan),
            }),
          )
        }
        className="space-y-3"
      >
        {/*
          Starts empty even where the ladder has an obvious next rung. A
          pre-filled outcome turns "what does the policy say" into "what did
          the software already pick", which is not a decision anybody can
          defend at an appeal.
        */}
        <Field id="outcome" label="Outcome">
          <SearchableSelect
            id="outcome"
            value={outcome}
            onChange={(v) => {
              const next = v as CaseOutcome | "";
              setOutcome(next);
              const spec = available.find((o) => o.value === next);
              setLifespan(
                spec?.lifespanMonths != null ? String(spec.lifespanMonths) : "",
              );
            }}
            required
            options={[
              { value: "", label: "Choose an outcome" },
              ...available.map((o) => ({ value: o.value, label: o.label })),
            ]}
          />
          {chosen?.note !== undefined && (
            <p className="mt-1 text-[11px] text-neutral-500">{chosen.note}</p>
          )}
        </Field>

        {/*
          Only where the outcome actually puts something on the record. Asking
          how long "no case to answer" lasts is a nonsense question.
        */}
        {chosen?.lifespanMonths != null && (
          <Field
            id="lifespan"
            label="Counts for"
            hint="After this it stops counting towards any future escalation. Zero makes it permanent, which some policies do for the most serious findings."
          >
            <SearchableSelect
              id="lifespan"
              aria-describedby="lifespan-hint"
              value={lifespan}
              onChange={setLifespan}
              options={[
                { value: "6", label: "6 months" },
                { value: "12", label: "12 months" },
                { value: "18", label: "18 months" },
                { value: "24", label: "24 months" },
                { value: "0", label: "Permanently" },
              ]}
            />
          </Field>
        )}

        <Field
          id="decided-by"
          label="Decided by"
          hint="Whoever actually took the decision, which may not be whoever is typing it in."
        >
          <SearchableSelect
            id="decided-by"
            aria-describedby="decided-by-hint"
            value={decidedById}
            onChange={setDecidedById}
            options={[
              { value: "", label: "Not recorded" },
              ...peopleOptions(people),
            ]}
          />
        </Field>

        <Field
          id="decide-reason"
          label="Reasons"
          hint="Given to the person. If it is appealed, this is what the appeal is against."
        >
          <RichTextEditor id="decide-reason" minHeight={154} describedBy="decide-reason-hint" value={reason} onChange={setReason} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Decide"
          saving={saving}
          disabled={outcome === "" || reason.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

function AppealForm({ caseRow, onClose, onDone }: FormProps) {
  const [upheld, setUpheld] = useState<"" | "yes" | "no">("");
  const [reason, setReason] = useState("");
  const [heardById, setHeardById] = useState("");
  const people = useEmployees();
  const { submit, saving, error } = useSubmit(onDone);

  return (
    <Dialog
      title="Decide the appeal"
      subtitle="Whether the original outcome stands."
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.relations.decideAppeal(caseRow.id, {
              upheld: upheld === "yes",
              reason,
              appealHeardById: heardById === "" ? null : heardById,
            }),
          )
        }
        className="space-y-3"
      >
        {caseRow.appealGrounds != null && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-[11px] font-medium text-neutral-500">
              What they said
            </p>
            <RichTextView value={caseRow.appealGrounds} size="sm" className="mt-1 text-neutral-700" />
          </div>
        )}

        <Field id="appeal-upheld" label="The appeal is">
          <SearchableSelect
            id="appeal-upheld"
            value={upheld}
            onChange={(v) => setUpheld(v as "" | "yes" | "no")}
            required
            options={[
              { value: "", label: "Choose" },
              { value: "yes", label: "Upheld: the outcome does not stand" },
              { value: "no", label: "Not upheld: the outcome stands" },
            ]}
          />
        </Field>

        <Field
          id="appeal-heard-by"
          label="Heard by"
          hint="Somebody who had no part in the original decision. An appeal heard by the person who decided it is not an appeal."
        >
          <SearchableSelect
            id="appeal-heard-by"
            aria-describedby="appeal-heard-by-hint"
            value={heardById}
            onChange={setHeardById}
            options={[
              { value: "", label: "Not recorded" },
              ...peopleOptions(people),
            ]}
          />
        </Field>

        <Field id="appeal-reason" label="Reasons">
          <RichTextEditor id="appeal-reason" minHeight={154} value={reason} onChange={setReason} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Record"
          saving={saving}
          disabled={upheld === "" || reason.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

function WithdrawForm({ caseRow, onClose, onDone }: FormProps) {
  const [reason, setReason] = useState("");
  const { submit, saving, error } = useSubmit(onDone);

  return (
    <Dialog
      title="Withdraw the case"
      subtitle="It closes with no finding against anybody."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => submit(e, () => hrm.relations.withdraw(caseRow.id, reason))}
        className="space-y-3"
      >
        {/*
          Withdrawing is not deciding, and the distinction is the person's
          record. A withdrawn case leaves nothing on it and counts towards no
          future escalation, which is exactly why the reason is required.
        */}
        <Field
          id="withdraw-reason"
          label="Why"
          hint="Nothing goes on anybody's record, and this case counts towards no future escalation."
        >
          <RichTextEditor id="withdraw-reason" minHeight={128} describedBy="withdraw-reason-hint" value={reason} onChange={setReason} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Withdraw"
          saving={saving}
          danger
          disabled={reason.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

/** The roster, for the several pickers on this screen. */
export function useEmployees(): Employee[] {
  const [people, setPeople] = useState<Employee[]>([]);

  useEffect(() => {
    let cancelled = false;

    hrm.employees
      .listAll()
      .then((all) => {
        if (!cancelled) setPeople(all);
      })
      .catch(() => {
        /* A picker that cannot load its options degrades to "not recorded",
           which every one of these fields already accepts. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return people;
}

/** Staff as picker options, labelled the way the old native options read. */
export function peopleOptions(people: Employee[]) {
  return people.map((person) => ({
    value: person.id,
    label: `${person.person.name ?? "Unnamed"} · ${person.jobTitle}`,
  }));
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className="truncate text-neutral-800">{value}</dd>
    </div>
  );
}

export { OUTCOMES };
