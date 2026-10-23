"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  testSprints as testSprintsApi,
  type BoardSetup,
  type Project,
  type Sprint,
  type TestSprint,
  type TestSprintFocus,
} from "@/lib/api/projects-client";
import { CheckRow, FieldError, Modal, Notice, hintCls, inputCls, labelCls } from "../ui/pkit";
import { FOCUS_META } from "./testingUi";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

const FOCI: TestSprintFocus[] = ["functional", "security", "full", "regression"];

/**
 * Plan a test sprint, or edit one.
 *
 * Naming the delivery sprint under test brings in every case that proves
 * its stories, which is what a test sprint for "Sprint 4" nearly always means.
 */
export default function TestSprintDialog({
  project,
  sprints,
  setup,
  testSprint,
  onClose,
  onSaved,
}: {
  project: Project;
  sprints: Sprint[];
  setup: BoardSetup | null;
  /** Null to plan a new one. */
  testSprint: TestSprint | null;
  onClose: () => void;
  onSaved: (saved: TestSprint) => void;
}) {
  const running = sprints.find((s) => s.status === "active");
  const [name, setName] = useState(testSprint?.name ?? "");
  const [goal, setGoal] = useState(testSprint?.goal ?? "");
  const [focus, setFocus] = useState<TestSprintFocus>(testSprint?.focus ?? "functional");
  const [targetSprintId, setTargetSprintId] = useState(testSprint ? (testSprint.targetSprintId ?? "") : (running?.id ?? ""));
  const [environment, setEnvironment] = useState(testSprint?.environment ?? "");
  const [leadId, setLeadId] = useState(testSprint?.lead?.id ?? "");
  const [startsOn, setStartsOn] = useState(testSprint?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(testSprint?.endsOn ?? "");
  const [includeCases, setIncludeCases] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const input: Record<string, unknown> = {
      ...(name.trim() !== "" ? { name: name.trim() } : {}),
      goal: goal.trim() || null,
      focus,
      targetSprintId: targetSprintId || null,
      environment: environment.trim() || null,
      ...(leadId !== "" ? { leadId } : {}),
      ...(startsOn !== "" ? { startsOn } : {}),
      ...(endsOn !== "" ? { endsOn } : {}),
    };

    try {
      const saved = testSprint
        ? await testSprintsApi.update(testSprint.id, input)
        : await testSprintsApi.create(project.slug, { ...input, includeTargetCases: includeCases });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The test sprint was not saved.");
      if (e instanceof ApiError && e.errors) setFieldErrors(e.errors);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={testSprint ? `Edit ${testSprint.name}` : "Plan a test sprint"}
      subtitle={testSprint ? testSprint.statusLabel : "Runs beside the delivery sprints"}
      icon={FlaskConical}
      hue="grape"
      width="lg"
      onClose={onClose}
      onSubmit={submit}
      bodyClassName="space-y-5 px-6 py-5"
      footer={
        <>
          <Button className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : testSprint ? "Save" : "Plan test sprint"}
          </Button>
        </>
      }
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      <fieldset>
        <legend className={labelCls}>What it is for</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FOCI.map((f) => (
            <label
              key={f}
              className={
                "flex min-h-11 cursor-pointer flex-col rounded-xl border px-3.5 py-2.5 transition focus-within:ring-2 focus-within:ring-primary-300 " +
                (focus === f ? "border-primary-300 bg-primary-50" : "border-neutral-200 hover:bg-neutral-50")
              }
            >
              <input type="radio" name="ts-focus" value={f} checked={focus === f} onChange={() => setFocus(f)} className="sr-only" />
              <span className="text-sm font-semibold text-neutral-900">{FOCUS_META[f].label}</span>
              <span className="text-xs text-neutral-500">{FOCUS_META[f].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ts-target" className={labelCls}>
            Testing
          </label>
          <SearchableSelect
            id="ts-target"
            value={targetSprintId}
            onChange={setTargetSprintId}
            options={[
              { value: "", label: "No particular sprint" },
              ...sprints.map((s) => ({ value: s.id, label: s.name, hint: s.statusLabel })),
            ]}
          />
          <FieldError message={fieldErrors.targetSprintId?.[0]} />
        </div>
        <div>
          <label htmlFor="ts-name" className={labelCls}>
            Name
          </label>
          <input
            id="ts-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Numbered for you if left empty"
            className={inputCls}
          />
        </div>
      </div>

      {!testSprint && targetSprintId !== "" && (
        <CheckRow
          checked={includeCases}
          onChange={setIncludeCases}
          title="Bring in that sprint's test cases"
          hint="Every case in the library that proves one of its stories or tasks. You can add or remove cases afterwards."
        />
      )}

      <div>
        <label htmlFor="ts-goal" className={labelCls}>
          Goal
        </label>
        <RichTextEditor id="ts-goal" minHeight={64} value={goal} onChange={setGoal} placeholder="Sign off Sprint 4 for the client demo" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ts-env" className={labelCls}>
            Environment
          </label>
          <input
            id="ts-env"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            maxLength={160}
            placeholder="Staging, build 1.4.2"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="ts-lead" className={labelCls}>
            Led by
          </label>
          <SearchableSelect
            id="ts-lead"
            value={leadId}
            onChange={setLeadId}
            options={[
              { value: "", label: testSprint ? "Nobody" : "You" },
              ...(setup?.assignees ?? []).map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
          <FieldError message={fieldErrors.leadId?.[0]} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ts-start" className={labelCls}>
            Starts
          </label>
          <input id="ts-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ts-end" className={labelCls}>
            Ends
          </label>
          <input
            id="ts-end"
            type="date"
            value={endsOn}
            min={startsOn || undefined}
            onChange={(e) => setEndsOn(e.target.value)}
            className={inputCls}
          />
          <FieldError message={fieldErrors.endsOn?.[0]} />
        </div>
      </div>
      {!testSprint && <p className={hintCls}>Left empty, it runs for a week from today.</p>}
    </Modal>
  );
}
