"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Copy, Info, KeyRound, Lock, Save, ShieldCheck, Sprout, Trash2, Users } from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import {
  ApiError,
  permissions as permissionsApi,
  roles as rolesApi,
  type Catalogue,
  type Role,
  type RoleDetail,
  type RoleSettings,
} from "@/lib/api/roles-client";
import { ErrorNote, FaceAvatar, Field, FormActions, ListRow, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { PermissionMatrix } from "./PermissionMatrix";
import type { GrantUpdate } from "./FeatureRow";
import {
  DEFAULT_SETTINGS,
  heldConfidential,
  sameGrants,
  sameSettings,
  toGrantMap,
  toGrants,
  withoutKeys,
  type GrantMap,
} from "./permission-model";
import { RoleSettingsPanel, confidentialCheckboxId } from "./RoleSettingsPanel";

interface Draft {
  name: string;
  description: string;
  /** Held keys and their scopes. */
  grants: GrantMap;
  /** Null for built-in roles, which have none. */
  settings: RoleSettings | null;
}

const EMPTY_DRAFT: Draft = { name: "", description: "", grants: {}, settings: DEFAULT_SETTINGS };

function sameDraft(a: Draft, b: Draft): boolean {
  return a.name === b.name && a.description === b.description && sameGrants(a.grants, b.grants) && sameSettings(a.settings, b.settings);
}

/** A role as the editor drafts it. Built-in roles hold every key organisation-wide. */
function draftOf(r: Role): Draft {
  return {
    name: r.name,
    description: r.description ?? "",
    grants: toGrantMap(r.grants ?? r.permissions.map((key) => ({ key, scope: "organisation" as const }))),
    settings: r.kind === "system" ? null : (r.settings ?? DEFAULT_SETTINGS),
  };
}

const NONE: readonly string[] = [];

const TEMPLATE_KEY_HINT = "The key the product recognises this role by. Renaming the role doesn't change it.";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Creating or editing one role: its name, what it's for, and the permission
 * matrix. A built-in role opens read-only (it describes what the platform
 * already enforces), with "Duplicate to customise" as the way to change it.
 *
 * Leaving with unsaved changes asks first, both in the app and on a tab close.
 */
export default function RoleEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const creating = id === null;

  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [saved, setSaved] = useState<Draft>(EMPTY_DRAFT);
  const [draft, setDraft] = useState<Draft>(saved);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([permissionsApi.catalogue(), id ? rolesApi.get(id) : Promise.resolve(null)])
      .then(([cat, r]) => {
        if (!alive) return;
        setCatalogue(cat);
        setLoadError(null);
        if (r) {
          const d = draftOf(r);
          setRole(r);
          setSaved(d);
          setDraft(d);
        }
      })
      .catch(
        (e: unknown) =>
          alive &&
          setLoadError({
            status: e instanceof ApiError ? e.status : 0,
            message: e instanceof ApiError ? e.message : "This role didn't load.",
          }),
      );
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  const readOnly = role !== null && !role.editable;
  const dirty = !readOnly && !sameDraft(draft, saved);

  // A tab close or reload with unsaved changes gets the browser's own prompt.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const leave = useCallback(
    async (href: string) => {
      if (dirty) {
        const ok = await confirm({
          title: "Discard your changes?",
          body: "You've changed this role and haven't saved. Leaving now loses those changes.",
          confirmLabel: "Discard changes",
        });
        if (!ok) return;
      }
      router.push(href);
    },
    [dirty, confirm, router],
  );

  // One stable handler for every matrix row, so a click re-renders one row.
  const updateGrants = useCallback<GrantUpdate>((fn) => setDraft((d) => ({ ...d, grants: fn(d.grants) })), []);

  const patchSettings = useCallback(
    (patch: Partial<RoleSettings>) => setDraft((d) => (d.settings ? { ...d, settings: { ...d.settings, ...patch } } : d)),
    [],
  );

  /**
   * Confidential access for one module. Turning it off while the role holds
   * that module's confidential permissions asks first, naming the features,
   * and then takes them away with it.
   */
  const changeConfidential = async (moduleKey: string, on: boolean) => {
    if (!draft.settings || !catalogue) return;
    const modules = draft.settings.confidentialModules;
    if (on) {
      patchSettings({ confidentialModules: modules.includes(moduleKey) ? modules : [...modules, moduleKey] });
      return;
    }
    const mod = catalogue.modules.find((m) => m.key === moduleKey);
    const held = mod ? heldConfidential(mod, draft.grants) : { keys: [], features: [] };
    if (held.keys.length > 0) {
      const n = held.keys.length;
      const ok = await confirm({
        title: `Remove ${n} confidential permission${n === 1 ? "" : "s"}?`,
        body: `Without Confidential access for ${mod!.label}, this role can't hold them. They come off ${held.features.join(", ")}.`,
        confirmLabel: `Remove ${n === 1 ? "it" : "them"}`,
        icon: Lock,
      });
      if (!ok) return;
    }
    setDraft((d) =>
      d.settings
        ? {
            ...d,
            grants: withoutKeys(d.grants, held.keys),
            settings: { ...d.settings, confidentialModules: d.settings.confidentialModules.filter((k) => k !== moduleKey) },
          }
        : d,
    );
  };

  // "Needs Confidential access for HR": scroll to that checkbox and focus it.
  const requestConfidential = useCallback((moduleKey: string) => {
    const box = document.getElementById(confidentialCheckboxId(moduleKey));
    if (!box) return;
    box.scrollIntoView?.({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    box.focus({ preventScroll: true });
    // A mouse click's programmatic focus shows no ring, so mark the row for a moment.
    const row = box.closest("label");
    row?.classList.add("ring-2", "ring-primary-300");
    window.setTimeout(() => row?.classList.remove("ring-2", "ring-primary-300"), 1800);
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      grants: toGrants(draft.grants),
      ...(draft.settings ? { settings: draft.settings } : {}),
    };
    try {
      if (creating) {
        const created = await rolesApi.create(body);
        setSaved(draft);
        router.push(`/suite/org/roles/${created.id}`);
      } else {
        const updated = await rolesApi.update(role!.id, body);
        const d = draftOf(updated);
        setSaved(d);
        setDraft(d);
        setRole((r) => (r ? { ...r, ...updated } : r));
        setNotice(`${updated.name} was saved.`);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.errors ?? {});
        setError(e.errors && Object.keys(e.errors).length > 0 ? "Check the highlighted fields." : e.message);
      } else {
        setError("The role didn't save. Check your connection and try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (!role) return;
    setError(null);
    try {
      const copy = await rolesApi.duplicate(role.id);
      router.push(`/suite/org/roles/${copy.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `${role.name} wasn't duplicated.`);
    }
  };

  const remove = async () => {
    if (!role) return;
    const ok = await confirm({
      title: `Delete “${role.name}”?`,
      body:
        role.usersCount > 0
          ? `It moves to the recycle bin. The ${role.usersCount} user${role.usersCount === 1 ? "" : "s"} who hold it lose its permissions while it's there, and get them back if it's restored.`
          : "It moves to the recycle bin. Nobody holds it, so no one loses access.",
      confirmLabel: "Delete role",
      recoverable: true,
    });
    if (!ok) return;
    try {
      await rolesApi.remove(role.id);
      router.push("/suite/org/roles");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `${role.name} wasn't deleted.`);
    }
  };

  // The way back goes through the unsaved-changes guard like Cancel does.
  const back = (
    <button
      type="button"
      onClick={() => void leave("/suite/org/roles")}
      className="mb-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl pr-2 text-sm font-medium text-neutral-500 outline-none transition-colors hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <ArrowLeft size={16} aria-hidden />
      Back to roles
    </button>
  );

  if (loadError) {
    return (
      <div>
        {back}
        <Card>
          <Empty
            icon={ShieldCheck}
            title={loadError.status === 404 ? "This role isn't here." : "This role didn't load."}
            hint={loadError.status === 404 ? "It may have been deleted. Check the recycle bin." : loadError.message}
            hue="coral"
            action={
              loadError.status === 404 ? (
                <ButtonLink href="/suite/org/recycle-bin" size="sm">
                  Open the recycle bin
                </ButtonLink>
              ) : (
                <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                  Try again
                </Button>
              )
            }
          />
        </Card>
      </div>
    );
  }

  if (!catalogue || (!creating && !role)) {
    return (
      <div>
        {back}
        <p className="sr-only">Loading role…</p>
        <div className="space-y-6" aria-hidden>
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[420px]" />
        </div>
      </div>
    );
  }

  const nameError = fieldErrors.name?.[0] ?? null;
  const permError = fieldErrors.permissions?.[0] ?? fieldErrors.grants?.[0] ?? null;
  const settingsError = fieldErrors.settings?.[0] ?? null;
  const roleIdsError = fieldErrors.roleIds?.[0] ?? null;
  const seeded = Boolean(role?.seeded);
  // Seeded roles grant nothing until their module switches to the new checks: say so where they don't act yet.
  const seededInert = seeded && !catalogue.live.seededRoles;
  const seededLive = catalogue.modules
    .filter((m) => (catalogue.live.seededModules ?? []).includes(m.key))
    .map((m) => m.label);
  // "Projects, HR and Learning": a list read as a sentence.
  const actsIn =
    seededLive.length === 0
      ? null
      : seededLive.length === 1
        ? seededLive[0]
        : `${seededLive.slice(0, -1).join(", ")} and ${seededLive[seededLive.length - 1]}`;
  const confidentialModules = draft.settings?.confidentialModules ?? NONE;

  return (
    <form onSubmit={save} noValidate>
      {back}
      <PageHeader
        eyebrow="Roles & permissions"
        title={
          creating ? (
            "New role"
          ) : seeded ? (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-2">
              {role!.name}
              <span className="inline-flex items-center gap-2 tracking-normal">
                <Chip hue="blue" icon={Sprout}>
                  Seeded
                </Chip>
                {role!.templateKey && (
                  <code
                    title={TEMPLATE_KEY_HINT}
                    className="cursor-help rounded-lg border border-primary-100 bg-primary-50/60 px-2 py-1 font-mono text-xs font-medium text-primary-800"
                  >
                    <span className="sr-only">Template key </span>
                    {role!.templateKey}
                  </code>
                )}
              </span>
            </span>
          ) : (
            role!.name
          )
        }
        subtitle={
          readOnly
            ? "A built-in role: it describes what XwiftHQ already allows. Duplicate it to make a version you can change."
            : "Roles belong to your organisation only. Changes apply to everyone who holds the role as soon as you save."
        }
        actions={
          role ? (
            // One row that never stacks: the title column wraps instead.
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              {readOnly ? (
                <Chip hue="slate" icon={Lock}>
                  Built in
                </Chip>
              ) : null}
              <Button icon={Copy} onClick={duplicate} variant={readOnly ? "primary" : "secondary"}>
                {readOnly ? "Duplicate to customise" : "Duplicate"}
              </Button>
              {role.kind === "custom" && (
                <Button icon={Trash2} variant="danger" onClick={remove}>
                  Delete
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && (
        <p className="mb-6 flex items-center gap-3 rounded-2xl bg-mint-50 px-4 py-3 text-sm font-medium text-mint-700">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden />
          {notice}
        </p>
      )}
      {error && <ErrorNote className="mb-6">{error}</ErrorNote>}
      {seededInert && (
        <div
          role="note"
          className="mb-6 flex items-start gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm" aria-hidden>
            <Info size={18} />
          </span>
          <p className="min-w-0 flex-1 pt-0.5">
            {actsIn === null
              ? "Seeded roles don't grant anything yet. They take effect module by module as each switches to the new checks."
              : `Seeded roles act in ${actsIn} already. In the other modules they take effect as each switches to the new checks.`}{" "}
            You can edit this role now and your changes are kept.
          </p>
        </div>
      )}

      {/*
        Two columns from 2xl: the matrix on the left, settings and holders in a
        fixed side column. Narrower, the matrix needs the full width to keep
        each feature on one aligned line, so the panels stack: About,
        settings (before the permissions they unlock), holders, permissions.
        The side wrapper is `display: contents` until then so its panels can
        take their own places in that order.
      */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-rows-[auto_1fr]">
        <div className="order-1 min-w-0 2xl:order-none 2xl:col-start-1 2xl:row-start-1">
          <Panel title="About this role" icon={KeyRound} hue="grape">
            <div className="space-y-4">
              <Field id="role-name" label="Name" hint={readOnly ? undefined : "Required"}>
                <input
                  id="role-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  disabled={readOnly}
                  placeholder="For example, Course reviewer"
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? "role-name-error" : undefined}
                  className={inputClass}
                />
                {nameError && (
                  <p id="role-name-error" className="mt-1.5 text-xs font-medium text-error-700">
                    {nameError}
                  </p>
                )}
              </Field>
              <Field id="role-description" label="Description" hint={readOnly ? undefined : "Optional"}>
                <textarea
                  id="role-description"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  disabled={readOnly}
                  placeholder="Who is this role for, and what do they do?"
                  className={cx(textareaClass, "disabled:text-neutral-500")}
                />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="contents 2xl:col-start-2 2xl:row-span-2 2xl:row-start-1 2xl:block 2xl:space-y-6">
          <div className="order-2 2xl:order-none">
            <RoleSettingsPanel
              catalogue={catalogue}
              settings={draft.settings}
              readOnly={readOnly}
              onChange={patchSettings}
              onConfidentialChange={(m, on) => void changeConfidential(m, on)}
              settingsError={settingsError}
              roleIdsError={roleIdsError}
            />
          </div>
          <div className="order-3 2xl:order-none">
            <Panel title="Who holds it" icon={Users} hue="sky">
              {creating ? (
                <p className="text-sm text-neutral-500">
                  Nobody yet. Once it&apos;s saved, give it to users from their page in User management.
                </p>
              ) : role!.users.length === 0 ? (
                <p className="text-sm text-neutral-500">Nobody holds this role.</p>
              ) : (
                <ul className="-mx-2 space-y-1">
                  {role!.users.slice(0, 20).map((u) => (
                    <ListRow
                      key={u.id}
                      leading={<FaceAvatar name={u.name} size={32} />}
                      title={u.name}
                      meta={u.email}
                      href={`/suite/org/users/${u.id}`}
                    />
                  ))}
                  {role!.usersCount > 20 && (
                    <li className="px-2 pt-2 text-xs text-neutral-500">
                      and {role!.usersCount - 20} more.{" "}
                      <Link href={`/suite/org/users?roleId=${role!.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary-700 hover:underline">
                        See all
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <div className="order-4 min-w-0 2xl:order-none 2xl:col-start-1 2xl:row-start-2 2xl:self-start">
          <Panel
            title="Permissions"
            subtitle={
              readOnly
                ? "What this built-in role allows, organisation-wide. Open Customise on a feature to see its actions."
                : "Give each feature a bundle and, where it offers one, a scope. Customise picks single actions."
            }
            icon={ShieldCheck}
          >
            {seededInert && (
              <p className="mb-4 flex items-start gap-1.5 rounded-xl bg-sun-50 px-3 py-2 text-xs font-medium text-sun-700">
                <Clock3 size={13} aria-hidden className="mt-px shrink-0" />
                {actsIn === null
                  ? "This seeded role grants nothing yet. Each module below says so until it switches to the new checks."
                  : `This seeded role acts in ${actsIn}. Each other module below says so until it switches to the new checks.`}
              </p>
            )}
            {permError && (
              <p role="alert" className="mb-4 rounded-2xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-xs font-medium text-error-700">
                {permError}
              </p>
            )}
            <PermissionMatrix
              catalogue={catalogue}
              value={draft.grants}
              readOnly={readOnly}
              onChange={updateGrants}
              confidentialModules={confidentialModules}
              seededInert={seededInert}
              onRequestConfidential={requestConfidential}
            />
          </Panel>
        </div>
      </div>

      {!readOnly && (
        <div className="mt-6">
          <FormActions
            note={
              dirty ? (
                <span className="font-medium text-sun-700">Unsaved changes</span>
              ) : creating ? (
                "Name the role and pick its permissions."
              ) : (
                "All changes saved."
              )
            }
          >
            <Button onClick={() => leave("/suite/org/roles")}>Cancel</Button>
            <Button type="submit" variant="primary" icon={Save} disabled={saving || (!creating && !dirty)}>
              {saving ? "Saving…" : creating ? "Create role" : "Save changes"}
            </Button>
          </FormActions>
        </div>
      )}
    </form>
  );
}
