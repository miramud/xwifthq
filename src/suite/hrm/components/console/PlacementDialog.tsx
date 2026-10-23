"use client";

import { useState } from "react";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  hrm,
  type InternshipCohort,
  type InternshipPlacement,
} from "@/lib/api/hrm-client";
import { peopleOptions, useEmployees } from "./CaseWorkflow";
import {
  Dialog,
  ErrorNote,
  Field,
  FormActions,
  INPUT,
  useSubmit,
} from "./Dialog";

/**
 * Putting an intern into a cohort, and correcting one already there.
 *
 * Cohorts could be opened and conversions decided, and nothing in between:
 * there was no way to place anybody into a cohort from the product, so every
 * cohort on the board was necessarily empty and the conversion screen had
 * nothing to decide about.
 *
 * The mentor is the field worth insisting on. An internship with no named
 * mentor is work experience — nobody is answerable for the person's time, and
 * at the end nobody can say whether they were any good, which is exactly the
 * judgement the conversion decision needs.
 */
export default function PlacementDialog({
  cohort,
  existing,
  onClose,
  onSaved,
}: {
  /** Required when placing somebody; the cohort is fixed when editing. */
  cohort?: InternshipCohort;
  existing?: InternshipPlacement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const people = useEmployees();

  const [employeeId, setEmployeeId] = useState(existing?.employeeId ?? "");
  const [mentorId, setMentorId] = useState(existing?.mentor?.id ?? "");
  const [institution, setInstitution] = useState(existing?.institution ?? "");
  const [programmeOfStudy, setProgrammeOfStudy] = useState(
    existing?.programmeOfStudy ?? "",
  );
  const [focusArea, setFocusArea] = useState(existing?.focusArea ?? "");
  const [startsOn, setStartsOn] = useState(
    existing?.startsOn ?? cohort?.startsOn ?? "",
  );
  const [endsOn, setEndsOn] = useState(existing?.endsOn ?? cohort?.endsOn ?? "");

  const { submit, saving, error } = useSubmit(onSaved);

  const payload = {
    employeeId,
    mentorId: mentorId === "" ? undefined : mentorId,
    institution: institution === "" ? undefined : institution,
    programmeOfStudy: programmeOfStudy === "" ? undefined : programmeOfStudy,
    focusArea: focusArea === "" ? undefined : focusArea,
    startsOn: startsOn === "" ? undefined : startsOn,
    endsOn: endsOn === "" ? undefined : endsOn,
  };

  return (
    <Dialog
      title={existing !== undefined ? "Edit the placement" : "Place an intern"}
      subtitle={
        existing !== undefined
          ? (existing.intern?.name ?? "Unnamed")
          : (cohort?.name ?? "")
      }
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            existing !== undefined
              ? hrm.internships.updatePlacement(existing.id, payload)
              : hrm.internships.place(cohort?.id ?? "", payload),
          )
        }
        className="space-y-3"
      >
        {existing === undefined && (
          <Field
            id="pl-person"
            label="Who"
            hint="They need an employment record first — an intern is employed, on intern terms."
          >
            <SearchableSelect
              id="pl-person"
              aria-describedby="pl-person-hint"
              value={employeeId}
              onChange={setEmployeeId}
              required
              options={[{ value: "", label: "Choose somebody" }, ...peopleOptions(people)]}
            />
          </Field>
        )}

        {/*
          The one that decides whether this is an internship or unpaid filing.
          Somebody has to be answerable for the person's time, and at the end
          somebody has to be able to say whether they were any good — which is
          precisely what the conversion decision turns on.
        */}
        <Field
          id="pl-mentor"
          label="Mentor"
          hint="An internship with nobody named is work experience. At the end, this is the person who can say whether they should be offered a job."
        >
          <SearchableSelect
            id="pl-mentor"
            aria-describedby="pl-mentor-hint"
            value={mentorId}
            onChange={setMentorId}
            options={[{ value: "", label: "Not assigned yet" }, ...peopleOptions(people)]}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="pl-institution" label="From which institution">
            <input
              id="pl-institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className={INPUT}
            />
          </Field>

          <Field id="pl-programme" label="Studying">
            <input
              id="pl-programme"
              value={programmeOfStudy}
              onChange={(e) => setProgrammeOfStudy(e.target.value)}
              className={INPUT}
            />
          </Field>

          <Field
            id="pl-focus"
            label="Focus"
            hint="What they are here to learn, rather than what they are here to do."
          >
            <input
              id="pl-focus"
              aria-describedby="pl-focus-hint"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              className={INPUT}
            />
          </Field>

          <div />

          <Field id="pl-starts" label="From">
            <input
              id="pl-starts"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className={INPUT}
            />
          </Field>

          <Field
            id="pl-ends"
            label="Until"
            hint="Defaults to the cohort's dates. A placement that runs differently is fine, and worth recording as such."
          >
            <input
              id="pl-ends"
              type="date"
              aria-describedby="pl-ends-hint"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel={existing !== undefined ? "Save" : "Place them"}
          saving={saving}
          disabled={employeeId === ""}
        />
      </form>
    </Dialog>
  );
}
