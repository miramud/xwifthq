"use client";

import { useState } from "react";
import { Check, Copy, UserPlus, X } from "lucide-react";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { ReportsToField } from "./ReportsTo";
import {
  ApiError,
  hrm,
  type EmploymentType,
  type HireResult,
} from "@/lib/api/hrm-client";

/**
 * Taking somebody on.
 *
 * The form mirrors what the API insists on rather than asking for everything it
 * could store. Two rules drive the layout:
 *
 * **A fixed term must state its end date.** The field appears and becomes
 * required the moment the engagement type needs one, because a contract with no
 * end date is how somebody works eight months on a three-month term, the
 * single most consequential omission in the module.
 *
 * **Only an email address is genuinely needed for the person.** The account is
 * created if it does not exist, a name is derived from the address, and a
 * temporary password is emailed. Everything else about them is theirs to
 * correct once they are in.
 */

const TYPES: { value: EmploymentType; label: string; hint: string }[] = [
  { value: "permanent", label: "Permanent", hint: "Open-ended. Serves probation." },
  { value: "contract", label: "Contract", hint: "Fixed term with an end date." },
  { value: "intern", label: "Intern", hint: "Fixed term, mentored." },
  { value: "casual", label: "Casual", hint: "As needed. No probation." },
];

const NEEDS_END_DATE: EmploymentType[] = ["contract", "intern"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HireDialog({
  open,
  onClose,
  onHired,
}: {
  open: boolean;
  onClose: () => void;
  onHired: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("permanent");
  const [hiredOn, setHiredOn] = useState(today());
  const [startedOn, setStartedOn] = useState(today());
  const [endedOn, setEndedOn] = useState("");
  const [salary, setSalary] = useState("");
  // Their line manager (S9): who decides their leave on My team.
  const [managerId, setManagerId] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<HireResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const needsEnd = NEEDS_END_DATE.includes(employmentType);

  const reset = () => {
    setEmail("");
    setName("");
    setJobTitle("");
    setDepartment("");
    setEmploymentType("permanent");
    setHiredOn(today());
    setStartedOn(today());
    setEndedOn("");
    setSalary("");
    setManagerId("");
    setError(null);
    setFieldErrors({});
    setResult(null);
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const hired = await hrm.employees.hire({
        email: email.trim(),
        name: name.trim() === "" ? undefined : name.trim(),
        jobTitle: jobTitle.trim(),
        department: department.trim() === "" ? undefined : department.trim(),
        employmentType,
        hiredOn,
        startedOn: startedOn === "" ? undefined : startedOn,
        endedOn: endedOn === "" ? undefined : endedOn,
        // Naira in the field, kobo on the wire, the integer is the record.
        grossSalary: salary === "" ? undefined : Math.round(Number(salary) * 100),
        managerId: managerId === "" ? undefined : managerId,
        startOnboarding: true,
      });

      setResult(hired);
      setError(null);
      setFieldErrors({});
      onHired();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.errors ?? {});
      } else {
        setError("That did not go through.");
      }
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (...keys: string[]): string | null => {
    for (const key of keys) {
      const found = fieldErrors[key];
      if (found && found.length > 0) return found[0];
    }
    return null;
  };

  /* ---------------------------------------------------------------- */
  /*  Done                                                             */
  /* ---------------------------------------------------------------- */

  if (result !== null) {
    const password = result.meta.temporaryPassword;

    return (
      <Backdrop onClose={close}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-500/10">
              <Check size={20} className="text-success-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-neutral-900">
                {result.data.person.name} is on the books
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                {result.meta.invited
                  ? "An account was created and the joining details have been emailed."
                  : "They already had an account here, so no new credentials were sent."}
              </p>
            </div>
          </div>

          {password !== null && (
            <div className="mt-4 rounded-xl border border-warning-500/30 bg-warning-500/5 p-4">
              <p className="text-xs font-medium text-neutral-700">
                Temporary password (shown once)
              </p>
              <p className="mt-1 text-[11px] text-neutral-600">
                It has already been emailed. This copy is only so you can help
                somebody whose mail never arrived. They must replace it before
                they can use anything.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900">
                  {password}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(password);
                    setCopied(true);
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Hire somebody else
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Done
            </button>
          </div>
        </div>
      </Backdrop>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  The form                                                         */
  /* ---------------------------------------------------------------- */

  return (
    <Backdrop onClose={close}>
      <form onSubmit={submit} className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
              <UserPlus size={20} className="text-primary-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                Take somebody on
              </h2>
              <p className="text-xs text-neutral-500">
                Creates the account, the record, the agreement and the checklist.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X size={18} />
          </button>
        </div>

        {error !== null && (
          <p className="mt-4 rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-700">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <Field
            label="Email address"
            hint="The only thing genuinely required. An account is created if there is not one already."
            error={fieldError("email")}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ada.lovelace@acme.test"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" hint="Derived from the address when left blank.">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className={inputClass}
              />
            </Field>

            <Field label="Job title" error={fieldError("jobTitle", "job_title")}>
              <JobTitlePicker
                mode="name"
                required
                value={jobTitle}
                onChange={(name) => setJobTitle(name)}
                aria-invalid={fieldError("jobTitle", "job_title") !== null || undefined}
              />
            </Field>
          </div>

          <Field label="Engagement">
            <div className="grid gap-2 sm:grid-cols-2">
              {TYPES.map((type) => (
                <label
                  key={type.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                    employmentType === type.value
                      ? "border-primary-400 bg-primary-50"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="employmentType"
                    value={type.value}
                    checked={employmentType === type.value}
                    onChange={() => setEmploymentType(type.value)}
                    className="mt-0.5 accent-primary-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-900">
                      {type.label}
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {type.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Offer accepted"
              hint="Notice periods run from here."
              error={fieldError("hiredOn", "hired_on")}
            >
              <input
                type="date"
                required
                value={hiredOn}
                onChange={(e) => setHiredOn(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field
              label="First day"
              hint="Service and probation run from here."
              error={fieldError("startedOn", "started_on")}
            >
              <input
                type="date"
                value={startedOn}
                onChange={(e) => setStartedOn(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {needsEnd && (
            <Field
              label="Term ends"
              hint="Required for a fixed term: the date every expiry report watches."
              error={fieldError("endedOn", "ended_on")}
            >
              <input
                type="date"
                required
                value={endedOn}
                onChange={(e) => setEndedOn(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department">
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Delivery"
                className={inputClass}
              />
            </Field>

            <Field label="Gross salary (₦ / month)">
              <input
                type="number"
                min={0}
                step={1000}
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="450000"
                className={inputClass}
              />
            </Field>
          </div>

          <ReportsToField
            id="hire-reports-to"
            value={managerId}
            onChange={setManagerId}
            error={fieldError("managerId", "manager_id")}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {busy ? "Taking them on…" : "Take them on"}
          </button>
        </div>
      </form>
    </Backdrop>
  );
}

/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] text-error-700">{error}</span>
      ) : (
        hint && (
          <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>
        )
      )}
    </label>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
