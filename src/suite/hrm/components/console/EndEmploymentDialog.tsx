"use client";

import { useState } from "react";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  hrm,
  type Employee,
  type EmploymentStatus,
} from "@/lib/api/hrm-client";
import {
  Dialog,
  ErrorNote,
  Field,
  FormActions,
  INPUT,
  useSubmit,
} from "./Dialog";
import { SignInToggle } from "./OffboardingBoard";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Ending an employment record directly.
 *
 * The proper route out is the Leavers board: it raises a clearance list, keeps
 * the access review honest, and is what the exit interview and final
 * settlement hang off. This one does none of that, and the dialog says so —
 * because an HR officer reaching for the button on somebody's record has
 * usually not realised there is a better one.
 *
 * It exists for the cases the Leavers board cannot serve: a historic leaver
 * being tidied up, a record created in error, a departure settled outside the
 * system before anybody started using it.
 *
 * The status is the part that matters. `resigned`, `ended` and `terminated`
 * are three different things to say about somebody and they follow a person
 * into every reference they ever ask for, so the form asks rather than
 * defaulting to the harshest.
 */
export default function EndEmploymentDialog({
  employee,
  onClose,
  onEnded,
}: {
  employee: Employee;
  onClose: () => void;
  onEnded: () => void;
}) {
  const [status, setStatus] = useState<EmploymentStatus>("resigned");
  const [reason, setReason] = useState("");
  const [endedOn, setEndedOn] = useState("");
  const [disableSignIn, setDisableSignIn] = useState(true);
  const { submit, saving, error } = useSubmit(onEnded);

  return (
    <Dialog
      title="End this employment"
      subtitle={employee.person.name ?? "Unnamed"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.employees.exit(employee.id, {
              status,
              reason,
              endedOn: endedOn === "" ? undefined : endedOn,
              disableSignIn,
            }),
          )
        }
        className="space-y-3"
      >
        {/*
          Said before anything is filled in. Somebody who came here to record
          an ordinary resignation wants the Leavers board, and finding that
          out after the fact means an employment ended with no clearance list,
          no access review and no exit interview.
        */}
        <div className="rounded-xl bg-sun-50 px-3.5 py-3">
          <p className="text-sm font-medium text-sun-700">
            This ends the record without a clearance list: no equipment is
            chased and no exit interview is offered. On the last day their
            roles and project places are removed.
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            For somebody actually leaving now, record the departure on the
            Leavers board instead. Use this for a historic leaver or a record
            created in error.
          </p>
        </div>

        <Field
          id="ee-status"
          label="How it ends"
          hint="This follows the person into every reference. Only one of these is a dismissal."
        >
          <SearchableSelect
            id="ee-status"
            aria-describedby="ee-status-hint"
            value={status}
            onChange={(v) => setStatus(v as EmploymentStatus)}
            options={[
              { value: "resigned", label: "They resigned" },
              { value: "ended", label: "Ended: redundancy, or a term not renewed" },
              { value: "terminated", label: "Terminated: a dismissal" },
            ]}
          />
        </Field>

        <Field id="ee-date" label="Last day" hint="Leave blank for today.">
          <input
            id="ee-date"
            type="date"
            aria-describedby="ee-date-hint"
            value={endedOn}
            onChange={(e) => setEndedOn(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field
          id="ee-reason"
          label="Why"
          hint="Kept on the record as the exit reason, and it is what anybody reading this in two years has to go on."
        >
          <RichTextEditor id="ee-reason" minHeight={128} describedBy="ee-reason-hint" value={reason} onChange={setReason} />
        </Field>

        <SignInToggle id="ee-sign-in" checked={disableSignIn} onChange={setDisableSignIn} />

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
