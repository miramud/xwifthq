"use client";

import { useState } from "react";
import { Briefcase, Building2, FolderKanban, Wrench, type LucideIcon } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  projects as projectsApi,
  type ExternalCompany,
  type Portfolio,
  type ProjectType,
} from "@/lib/api/projects-client";
import { Modal, Notice, hintCls, inputCls, labelCls } from "./ui/pkit";

/**
 * Starting a project.
 *
 * Only a **name** is required. Everything else, dates, currency, the shelf it
 * goes on, is a decision that can be made later and often is not known on the
 * day somebody creates the project. A form that insists on a target date on
 * day one gets a made-up target date, which then drives every overdue figure
 * in the module.
 *
 * The creator becomes its project manager; the API does that in the same
 * transaction, so there is no state where a project exists and nobody can
 * staff it.
 */

const TYPES: { key: ProjectType; label: string; hint: string; icon: LucideIcon; hue: Hue }[] = [
  {
    key: "client",
    label: "Client",
    /*
      Said here rather than discovered later: an internal project has a cost
      and no price, so no billable figure is shown for one. The cost report
      gives cost and billable cost; it has never computed a margin, so this
      does not promise one.
    */
    hint: "Billable. Cost and billable cost are reported.",
    icon: Briefcase,
    hue: "blue",
  },
  {
    key: "internal",
    label: "Internal",
    hint: "Not billable. Cost is reported; nothing is billed.",
    icon: Wrench,
    hue: "grape",
  },
];

export default function NewProjectDialog({
  portfolios,
  companies,
  onClose,
  onCreated,
}: {
  portfolios: Portfolio[];
  companies: ExternalCompany[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("client");
  const [portfolioId, setPortfolioId] = useState("");
  const [externalCompanyId, setExternalCompanyId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [targetEndsOn, setTargetEndsOn] = useState("");
  const [currency, setCurrency] = useState("NGN");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      await projectsApi.create({
        name: name.trim(),
        type,
        currency,
        portfolioId: portfolioId === "" ? null : portfolioId,
        /*
          Cleared when the type is internal, so switching to internal after
          picking a client does not quietly file the project under one.
        */
        externalCompanyId: type === "client" && externalCompanyId !== "" ? externalCompanyId : null,
        startsOn: startsOn === "" ? null : startsOn,
        targetEndsOn: targetEndsOn === "" ? null : targetEndsOn,
      });

      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New project"
      subtitle="You will be its project manager. Everything but the name can wait."
      icon={FolderKanban}
      titleId="new-project-title"
      onClose={onClose}
      onSubmit={submit}
      width="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || name.trim() === ""}>
            {saving ? "Creating…" : "Create project"}
          </Button>
        </>
      }
    >
      {error !== null && <Notice className="mb-4">{error}</Notice>}

      <div className="space-y-5">
        <div>
          <label htmlFor="np-name" className={labelCls}>
            Name
          </label>
          <input
            id="np-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={160}
            autoFocus
            placeholder="e.g. Customer portal rebuild"
            className={inputCls}
          />
        </div>

        <fieldset>
          <legend className={labelCls}>Type</legend>
          <div role="radiogroup" aria-label="Type" className="grid gap-3 sm:grid-cols-2">
            {TYPES.map((t) => {
              const on = type === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setType(t.key)}
                  className={cx(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                    on ? "border-primary-300 bg-primary-50/60 ring-1 ring-primary-200" : "border-neutral-200 hover:bg-neutral-50",
                  )}
                >
                  <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[t.hue].soft)}>
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-neutral-900">{t.label}</span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/*
          Who it is for. Offered only on a client project - an internal one
          has nobody on the other side, and a company set on it would make a
          stakeholder map that cannot be truthful.
        */}
        {type === "client" && (
          <div>
            <label htmlFor="np-company" className={labelCls}>
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} className="text-neutral-400" aria-hidden />
                External company
              </span>
            </label>
            <SearchableSelect
              id="np-company"
              value={externalCompanyId}
              onChange={setExternalCompanyId}
              searchPlaceholder="Search companies"
              options={[
                { value: "", label: "Not set yet" },
                ...companies.map((c) => ({ value: c.id, label: c.name, hint: c.isActive ? undefined : "Former client" })),
              ]}
            />
            <p className={hintCls}>
              {companies.length === 0
                ? "None recorded yet. Add one under External companies, then set it here."
                : "Unlocks the stakeholder map: who signs off, and who to ring."}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="np-currency" className={labelCls}>
              Currency
            </label>
            <SearchableSelect
              id="np-currency"
              value={currency}
              onChange={setCurrency}
              searchPlaceholder="Search currencies"
              options={[
                { value: "NGN", label: "₦ Naira" },
                { value: "USD", label: "$ US dollar" },
              ]}
            />
            <p className={hintCls}>Rates and every figure on this project are in it.</p>
          </div>

          {portfolios.length > 0 && (
            <div>
              <label htmlFor="np-shelf" className={labelCls}>
                Folder
              </label>
              <SearchableSelect
                id="np-shelf"
                value={portfolioId}
                onChange={setPortfolioId}
                searchPlaceholder="Search folders"
                options={[{ value: "", label: "None" }, ...portfolios.map((p) => ({ value: p.id, label: p.name }))]}
              />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="np-start" className={labelCls}>
              Starts
            </label>
            <input
              id="np-start"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="np-target" className={labelCls}>
              Target end
            </label>
            <input
              id="np-target"
              type="date"
              value={targetEndsOn}
              min={startsOn || undefined}
              onChange={(e) => setTargetEndsOn(e.target.value)}
              className={inputCls}
            />
            {/*
              A promise, not a forecast. The forecast comes from observed
              velocity once there are sprints to observe.
            */}
            <p className={hintCls}>What was promised. Leave it empty if nothing was.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
