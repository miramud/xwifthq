"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Trash2 } from "lucide-react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import {
  ApiError,
  testCases as casesApi,
  workItems as itemsApi,
  type Project,
  type TestCase,
  type TestCaseCategory,
  type TestLevel,
} from "@/lib/api/projects-client";
import { Drawer, FieldError, Notice, hintCls, inputCls, labelCls, textareaCls } from "../ui/pkit";
import { CASE_CATEGORY_LABEL } from "./testingUi";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { linesToRichList, richToLines } from "@/lib/richText";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * One test case: read it, edit it, or write a new one by hand.
 *
 * Read-only for anybody who does not manage testing - a developer fixing a
 * finding opens the case that found it to see the steps.
 */
export default function CaseDrawer({
  project,
  testCase,
  canManage,
  onClose,
  onSaved,
}: {
  project: Project;
  /** Null to write a new one. */
  testCase: TestCase | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const confirm = useConfirm();
  const [title, setTitle] = useState(testCase?.title ?? "");
  const [level, setLevel] = useState<TestLevel>(testCase?.level ?? "ui");
  const [category, setCategory] = useState<TestCaseCategory>(testCase?.category ?? "functional");
  const [priority, setPriority] = useState(String(testCase?.priority ?? 2));
  const [workItemId, setWorkItemId] = useState(testCase?.workItemId ?? "");
  const [criterion, setCriterion] = useState(testCase?.acceptanceCriterion ?? "");
  const [preconditions, setPreconditions] = useState(testCase?.preconditions ?? "");
  const [steps, setSteps] = useState(linesToRichList(testCase?.steps ?? []));
  const [testData, setTestData] = useState(testCase?.testData ?? "");
  const [expected, setExpected] = useState(testCase?.expectedResult ?? "");
  const [apiMethod, setApiMethod] = useState(testCase?.apiMethod ?? "");
  const [apiPath, setApiPath] = useState(testCase?.apiPath ?? "");
  const [expectedStatus, setExpectedStatus] = useState(testCase?.expectedStatus?.toString() ?? "");
  const [items, setItems] = useState<{ value: string; label: string; hint?: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const readOnly = !canManage;

  useEffect(() => {
    let live = true;
    void itemsApi
      .list(project.slug, { perPage: 250 })
      .then((res) => {
        if (!live) return;
        setItems(
          res.data
            .filter((i) => i.type === "story" || i.type === "task" || i.type === "spike")
            .map((i) => ({
              value: i.id,
              label: `${i.externalRef ? `${i.externalRef}: ` : ""}${i.title}`,
              hint: i.typeLabel,
            })),
        );
      })
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [project.slug]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly || saving || title.trim() === "" || expected.trim() === "") return;

    setSaving(true);
    setError(null);
    setFieldErrors({});

    const api = level === "api";
    const input = {
      title: title.trim(),
      level,
      category,
      priority: Number(priority),
      workItemId: workItemId === "" ? null : workItemId,
      acceptanceCriterion: criterion.trim() || null,
      preconditions: preconditions.trim() || null,
      steps: richToLines(steps),
      testData: testData.trim() || null,
      expectedResult: expected.trim(),
      apiMethod: api && apiMethod !== "" ? apiMethod : null,
      apiPath: api && apiPath.trim() !== "" ? apiPath.trim() : null,
      expectedStatus: api && expectedStatus.trim() !== "" ? Number(expectedStatus) : null,
    };

    try {
      if (testCase) await casesApi.update(testCase.id, input);
      else await casesApi.create(project.slug, input);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That case did not save.");
      if (e instanceof ApiError && e.errors) setFieldErrors(e.errors);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!testCase) return;
    const ok = await confirm({
      title: `Delete ${testCase.reference}?`,
      body: "It leaves the library and moves to the organisation's recycle bin. Its results in past test sprints stay.",
      confirmLabel: "Delete case",
      recoverable: true,
      tone: "danger",
    });
    if (!ok) return;
    try {
      await casesApi.remove(testCase.id);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That case was not deleted.");
    }
  };

  return (
    <Drawer
      title={testCase ? `${testCase.reference} · ${testCase.title}` : "New test case"}
      subtitle={testCase ? (testCase.source === "ai" ? "Drafted with AI, reviewed by the team" : "Written by hand") : "Add it to the library"}
      icon={ClipboardCheck}
      hue="grape"
      width="lg"
      onClose={onClose}
      onSubmit={submit}
      bodyClassName="space-y-5 px-6 py-5"
      footer={
        readOnly ? (
          <Button className="ml-auto" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            {testCase && (
              <Button variant="danger" icon={Trash2} onClick={() => void remove()}>
                Delete
              </Button>
            )}
            <Button className="ml-auto" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || title.trim() === "" || expected.trim() === ""}>
              {saving ? "Saving…" : testCase ? "Save case" : "Add case"}
            </Button>
          </>
        )
      }
    >
      {readOnly && <Notice tone="info">You can read this case. The project&rsquo;s QA and security analysts keep the library.</Notice>}
      {error !== null && <Notice tone="error">{error}</Notice>}

      <fieldset disabled={readOnly} className="space-y-5">
        <div>
          <label htmlFor="tc-title" className={labelCls}>
            What it checks
          </label>
          <input
            id="tc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={240}
            placeholder="Reject a leave request whose end date is before its start date"
            className={inputCls}
          />
          <FieldError message={fieldErrors.title?.[0]} />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <span className={labelCls} id="tc-level-label">
              Level
            </span>
            <Segmented<TestLevel>
              label="Level"
              value={level}
              onChange={setLevel}
              options={[
                { key: "ui", label: "UI" },
                { key: "api", label: "API" },
              ]}
            />
          </div>
          <div>
            <label htmlFor="tc-category" className={labelCls}>
              Kind
            </label>
            <SearchableSelect
              id="tc-category"
              value={category}
              onChange={(v) => setCategory(v as TestCaseCategory)}
              options={Object.entries(CASE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <label htmlFor="tc-priority" className={labelCls}>
              Priority
            </label>
            <SearchableSelect
              id="tc-priority"
              value={priority}
              onChange={setPriority}
              options={[
                { value: "1", label: "High" },
                { value: "2", label: "Medium" },
                { value: "3", label: "Low" },
              ]}
            />
          </div>
        </div>

        <div>
          <label htmlFor="tc-item" className={labelCls}>
            Proves
          </label>
          <SearchableSelect
            id="tc-item"
            value={workItemId}
            onChange={setWorkItemId}
            searchPlaceholder="Search stories and tasks"
            noOptionsText="Loading the project's work…"
            options={[
              { value: "", label: "No particular story" },
              /* The case's own story, so it is named before the list arrives. */
              ...(testCase?.workItem && !(items ?? []).some((i) => i.value === testCase.workItem!.id)
                ? [{ value: testCase.workItem.id, label: testCase.workItem.title }]
                : []),
              ...(items ?? []),
            ]}
          />
        </div>

        <div>
          <label htmlFor="tc-criterion" className={labelCls}>
            Acceptance criterion
          </label>
          <input
            id="tc-criterion"
            value={criterion}
            onChange={(e) => setCriterion(e.target.value)}
            maxLength={2000}
            placeholder="An end date before the start date is refused"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="tc-pre" className={labelCls}>
            Before you start
          </label>
          <RichTextEditor
            id="tc-pre"
            minHeight={64}
            value={preconditions}
            onChange={setPreconditions}
            placeholder="Signed in as an employee with leave left"
            disabled={readOnly}
          />
        </div>

        <div>
          <label htmlFor="tc-steps" className={labelCls}>
            Steps
          </label>
          <RichTextEditor
            id="tc-steps"
            minHeight={120}
            value={steps}
            onChange={setSteps}
            placeholder="One action per item of a numbered list"
            describedBy="tc-steps-hint"
            disabled={readOnly}
          />
          <p id="tc-steps-hint" className={hintCls}>
            One action per list item; they are numbered when the case is run. Steps are kept as plain words.
          </p>
        </div>

        {level === "api" && (
          <div className="grid gap-5 rounded-2xl border border-grape-100 bg-grape-50/40 p-4 sm:grid-cols-[8rem_1fr_7rem]">
            <div>
              <label htmlFor="tc-method" className={labelCls}>
                Method
              </label>
              <SearchableSelect
                id="tc-method"
                value={apiMethod}
                onChange={setApiMethod}
                options={[{ value: "", label: "-" }, ...METHODS.map((m) => ({ value: m, label: m }))]}
              />
            </div>
            <div>
              <label htmlFor="tc-path" className={labelCls}>
                Endpoint
              </label>
              <input
                id="tc-path"
                value={apiPath}
                onChange={(e) => setApiPath(e.target.value)}
                placeholder="/api/leave-requests"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="tc-status" className={labelCls}>
                Status
              </label>
              <input
                id="tc-status"
                inputMode="numeric"
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="422"
                className={inputCls}
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="tc-data" className={labelCls}>
            Test data
          </label>
          <textarea
            id="tc-data"
            rows={2}
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
            placeholder={level === "api" ? '{"start": "2026-10-08", "end": "2026-10-06"}' : "The values to enter"}
            className={textareaCls}
          />
        </div>

        <div>
          <label htmlFor="tc-expected" className={labelCls}>
            Expected result
          </label>
          <RichTextEditor
            id="tc-expected"
            minHeight={80}
            value={expected}
            onChange={setExpected}
            invalid={Boolean(fieldErrors.expectedResult?.[0])}
            placeholder="What a correct system shows, returns and stores"
            disabled={readOnly}
          />
          <FieldError message={fieldErrors.expectedResult?.[0]} />
        </div>
      </fieldset>
    </Drawer>
  );
}
