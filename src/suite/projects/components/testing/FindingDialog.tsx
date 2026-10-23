"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  findings as findingsApi,
  testRuns as runsApi,
  type FindingCategory,
  type FindingSeverity,
  type Project,
  type TestRun,
  type TestSprint,
  type WorkItem,
} from "@/lib/api/projects-client";
import { FieldError, Modal, Notice, hintCls, inputCls, labelCls } from "../ui/pkit";
import { FINDING_CATEGORY_LABEL, SEVERITY_META, SEVERITY_ORDER } from "./testingUi";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Report a finding: from a failed run, or on its own (exploratory testing,
 * a security review).
 *
 * The finding lands in the test backlog unscheduled. Assigning it, dating
 * it, weighting it and putting it in a sprint happen there, through the
 * ordinary item panel - the same as any other work.
 */
export default function FindingDialog({
  project,
  run,
  testSprint,
  onClose,
  onRaised,
}: {
  project: Project;
  /** Raise from this run: it is marked failed and linked. */
  run?: TestRun | null;
  /** The test sprint a standalone finding belongs to, if any. */
  testSprint?: TestSprint | null;
  onClose: () => void;
  onRaised: (finding: WorkItem) => void;
}) {
  /* A security sprint, or a failed security case, raises a security finding. */
  const security = testSprint?.focus === "security" || run?.testCase?.category === "security";
  const [title, setTitle] = useState(run?.testCase?.title ?? "");
  const [severity, setSeverity] = useState<FindingSeverity>(security ? "high" : "medium");
  const [category, setCategory] = useState<FindingCategory>(security ? "security" : "functional");
  const [description, setDescription] = useState(run?.actualResult ?? "");
  const [steps, setSteps] = useState(run?.testCase?.steps.join("\n") ?? "");
  const [expected, setExpected] = useState(run?.testCase?.expectedResult ?? "");
  const [recommendation, setRecommendation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || title.trim() === "") return;

    setSaving(true);
    setError(null);
    setFieldErrors({});

    const input = {
      title: title.trim(),
      severity,
      findingCategory: category,
      description: description.trim() || null,
      stepsToReproduce: steps.trim() || null,
      expectedOutcome: expected.trim() || null,
      recommendation: recommendation.trim() || null,
    };

    try {
      const finding = run
        ? await runsApi.raiseFinding(run.id, input)
        : await findingsApi.create(project.slug, { ...input, testSprintId: testSprint?.id ?? null });
      onRaised(finding);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That finding was not saved.");
      if (e instanceof ApiError && e.errors) setFieldErrors(e.errors as Record<string, string[]>);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={run ? `Raise a finding from ${run.testCase?.reference ?? "this run"}` : "Report a finding"}
      subtitle={testSprint ? testSprint.name : "Goes to the test backlog, unscheduled"}
      icon={ShieldAlert}
      hue="rose"
      width="lg"
      onClose={onClose}
      onSubmit={submit}
      bodyClassName="space-y-5 px-6 py-5"
      footer={
        <>
          <Button className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || title.trim() === ""}>
            {saving ? "Raising…" : "Raise finding"}
          </Button>
        </>
      }
    >
      {run && run.status !== "failed" && (
        <Notice tone="info">The run is marked failed when the finding is raised.</Notice>
      )}
      {error !== null && <Notice tone="error">{error}</Notice>}

      <div>
        <label htmlFor="fd-title" className={labelCls}>
          What is wrong
        </label>
        <input
          id="fd-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={240}
          placeholder="Leave requests of another organisation are readable by id"
          className={inputCls}
          aria-invalid={fieldErrors.title ? true : undefined}
        />
        <FieldError message={fieldErrors.title?.[0]} />
      </div>

      <fieldset>
        <legend className={labelCls}>Severity</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SEVERITY_ORDER.map((s) => {
            const meta = SEVERITY_META[s];
            const on = s === severity;
            return (
              <label
                key={s}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-[13px] font-semibold transition focus-within:ring-2 focus-within:ring-primary-300",
                  on ? cx(HUE[meta.hue].soft, "border-transparent ring-2 ring-inset ring-neutral-900/10") : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                )}
                title={meta.hint}
              >
                <input
                  type="radio"
                  name="fd-severity"
                  value={s}
                  checked={on}
                  onChange={() => setSeverity(s)}
                  className="sr-only"
                />
                {meta.label}
              </label>
            );
          })}
        </div>
        <p className={hintCls}>{SEVERITY_META[severity].hint}</p>
      </fieldset>

      <div>
        <label htmlFor="fd-category" className={labelCls}>
          Kind of finding
        </label>
        <SearchableSelect
          id="fd-category"
          value={category}
          onChange={(v) => setCategory(v as FindingCategory)}
          options={Object.entries(FINDING_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fd-actual" className={labelCls}>
            What happened
          </label>
          <RichTextEditor
            id="fd-actual"
            minHeight={110}
            value={description}
            onChange={setDescription}
            placeholder="The response, the error, the screen"
          />
        </div>
        <div>
          <label htmlFor="fd-expected" className={labelCls}>
            What should happen
          </label>
          <RichTextEditor id="fd-expected" minHeight={110} value={expected} onChange={setExpected} />
        </div>
      </div>

      <div>
        <label htmlFor="fd-steps" className={labelCls}>
          Steps to reproduce
        </label>
        <RichTextEditor id="fd-steps" minHeight={110} value={steps} onChange={setSteps} placeholder="A numbered list, one step each" />
      </div>

      <div>
        <label htmlFor="fd-recommendation" className={labelCls}>
          Recommended remediation
        </label>
        <RichTextEditor
          id="fd-recommendation"
          value={recommendation}
          onChange={setRecommendation}
          placeholder={security ? "Scope the lookup to the caller's organisation and return 404" : "What the fix should do"}
        />
        <p className={hintCls}>The developer fixes against it, and the retest checks it.</p>
      </div>
    </Modal>
  );
}
