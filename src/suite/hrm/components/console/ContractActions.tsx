"use client";

import { useState } from "react";
import {
  hrm,
  type EmploymentContract,
  type EmploymentStatus,
  type EmploymentType,
} from "@/lib/api/hrm-client";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { peopleOptions, useEmployees } from "./CaseWorkflow";
import {
  Dialog,
  ErrorNote,
  Field,
  FormActions,
  INPUT,
  useSubmit,
} from "./Dialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Issuing an agreement, and ending one.
 *
 * The contracts board was a watchlist: it counted down to expiry and offered
 * renewal, so the only agreement that could exist in the product was one
 * renewed from an agreement somebody else had created. A first contract could
 * not be issued at all, and a contract ended early, the commonest reason
 * being that the person left, had no route either.
 *
 * Money is in kobo everywhere in the module, so the conversion from the naira
 * figure somebody types happens once, here, rather than being assumed at
 * either end.
 */

const TYPES: { value: EmploymentType; label: string }[] = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Fixed term" },
  { value: "intern", label: "Internship" },
  { value: "casual", label: "Casual" },
];

export function IssueContractDialog({
  employeeId,
  onClose,
  onIssued,
}: {
  /** Fixed when issuing from somebody's record; picked otherwise. */
  employeeId?: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const people = useEmployees();
  const [person, setPerson] = useState(employeeId ?? "");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("permanent");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [grossSalary, setGrossSalary] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState("month");
  const [noticeDays, setNoticeDays] = useState("");
  const [asDraft, setAsDraft] = useState(false);

  const { submit, saving, error } = useSubmit(onIssued);

  /* A permanent agreement with an end date is a fixed term nobody labelled. */
  const needsEnd = employmentType !== "permanent";

  return (
    <Dialog
      title="Issue an agreement"
      subtitle="The terms this person is employed on, from a date."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.contracts.issue(person, {
              employmentType,
              startsOn,
              endsOn: endsOn === "" ? null : endsOn,
              jobTitle: jobTitle === "" ? null : jobTitle,
              department: department === "" ? null : department,
              grossSalary:
                grossSalary === "" ? null : Math.round(Number(grossSalary) * 100),
              salaryPeriod,
              noticeDays: noticeDays === "" ? null : Number(noticeDays),
              status: asDraft ? "draft" : "active",
            }),
          )
        }
        className="space-y-3"
      >
        {employeeId === undefined && (
          <Field id="ic-person" label="Who">
            <SearchableSelect
              id="ic-person"
              value={person}
              onChange={setPerson}
              required
              options={[{ value: "", label: "Choose somebody" }, ...peopleOptions(people)]}
            />
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ic-type" label="Kind of employment">
            <SearchableSelect
              id="ic-type"
              value={employmentType}
              onChange={(v) => setEmploymentType(v as EmploymentType)}
              options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </Field>

          <Field id="ic-notice" label="Notice period (days)">
            <input
              id="ic-notice"
              type="number"
              min={0}
              max={365}
              value={noticeDays}
              onChange={(e) => setNoticeDays(e.target.value)}
              className={INPUT}
            />
          </Field>

          <Field id="ic-starts" label="Starts">
            <input
              id="ic-starts"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              required
              className={INPUT}
            />
          </Field>

          <Field
            id="ic-ends"
            label="Ends"
            hint={
              needsEnd
                ? "A fixed term needs one, or nothing will ever chase its renewal."
                : "Leave blank. A permanent agreement with an end date is a fixed term nobody labelled."
            }
          >
            <input
              id="ic-ends"
              type="date"
              aria-describedby="ic-ends-hint"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={INPUT}
            />
          </Field>

          <Field id="ic-title" label="Job title">
            <JobTitlePicker
              mode="name"
              id="ic-title"
              value={jobTitle}
              onChange={(name) => setJobTitle(name)}
              clearable
            />
          </Field>

          <Field id="ic-department" label="Department">
            <input
              id="ic-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              maxLength={255}
              className={INPUT}
            />
          </Field>

          <Field id="ic-salary" label="Gross salary" hint="In naira.">
            <input
              id="ic-salary"
              type="number"
              min={0}
              step="0.01"
              aria-describedby="ic-salary-hint"
              value={grossSalary}
              onChange={(e) => setGrossSalary(e.target.value)}
              className={INPUT}
            />
          </Field>

          <Field id="ic-period" label="Per">
            <SearchableSelect
              id="ic-period"
              value={salaryPeriod}
              onChange={setSalaryPeriod}
              options={[
                { value: "month", label: "Month" },
                { value: "year", label: "Year" },
                { value: "day", label: "Day" },
                { value: "hour", label: "Hour" },
              ]}
            />
          </Field>
        </div>

        {/*
          A draft is an agreement nobody is employed on yet. Offered because
          terms are usually settled before they are signed, and issuing it
          active would make the record say somebody is on terms they have not
          seen.
        */}
        <div className="flex items-start gap-2 rounded-xl bg-neutral-50 px-3 py-3">
          <input
            id="ic-draft"
            type="checkbox"
            aria-describedby="ic-draft-hint"
            checked={asDraft}
            onChange={(e) => setAsDraft(e.target.checked)}
            className="mt-0.5 accent-primary-600"
          />
          <div>
            <label htmlFor="ic-draft" className="text-xs text-neutral-700">
              Save as a draft
            </label>
            <p id="ic-draft-hint" className="mt-0.5 text-xs text-neutral-500">
              Nobody is employed on a draft. Use it while terms are still being
              agreed, so the record does not say they are on terms they have
              not seen.
            </p>
          </div>
        </div>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Issue"
          saving={saving}
          disabled={person === "" || startsOn === ""}
        />
      </form>
    </Dialog>
  );
}

/**
 * Ending an agreement before its term.
 *
 * The status matters more than the date. `resigned`, `terminated` and `ended`
 * are three different things to say about somebody, they follow a person into
 * every reference, and only one of them is a dismissal, so the form asks
 * rather than defaulting to the harshest.
 */
export function TerminateContractDialog({
  contract,
  onClose,
  onTerminated,
}: {
  contract: EmploymentContract;
  onClose: () => void;
  onTerminated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [endedOn, setEndedOn] = useState("");
  const [employmentStatus, setEmploymentStatus] =
    useState<EmploymentStatus>("resigned");
  const { submit, saving, error } = useSubmit(onTerminated);

  return (
    <Dialog
      title="End this agreement"
      subtitle={`${contract.employee?.name ?? "Unnamed"} · ${contract.jobTitle}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.contracts.terminate(contract.id, {
              reason,
              endedOn: endedOn === "" ? undefined : endedOn,
              employmentStatus,
            }),
          )
        }
        className="space-y-3"
      >
        {/*
          Asked, and defaulted to the mildest rather than the harshest.
          "Terminated" is a dismissal and follows somebody into every reference
          they ever ask for; getting it by accident because it was first in the
          list is not acceptable.
        */}
        <Field
          id="tc-status"
          label="How the employment ends"
          hint="This follows the person into every reference. Only one of these is a dismissal."
        >
          <SearchableSelect
            id="tc-status"
            aria-describedby="tc-status-hint"
            value={employmentStatus}
            onChange={(v) => setEmploymentStatus(v as EmploymentStatus)}
            options={[
              { value: "resigned", label: "They resigned" },
              { value: "ended", label: "Ended: redundancy, or a term not renewed" },
              { value: "terminated", label: "Terminated: a dismissal" },
            ]}
          />
        </Field>

        <Field
          id="tc-ended"
          label="Last day"
          hint="Leave blank for today."
        >
          <input
            id="tc-ended"
            type="date"
            aria-describedby="tc-ended-hint"
            value={endedOn}
            onChange={(e) => setEndedOn(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field id="tc-reason" label="Why">
          <RichTextEditor id="tc-reason" minHeight={128} value={reason} onChange={setReason} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="End it"
          saving={saving}
          danger
          disabled={reason.trim() === ""}
        />
      </form>
    </Dialog>
  );
}
