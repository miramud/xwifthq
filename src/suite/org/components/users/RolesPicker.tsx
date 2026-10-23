"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck, X } from "lucide-react";
import { Chip, SearchField, cx } from "@/components/workspace/kit";
import { permissions as permissionsApi, roles as rolesApi, type Catalogue, type Role } from "@/lib/api/roles-client";
import { EffectivePermissions, SELF_SERVICE_ONLY } from "../roles/PermissionMatrix";
import { moduleLabel, roleKind } from "../roles/RoleKindChip";

interface Option {
  /** The role id. */
  value: string;
  /** A ready-made starter role. */
  starter: boolean;
  /** One of the roles every organisation is set up with. */
  seeded: boolean;
  module: string | null;
  name: string;
  description: string | null;
  permissions: string[] | null;
  /** Carries the Organisation admin setting: holding it makes somebody an admin. */
  admin: boolean;
  /** Carries Organisation admin or Confidential access: an admin's to give. */
  protected: boolean;
}

const GROUPS: { key: string; label: string; hint: string; test: (o: Option) => boolean }[] = [
  { key: "seeded", label: "Seeded", hint: "set up for every organisation, editable", test: (o) => o.seeded },
  { key: "ready-made", label: "Ready-made", hint: "editable, this organisation only", test: (o) => !o.seeded && o.starter },
  { key: "custom", label: "Your roles", hint: "made by your admins", test: (o) => !o.seeded && !o.starter },
];

/**
 * Every role a user can hold, in one searchable list: this organisation's
 * roles (seeded, ready-made and its own), each with how many permissions it
 * carries. The Organisation admin role is one of them: holding it is what
 * makes somebody an admin (roles redesign, phase 3b).
 *
 * Two kinds of role can't be changed here, and say why: a role carrying
 * Organisation admin or Confidential access, for somebody who isn't an admin
 * (`canGrantProtected` false), and your own admin role (`keepOwnAdmin`). The
 * API refuses both anyway.
 *
 * Underneath, a live "effective permissions" summary: the union of what
 * everybody has and everything picked, collapsed by module, so an admin sees
 * what they're about to grant before they grant it.
 */
export function RolesPicker({
  roleIds,
  onChange,
  canGrantProtected = true,
  keepOwnAdmin = false,
}: {
  roleIds: string[];
  onChange: (roleIds: string[]) => void;
  canGrantProtected?: boolean;
  keepOwnAdmin?: boolean;
}) {
  // What they held when the form opened: keeping a role is not giving it.
  const [heldAtOpen] = useState(() => new Set(roleIds));
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([rolesApi.list(), permissionsApi.catalogue()])
      .then(([r, c]) => {
        if (!alive) return;
        setRoles(r);
        setCatalogue(c);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo<Option[]>(() => {
    if (!roles) return [];
    const custom: Option[] = roles
      .filter((r) => r.kind === "custom")
      .map((r) => {
        const admin = Boolean(r.settings?.organisationAdmin);
        return {
          value: r.id,
          starter: Boolean(r.starter),
          seeded: Boolean(r.seeded),
          module: r.module ?? null,
          name: r.name,
          description: r.description,
          permissions: r.permissions,
          admin,
          protected: admin || (r.settings?.confidentialModules ?? []).length > 0,
        };
      });
    // Ready-made roles grouped by module, the way an admin thinks of them.
    custom.sort((a, b) => Number(b.starter) - Number(a.starter) || (a.module ?? "").localeCompare(b.module ?? ""));
    return custom;
  }, [roles]);

  const isOn = (o: Option) => roleIds.includes(o.value);

  /** Why this role can't be ticked or unticked here, if it can't. */
  const lockedBecause = (o: Option): string | null => {
    if (keepOwnAdmin && o.admin && heldAtOpen.has(o.value)) return "You can't remove your own admin access. Another admin can.";
    if (!canGrantProtected && o.protected && !heldAtOpen.has(o.value)) return "Only an organisation admin can give this role.";
    return null;
  };

  const toggle = (o: Option) => {
    if (lockedBecause(o)) return;
    onChange(isOn(o) ? roleIds.filter((d) => d !== o.value) : [...roleIds, o.value]);
  };

  const q = search.trim().toLowerCase();
  const shown = options.filter(
    (o) => q === "" || o.name.toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q),
  );
  const selected = options.filter(isOn);

  const effective = useMemo(() => {
    if (!roles) return null;
    // Everybody is a User underneath; what they have beyond that comes from roles.
    const base = roles.find((r) => r.kind === "system" && r.systemKey === "user");
    const keys = new Set(base?.permissions ?? []);
    for (const o of options) if (isOn(o)) for (const k of o.permissions ?? []) keys.add(k);
    return [...keys];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, options, roleIds]);

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected roles">
          {selected.map((o) => (
            <li key={o.value}>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-grape-50 pl-3 pr-1 text-xs font-semibold text-grape-700">
                {o.name}
                {lockedBecause(o) ? (
                  <span className="w-2" aria-hidden />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(o)}
                    aria-label={`Remove ${o.name}`}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full hover:bg-white/70"
                  >
                    <X size={12} aria-hidden />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <SearchField value={search} onChange={setSearch} placeholder="Search roles" label="Search roles to add" />

      <div
        role="group"
        aria-label="Additional roles"
        className="max-h-80 overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 bg-white"
      >
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">No role matches “{search}”.</p>
        ) : (
          GROUPS.map((g) => {
            const items = shown.filter(g.test);
            if (items.length === 0) return null;
            return (
              <section key={g.key} aria-label={g.label}>
                <h4 className="sticky top-0 z-[1] border-b border-neutral-100 bg-neutral-50/95 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 backdrop-blur">
                  {g.label}
                  <span className="ml-1.5 font-medium normal-case tracking-normal text-neutral-400">{g.hint}</span>
                </h4>
                <ul className="divide-y divide-neutral-100">
                  {items.map((o) => {
                    const on = isOn(o);
                    const locked = lockedBecause(o);
                    const k = roleKind({ kind: "custom", starter: o.starter, seeded: o.seeded });
                    const mod = moduleLabel(o.module);
                    return (
                      <li key={o.value}>
                        <label
                          className={cx(
                            "flex items-start gap-3 px-3.5 py-3 transition-colors has-[:focus-visible]:bg-primary-50/60",
                            locked ? "cursor-not-allowed" : "cursor-pointer",
                            on ? "bg-primary-50/50" : !locked && "hover:bg-neutral-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={Boolean(locked)}
                            onChange={() => toggle(o)}
                            className={cx(
                              "mt-0.5 h-4 w-4 shrink-0 accent-primary-600",
                              locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
                              {o.name}
                              <Chip hue={k.hue} icon={k.icon}>
                                {k.label}
                              </Chip>
                            </span>
                            {(mod || o.description) && (
                              <span className="mt-0.5 block text-xs text-neutral-500">
                                {mod && <span className="font-medium text-neutral-600">{mod}</span>}
                                {mod && o.description && " · "}
                                {o.description}
                              </span>
                            )}
                            {locked && <span className="mt-1 block text-xs font-medium text-neutral-600">{locked}</span>}
                          </span>
                          {o.permissions && (
                            <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                              {o.permissions.length} permission{o.permissions.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {failed && (
        <p className="text-xs text-neutral-500">
          The roles couldn&apos;t be loaded. Save without changing them, or reload the page to try again.
        </p>
      )}
      {roles && (
        <p className="text-xs text-neutral-500">
          Need a different mix of permissions?{" "}
          <Link
            href="/suite/org/roles/new"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline"
          >
            Create a role
            <ExternalLink size={12} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>{" "}
          for this organisation only, then search for it here.
        </p>
      )}

      {catalogue && effective && (
        <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-3.5">
          <p className="mb-2.5 flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary-600" aria-hidden />
              Effective permissions
            </span>
            <span className="text-xs font-medium tabular-nums text-neutral-500" aria-live="polite">
              {effective.length === 0 ? "Self-service only" : `${effective.length} in total`}
            </span>
          </p>
          <EffectivePermissions catalogue={catalogue} keys={effective} empty={SELF_SERVICE_ONLY} />
        </div>
      )}
    </div>
  );
}
