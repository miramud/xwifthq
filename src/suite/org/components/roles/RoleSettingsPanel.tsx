"use client";

import { useMemo } from "react";
import { Clock3, Lock, Settings2 } from "lucide-react";
import { Panel, cx } from "@/components/workspace/kit";
import type { Catalogue, ProjectActivity, RoleSettings } from "@/lib/api/roles-client";
import { Switch } from "@/suite/lms/components/ui/ws";
import { confidentialCatalogue, notLiveLine } from "./permission-model";
import { SegmentedRadio } from "./SegmentedRadio";

const ACTIVITY: { key: ProjectActivity; label: string }[] = [
  { key: "none", label: "None" },
  { key: "digest", label: "Weekly digest" },
  { key: "everything", label: "Everything" },
];

/** The id of a module's Confidential access checkbox, for "Needs Confidential access for HR". */
export const confidentialCheckboxId = (moduleKey: string) => `confidential-access-${moduleKey}`;

/**
 * What a role does besides grant permissions: Organisation admin,
 * Confidential access per module, and joining every project. Built-in roles
 * have no settings, and say so in one line.
 */
export function RoleSettingsPanel({
  catalogue,
  settings,
  readOnly,
  onChange,
  onConfidentialChange,
  settingsError,
  roleIdsError,
}: {
  catalogue: Catalogue;
  /** Null for built-in roles. */
  settings: RoleSettings | null;
  readOnly: boolean;
  onChange: (patch: Partial<RoleSettings>) => void;
  /** Turning a module's Confidential access off may ask first, so the editor owns it. */
  onConfidentialChange: (moduleKey: string, on: boolean) => void;
  settingsError?: string | null;
  roleIdsError?: string | null;
}) {
  const confidential = useMemo(() => confidentialCatalogue(catalogue), [catalogue]);
  const projects = catalogue.modules.find((m) => m.key === "projects");

  if (settings === null) {
    return (
      <Panel title="Role settings" icon={Settings2} hue="mint">
        <p className="text-sm text-neutral-500">
          Built-in roles have no settings. Duplicate this role to give a copy Organisation admin, Confidential access or a
          seat on every project.
        </p>
      </Panel>
    );
  }

  const off = readOnly;

  return (
    <Panel title="Role settings" subtitle="What holders get besides their permissions." icon={Settings2} hue="mint">
      {settingsError && (
        <p role="alert" className="mb-4 rounded-xl border border-error-500/20 bg-error-500/5 px-3 py-2 text-xs font-medium text-error-700">
          {settingsError}
        </p>
      )}

      {/*
        Stacked in the side column; two columns when the panel spans the page
        (below 2xl), with Confidential access on the right.
      */}
      <div className="@container">
        <div
          className={cx(
            "grid [grid-template-areas:'admin'_'conf'_'proj']",
            "@min-[44rem]:grid-cols-2 @min-[44rem]:grid-rows-[auto_1fr] @min-[44rem]:gap-x-8",
            "@min-[44rem]:[grid-template-areas:'admin_conf'_'proj_conf']",
          )}
        >
          {/* 1. Organisation admin */}
          <div className="pb-4 [grid-area:admin]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p id="setting-org-admin" className="text-sm font-semibold text-neutral-900">
                  Organisation admin
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                  Holders count as organisation admins: they may give roles Confidential access and this setting, and the
                  organisation always keeps at least one. What they can open still comes from the permissions.
                </p>
              </div>
              <Switch
                checked={settings.organisationAdmin}
                onChange={(v) => onChange({ organisationAdmin: v })}
                label="Organisation admin"
                disabled={off}
              />
            </div>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-neutral-500">
              <Lock size={11} aria-hidden />
              Only an organisation admin can turn this on.
            </p>
            {roleIdsError && (
              <p role="alert" className="mt-2 text-xs font-medium text-error-700">
                {roleIdsError}
              </p>
            )}
          </div>

          {/* 2. Confidential access */}
          {confidential.length > 0 && (
            <div
              role="group"
              aria-labelledby="setting-confidential"
              className="border-t border-neutral-100 py-4 [grid-area:conf] @min-[44rem]:border-l @min-[44rem]:border-t-0 @min-[44rem]:py-0 @min-[44rem]:pl-8"
            >
              <p id="setting-confidential" className="text-sm font-semibold text-neutral-900">
                Confidential access
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                Pay, discipline, personal records and bank details. Without it, a module&apos;s confidential features stay
                locked in Permissions.
              </p>
              <ul className="mt-3 space-y-1">
                {confidential.map((m) => {
                  const on = settings.confidentialModules.includes(m.key);
                  const id = confidentialCheckboxId(m.key);
                  return (
                    <li key={m.key}>
                      <label
                        htmlFor={id}
                        className={cx(
                          "flex min-h-11 items-start gap-3 rounded-xl px-2.5 py-2 transition-colors",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-300",
                          on ? "bg-primary-50/60" : "",
                          off ? "cursor-default" : "cursor-pointer hover:bg-neutral-50",
                        )}
                      >
                        <input
                          id={id}
                          type="checkbox"
                          checked={on}
                          disabled={off}
                          onChange={(e) => onConfidentialChange(m.key, e.target.checked)}
                          aria-labelledby={`${id}-label`}
                          aria-describedby={`${id}-features`}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary-600 scroll-mt-28 disabled:cursor-default"
                        />
                        <span className="min-w-0">
                          <span id={`${id}-label`} className="block text-[13px] font-semibold text-neutral-900">
                            {m.label}
                          </span>
                          <span id={`${id}-features`} className="block text-xs leading-relaxed text-neutral-600">
                            {m.features.join(", ")}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-neutral-500">
                <Lock size={11} aria-hidden />
                Only an organisation admin can give this.
              </p>
            </div>
          )}

          {/* 3. Joins every project */}
          {projects && (
            <div className="border-t border-neutral-100 pt-4 [grid-area:proj]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">Joins every project</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">Holders get an Oversight seat on every project.</p>
                </div>
                <Switch
                  checked={settings.joinsEveryProject}
                  onChange={(v) => onChange({ joinsEveryProject: v })}
                  label="Joins every project"
                  disabled={off}
                />
              </div>
              {settings.joinsEveryProject && (
                <div className="mt-3">
                  <p id="setting-project-activity" className="mb-1.5 text-xs font-semibold text-neutral-700">
                    Project activity
                  </p>
                  <SegmentedRadio
                    label="Project activity"
                    options={ACTIVITY}
                    value={settings.projectActivity}
                    onChange={(v) => onChange({ projectActivity: v })}
                    disabled={off}
                    size="sm"
                  />
                </div>
              )}
              <p className="mt-3 inline-flex items-start gap-1.5 rounded-lg bg-sun-50 px-2 py-1 text-xs text-sun-700">
                <Clock3 size={13} aria-hidden className="mt-px shrink-0" />
                {notLiveLine(projects.label)}.
              </p>
            </div>
          )}
      </div>
      </div>
    </Panel>
  );
}
