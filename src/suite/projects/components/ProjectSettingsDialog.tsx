"use client";

import { useState } from "react";
import { Lock, Settings, Trash2 } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE } from "@/components/workspace/modules";
import {
  ApiError,
  projects as projectsApi,
  type ExternalCompany,
  type Portfolio,
  type Project,
  type ProjectLifecycle,
  type ProjectType,
} from "@/lib/api/projects-client";
import {
  LIFECYCLE_HUE as STATUS_HUE,
  Modal,
  Notice,
  hintCls,
  inputCls,
  labelCls,
} from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

const STATUSES: { value: ProjectLifecycle; label: string; hint: string }[] = [
  { value: "planning", label: "Planning", hint: "Being scoped. Not started." },
  { value: "active", label: "Active", hint: "Work is happening." },
  {
    value: "on_hold",
    label: "On hold",
    hint: "Stopped, and expected to resume. Not the same as cancelled.",
  },
  { value: "complete", label: "Complete", hint: "Delivered. Stamps the end date." },
  {
    value: "cancelled",
    label: "Cancelled",
    hint: "Stopped for good. Hours already spent still count towards cost.",
  },
];

const TYPES: { value: ProjectType; label: string }[] = [
  { value: "client", label: "Client · billable" },
  { value: "internal", label: "Internal · not billable" },
];

const CURRENCIES = [
  { value: "NGN", label: "₦ Naira" },
  { value: "USD", label: "$ US dollar" },
];

/**
 * `hrm-delivery`, `#HRM-Delivery` and `#hrm-delivery` are the same channel to
 * a person, and only the last is what the API (and Slack) take. A channel id
 * (C0123ABCD, for a private channel) is passed through untouched.
 */
export function normaliseSlackChannel(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  if (/^[CG][A-Z0-9]{6,20}$/.test(value)) return value;
  return `#${value.replace(/^#+/, "").toLowerCase()}`;
}

/**
 * Changing the project itself.
 *
 * This screen exists because `can.update` and `can.delete` were computed on
 * every response and consumed by nothing, which meant a project could be
 * created and then never renamed, re-dated, put on hold or completed. Five
 * lifecycle states existed and the product could only ever show the first.
 *
 * **On hold is not cancelled**, and the two are kept apart here as they are in
 * the enum: one says the work stopped, the other says something went wrong,
 * and a single "inactive" would say something untrue about half the projects
 * it covered.
 *
 * Deleting is the delivery lead's alone, is soft, and asks twice, a project
 * is the root of its sprints, work items, time logs and cost.
 */
export default function ProjectSettingsDialog({
  project,
  portfolios,
  companies,
  onClose,
  onSaved,
  onDeleted,
}: {
  project: Project;
  portfolios: Portfolio[];
  companies: ExternalCompany[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [code, setCode] = useState(project.code ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectLifecycle>(project.status);
  const [startsOn, setStartsOn] = useState(project.startsOn ?? "");
  const [targetEndsOn, setTargetEndsOn] = useState(project.targetEndsOn ?? "");
  const [portfolioId, setPortfolioId] = useState(project.portfolio?.id ?? "");
  const [externalCompanyId, setExternalCompanyId] = useState(project.externalCompanyId ?? "");
  /*
    Type and currency (P16): editable until time or a project rate is
    recorded, then fixed - the server says why in `typeAndCurrencyLock`, and
    the same reason is shown here instead of the pickers.
  */
  const [type, setType] = useState<ProjectType>(project.type);
  const [currency, setCurrency] = useState(project.currency);
  const lock = project.typeAndCurrencyLock ?? null;

  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);

  const chosen = STATUSES.find((s) => s.value === status);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving || name.trim() === "") return;

    setSaving(true);
    setError(null);

    try {
      await projectsApi.update(project.slug, {
        name: name.trim(),
        code: code.trim() === "" ? null : code.trim(),
        description: description.trim() === "" ? null : description.trim(),
        status,
        startsOn: startsOn === "" ? null : startsOn,
        targetEndsOn: targetEndsOn === "" ? null : targetEndsOn,
        portfolioId: portfolioId === "" ? null : portfolioId,
        /* Only sent while they may change; a locked project keeps its own. */
        ...(lock === null ? { type, currency } : {}),
        /*
          An internal project takes no company, because a stakeholder map
          hanging off work nobody outside is party to cannot be truthful.
        */
        externalCompanyId: type === "client" && externalCompanyId !== "" ? externalCompanyId : null,
      });

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${project.name}?`,
      body: "Its sprints, work, time and cost go with it, and the team loses access. It moves to the organisation's recycle bin, where an admin can restore it. Cancelling the project is usually the better answer.",
      confirmLabel: "Remove project",
      recoverable: true,
    });
    if (!ok) return;

    setSaving(true);
    setError(null);

    try {
      await projectsApi.remove(project.slug);
      onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That could not be removed.");
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Project settings"
      titleId="ps-title"
      subtitle={project.name}
      icon={Settings}
      width="lg"
      onClose={onClose}
      onSubmit={submit}
      bodyClassName="space-y-5 px-6 py-5"
      footer={
        <>
          <Button className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || name.trim() === ""}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      <div>
        <label htmlFor="ps-name" className={labelCls}>
          Name
        </label>
        <input
          id="ps-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={160}
          className={inputCls}
        />
        {/*
          The slug is fixed at creation and is what a board is linked by.
          Renaming must not silently break a link in a client email.
        */}
        <p className={hintCls}>
          The link stays <span className="font-mono text-neutral-700">{project.slug}</span>.
          Renaming does not move the board.
        </p>
      </div>

      <fieldset>
        <legend className={labelCls}>Status</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STATUSES.map((s) => {
            const on = status === s.value;

            return (
              <label
                key={s.value}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 text-center text-[13px] font-semibold transition focus-within:ring-2 focus-within:ring-primary-200",
                  on
                    ? cx("border-transparent", HUE[STATUS_HUE[s.value]].soft)
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                )}
              >
                <input
                  type="radio"
                  name="ps-status"
                  value={s.value}
                  checked={on}
                  onChange={() => setStatus(s.value)}
                  aria-describedby="ps-status-hint"
                  className="sr-only"
                />
                <span className={cx("h-2 w-2 shrink-0 rounded-full", HUE[STATUS_HUE[s.value]].dot)} aria-hidden />
                {s.label}
              </label>
            );
          })}
        </div>
        <p id="ps-status-hint" className={hintCls}>
          {chosen?.hint}
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="ps-code" className={labelCls}>
            Code
          </label>
          <input
            id="ps-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={24}
            placeholder="Optional"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="ps-start" className={labelCls}>
            Starts
          </label>
          <input
            id="ps-start"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="ps-target" className={labelCls}>
            Target end
          </label>
          <input
            id="ps-target"
            type="date"
            value={targetEndsOn}
            min={startsOn || undefined}
            onChange={(e) => setTargetEndsOn(e.target.value)}
            aria-describedby="ps-target-hint"
            className={inputCls}
          />
          <p id="ps-target-hint" className={hintCls}>
            What was promised, not a forecast.
          </p>
        </div>
      </div>

      {lock === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ps-type" className={labelCls}>
              Type
            </label>
            <SearchableSelect id="ps-type" value={type} onChange={(v) => setType(v as ProjectType)} options={TYPES} />
          </div>
          <div>
            <label htmlFor="ps-currency" className={labelCls}>
              Currency
            </label>
            <SearchableSelect
              id="ps-currency"
              value={currency}
              onChange={setCurrency}
              searchPlaceholder="Search currencies"
              options={CURRENCIES}
            />
          </div>
          <p className={cx(hintCls, "sm:col-span-2")}>
            Both can change until time is logged or the project is given its own rates. After that they are fixed.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <Lock size={16} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-neutral-800">
              {TYPES.find((t) => t.value === project.type)?.label ?? project.typeLabel} ·{" "}
              {CURRENCIES.find((c) => c.value === project.currency)?.label ?? project.currency}
            </p>
            <p className="mt-0.5 text-xs text-neutral-600">{lock}</p>
          </div>
        </div>
      )}

      {/*
        Who it is for. Offered only on a client project - an internal one
        has nobody on the other side, and a company set on it would make a
        stakeholder map that cannot be truthful.
      */}
      {type === "client" && (
        <div>
          <label htmlFor="ps-company" className={labelCls}>
            External company
          </label>
          <SearchableSelect
            id="ps-company"
            value={externalCompanyId}
            onChange={setExternalCompanyId}
            aria-describedby="ps-company-hint"
            searchPlaceholder="Search companies"
            options={[
              { value: "", label: "Not set yet" },
              ...companies.map((c) => ({ value: c.id, label: c.name, hint: c.isActive ? undefined : "Former client" })),
            ]}
          />
          <p id="ps-company-hint" className={hintCls}>
            {companies.length === 0
              ? "None recorded yet. Add one under External companies, then set it here."
              : "Unlocks the stakeholder map: who signs off, and who to ring."}
          </p>
        </div>
      )}

      {portfolios.length > 0 && (
        <div>
          <label htmlFor="ps-folder" className={labelCls}>
            Folder
          </label>
          <SearchableSelect
            id="ps-folder"
            value={portfolioId}
            onChange={setPortfolioId}
            searchPlaceholder="Search folders"
            options={[{ value: "", label: "None" }, ...portfolios.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
      )}

      {/*
        The project's Slack channel and WhatsApp group moved to their own
        Notifications tab, alongside which events are posted - one place to
        answer "where do this project's updates go".
      */}
      <p className={hintCls}>
        Slack and WhatsApp updates for this project are set on its Notifications tab.
      </p>

      <div>
        <label htmlFor="ps-desc" className={labelCls}>
          Description
        </label>
        <RichTextEditor
          id="ps-desc"
          variant="full"
          minHeight={160}
          value={description}
          onChange={setDescription}
          placeholder="What the project delivers, for whom, and why"
        />
      </div>

      {project.can.delete && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-error-200 bg-error-50/50 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-error-700">Remove this project</p>
            <p className="mt-0.5 text-xs text-neutral-600">
              Its sprints, work, time and cost go with it. Cancelling is usually the better answer.
            </p>
          </div>
          <Button size="sm" icon={Trash2} disabled={saving} onClick={() => void remove()} className="!text-error-700">
            Remove project
          </Button>
        </div>
      )}
    </Modal>
  );
}
