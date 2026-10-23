"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserMinus,
  UserPlus,
  Users,
  Workflow,
  X,
} from "lucide-react";
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  Empty,
  PageHeader,
  PersonAvatar,
  SearchField,
  Toolbar,
  buttonClass,
  cx,
} from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect, foldText, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ApiError, hrm, type Employee, type HrRole, type HrRoleHolder } from "@/lib/api/hrm-client";
import { useAuth } from "@/lib/auth-store";
import { isAdminRole } from "@/lib/roles";
import { roleKind } from "@/suite/org/components/roles/RoleKindChip";
import { IconTile } from "../ui/recordKit";

/**
 * HR's roles board (roles redesign, phase 3a). It replaced "Who does what",
 * where HR appointed designations.
 *
 * Whoever runs HR sees the organisation's roles they may give - only roles
 * whose permissions they hold themselves; a role carrying Organisation admin
 * or Confidential access is an admin's - and who holds each, and gives or
 * takes them here. The API decides which roles those are; this board shows
 * exactly what it sends.
 *
 * A save sends the person's whole set of giveable roles held by hand: the
 * API sets exactly those and leaves every other role of theirs alone. Holders
 * the system gave a role to (`automatic`: the reporting line's Line Manager)
 * are neither removed nor re-added from here.
 *
 * An admin can give some fifty roles, so the board is built to scan: Line
 * Manager first, roles somebody holds as full cards, roles nobody holds yet
 * as short ones, and the give control folded behind one button per card.
 */

/** Holders shown on a card before "Show all": a 200-person role stays a card, not a wall. */
const VISIBLE_HOLDERS = 6;

/** How long "Given to …" stays on the card that was acted on. */
const RECENT_MS = 6000;

const INTRO =
  "Give and take roles from here. You can give only roles whose permissions you hold yourself; roles carrying Organisation admin or Confidential access are an admin's to give.";

type Section = "held" | "empty";
type Tab = "all" | Section;

/** Where a refusal belongs: under the picker, or under the holder it was about. */
type RowError = { roleId: string; userId: string | null; message: string };

/** The last change, shown on the card it happened on rather than at the top of a long page. */
type Recent = {
  roleId: string;
  userId: string;
  kind: "given" | "taken";
  name: string;
};

/**
 * What to say when a give or take fails. A refusal (4xx) says why in its own
 * words; anything else - a server error, the network - gets the written
 * fallback rather than "Request failed."
 */
function refusal(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.status >= 400 && e.status < 500) return e.errors?.roleIds?.[0] ?? e.message ?? fallback;
  return fallback;
}

/** Why the system gave somebody a role, in words: the reason it can't be taken from here. */
function automaticReason(role: HrRole, holder: HrRoleHolder): { label: string; detail: string } {
  if (holder.source === "reporting_line" || (holder.source == null && role.followsReportingLine)) {
    return {
      label: "From the reporting line",
      detail: `${holder.name} has a direct report, so the reporting line gives them ${role.name}. It goes when they no longer have one.`,
    };
  }
  return {
    label: "Given automatically",
    detail: `The system gave ${holder.name} ${role.name}, so it can't be taken from here.`,
  };
}

export default function HrRolesBoard() {
  const { user } = useAuth();
  const admin = isAdminRole(user);
  const confirm = useConfirm();

  const [roles, setRoles] = useState<HrRole[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [people, setPeople] = useState<Employee[] | null>(null);
  const [peopleError, setPeopleError] = useState(false);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [tray, setTray] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<RowError | null>(null);
  const [recent, setRecent] = useState<Recent | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /*
    A role acted on keeps the section it was in for this visit. Otherwise
    giving the first holder would fly the card from "Nobody holds these yet"
    to the other end of the page, taking the person's place with it.
  */
  const [pinned, setPinned] = useState<Record<string, Section>>({});

  // A ref as well as state: two clicks in one frame both see `busy === null`.
  const inFlight = useRef(false);

  const loadRoles = useCallback(async () => {
    try {
      setRoles(await hrm.roles.list());
      setLoadError(null);
    } catch (e) {
      setLoadError(refusal(e, "The roles did not load."));
    }
  }, []);

  const loadPeople = useCallback(async () => {
    try {
      setPeople(await hrm.employees.listAll());
      setPeopleError(false);
    } catch {
      setPeopleError(true);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
    void loadPeople();
  }, [loadRoles, loadPeople]);

  // "Given to …" reads, then gets out of the way; an error stays until acted on.
  useEffect(() => {
    if (recent === null) return;
    const t = window.setTimeout(() => setRecent(null), RECENT_MS);
    return () => window.clearTimeout(t);
  }, [recent]);

  const retry = () => {
    setLoadError(null);
    setRoles(null);
    void loadRoles();
    if (peopleError || people === null) void loadPeople();
  };

  const sectionOf = useCallback(
    (role: HrRole): Section =>
      pinned[role.id] ?? (role.followsReportingLine || role.holders.length > 0 ? "held" : "empty"),
    [pinned],
  );

  /* ---------------- Who holds what ---------------- */

  /** The giveable roles this person holds by hand: what a save sends, before the change. */
  const handHeld = (userId: string, list: HrRole[]) =>
    list.filter((r) => r.holders.some((h) => h.userId === userId && !h.automatic)).map((r) => r.id);

  const run = async (
    key: string,
    role: HrRole,
    employeeId: string,
    userId: string,
    next: (held: string[]) => string[],
    patch: (r: HrRole) => HrRole,
    done: Recent,
    said: string,
    fallback: string,
    errorUserId: string | null,
  ) => {
    if (inFlight.current || roles === null) return false;
    inFlight.current = true;
    setBusy(key);
    setRowError(null);
    setRecent(null);

    try {
      await hrm.roles.sync(employeeId, next(handHeld(userId, roles)));
      setPinned((p) => ({ ...p, [role.id]: p[role.id] ?? sectionOf(role) }));
      // Shown at once; the list is then read back so the board says what the API holds.
      setRoles((rs) => (rs ?? []).map((r) => (r.id === role.id ? patch(r) : r)));
      setRecent(done);
      setAnnouncement(said);
      void loadRoles();
      return true;
    } catch (e) {
      setRowError({
        roleId: role.id,
        userId: errorUserId,
        message: refusal(e, fallback),
      });
      setAnnouncement("");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const openTray = (roleId: string | null) => {
    setTray(roleId);
    setPicked("");
    if (rowError?.userId === null) setRowError(null);
  };

  const give = async (role: HrRole) => {
    const employee = people?.find((p) => p.id === picked);
    if (!employee) return;
    const name = employee.person.name ?? "Unnamed";

    const ok = await run(
      `give-${role.id}`,
      role,
      employee.id,
      employee.person.id,
      (held) => [...held.filter((id) => id !== role.id), role.id],
      (r) => ({
        ...r,
        holders: [
          ...r.holders,
          {
            userId: employee.person.id,
            employeeId: employee.id,
            name,
            email: employee.person.email ?? "",
            automatic: false,
            source: null,
          },
        ].sort((a, b) => a.name.localeCompare(b.name)),
      }),
      { roleId: role.id, userId: employee.person.id, kind: "given", name },
      `${name} now holds ${role.name}.`,
      `${role.name} was not given. Try again.`,
      null,
    );

    if (ok) openTray(null);
  };

  const take = async (role: HrRole, holder: HrRoleHolder) => {
    if (holder.employeeId === null || holder.automatic) return;
    if (inFlight.current) return;

    const sure = await confirm({
      title: `Take ${role.name} from ${holder.name}?`,
      body: `${holder.name} loses what ${role.name} lets them do straight away. You can give it back from here at any time.`,
      confirmLabel: "Take role",
      icon: UserMinus,
    });
    if (!sure) return;

    await run(
      `take-${role.id}-${holder.userId}`,
      role,
      holder.employeeId,
      holder.userId,
      (held) => held.filter((id) => id !== role.id),
      (r) => ({
        ...r,
        holders: r.holders.filter((h) => !(h.userId === holder.userId && !h.automatic)),
      }),
      {
        roleId: role.id,
        userId: holder.userId,
        kind: "taken",
        name: holder.name,
      },
      `${holder.name} no longer holds ${role.name}.`,
      `${role.name} was not taken from ${holder.name}. Try again.`,
      holder.userId,
    );
  };

  /* ---------------- Search and order ---------------- */

  const q = foldText(query.trim());

  const shown = useMemo(() => {
    if (roles === null) return [];
    // Line Manager first: the role that keeps itself, and the one HR thinks of first.
    const ordered = [...roles].sort((a, b) => Number(b.followsReportingLine) - Number(a.followsReportingLine));
    if (q === "")
      return ordered.map((role) => ({
        role,
        holders: role.holders,
        narrowed: false,
      }));
    return ordered.flatMap((role) => {
      if (foldText(`${role.name} ${role.description ?? ""}`).includes(q)) {
        return [{ role, holders: role.holders, narrowed: false }];
      }
      const holders = role.holders.filter((h) => foldText(`${h.name} ${h.email}`).includes(q));
      return holders.length > 0 ? [{ role, holders, narrowed: true }] : [];
    });
  }, [roles, q]);

  const heldShown = shown.filter((s) => sectionOf(s.role) === "held");
  const emptyShown = shown.filter((s) => sectionOf(s.role) === "empty");

  const peopleHolding = useMemo(() => {
    const ids = new Set<string>();
    for (const r of roles ?? []) for (const h of r.holders) ids.add(h.userId);
    return ids.size;
  }, [roles]);

  /* ---------------- Render ---------------- */

  if (roles === null && loadError !== null) {
    return (
      <div>
        <PageHeader title="HR roles" subtitle={INTRO} />
        <Card>
          <Empty
            icon={AlertTriangle}
            hue="coral"
            title="The roles did not load"
            hint={loadError}
            action={
              <Button icon={RefreshCw} onClick={retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (roles === null) {
    return (
      <div>
        <PageHeader title="HR roles" subtitle={INTRO} />
        <RolesSkeleton />
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div>
        <PageHeader title="HR roles" subtitle={INTRO} />
        <Card>
          <Empty
            icon={ShieldOff}
            hue="slate"
            title="There are no roles you can give"
            hint={
              admin
                ? "You can give only roles whose permissions you hold yourself. As an organisation admin you can also give any role from Users & roles."
                : "You can give only roles whose permissions you hold yourself, and none of the organisation's roles fit within yours. An organisation admin can give any role from Users & roles."
            }
            action={
              admin ? (
                <ButtonLink href="/suite/org/users" icon={Users}>
                  Open Users &amp; roles
                </ButtonLink>
              ) : undefined
            }
          />
        </Card>
      </div>
    );
  }

  const cardFor = ({ role, holders, narrowed }: (typeof shown)[number]) => (
    <RoleCard
      key={role.id}
      role={role}
      holders={holders}
      narrowed={narrowed}
      short={sectionOf(role) === "empty" && role.holders.length === 0}
      query={query.trim()}
      people={people}
      peopleError={peopleError}
      open={tray === role.id}
      onOpen={(open) => openTray(open ? role.id : null)}
      picked={tray === role.id ? picked : ""}
      onPick={(id) => {
        setPicked(id);
        if (rowError?.roleId === role.id && rowError.userId === null) setRowError(null);
      }}
      expanded={Boolean(expanded[role.id]) || narrowed}
      onExpand={() => setExpanded((x) => ({ ...x, [role.id]: !x[role.id] }))}
      busy={busy}
      error={rowError?.roleId === role.id ? rowError : null}
      recent={recent?.roleId === role.id ? recent : null}
      onGive={() => void give(role)}
      onTake={(h) => void take(role, h)}
    />
  );

  const showHeld = tab !== "empty" && heldShown.length > 0;
  const showEmpty = tab !== "held" && emptyShown.length > 0;

  return (
    <div>
      <PageHeader
        title="HR roles"
        subtitle={INTRO}
        tabs={[
          { key: "all", label: "All roles", count: shown.length },
          { key: "held", label: "Held", count: heldShown.length },
          { key: "empty", label: "Nobody holds yet", count: emptyShown.length },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search roles and people"
          label="Search roles and people"
          className="w-full sm:max-w-sm"
        />
        <p className="text-sm text-neutral-500">
          {q !== "" ? (
            <>
              Showing <span className="font-semibold tabular-nums text-neutral-900">{shown.length}</span> of{" "}
              <span className="tabular-nums">{roles.length}</span> roles
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-neutral-900">{roles.length}</span>{" "}
              {roles.length === 1 ? "role" : "roles"} you can give
              <span aria-hidden className="mx-2 text-neutral-300">
                ·
              </span>
              <span className="font-semibold tabular-nums text-neutral-900">{peopleHolding}</span>{" "}
              {peopleHolding === 1 ? "person holds" : "people hold"} them
            </>
          )}
        </p>
      </Toolbar>

      {/* Said to screen readers; the eye gets it on the card that was acted on, so nothing here moves. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {peopleError && (
        <p
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-sun-50 px-3.5 py-2.5 text-sm text-sun-700"
        >
          <AlertTriangle size={16} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">The people list did not load, so roles can be taken but not given.</span>
          <Button size="sm" icon={RefreshCw} onClick={() => void loadPeople()}>
            Reload people
          </Button>
        </p>
      )}

      {!showHeld && !showEmpty ? (
        <Card>
          {q !== "" ? (
            <Empty
              icon={ShieldCheck}
              hue="slate"
              title={`Nothing matches “${query.trim()}”`}
              hint="Search looks at role names, what each role is for, and the name or email of everybody holding one."
              action={<Button onClick={() => setQuery("")}>Clear the search</Button>}
            />
          ) : tab === "held" ? (
            <Empty
              icon={Users}
              hue="slate"
              title="Nobody holds any of these roles yet"
              hint="Give a role from Nobody holds yet, and it shows here with who holds it."
            />
          ) : (
            <Empty
              icon={CheckCircle2}
              hue="mint"
              title="Every role has somebody"
              hint="Each role you can give is held by at least one person."
            />
          )}
        </Card>
      ) : (
        <div className="space-y-8">
          {showHeld && (
            <section aria-labelledby="hr-roles-held">
              <SectionHeading id="hr-roles-held" title="Held" count={heldShown.length}>
                Who holds each role. Take one with the button beside the person.
              </SectionHeading>
              <ul className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">{heldShown.map(cardFor)}</ul>
            </section>
          )}

          {showEmpty && (
            <section aria-labelledby="hr-roles-empty">
              {/* "When you opened this page": a role given from here keeps its place until the next visit. */}
              <SectionHeading id="hr-roles-empty" title="Nobody holds yet" count={emptyShown.length}>
                Roles you can give that nobody held when you opened this page.
              </SectionHeading>
              <ul className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {emptyShown.map(cardFor)}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* The intro states the rule for an HR lead; an admin, who can give every role here, gets the exception. */}
      {admin && (
        <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-neutral-500">
          <ShieldCheck size={14} className="mt-px shrink-0 text-neutral-400" aria-hidden />
          <span>
            As an organisation admin you can give every role here. Somebody without an employee record is given roles
            from{" "}
            <Link
              href="/suite/org/users"
              className="font-semibold text-primary-700 underline-offset-2 outline-none hover:underline focus-visible:underline"
            >
              Users &amp; roles
            </Link>
            .
          </span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionHeading({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <h2 id={id} className="flex items-center gap-2 text-lg font-bold tracking-tight text-neutral-900">
        {title}
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-600">
          {count}
        </span>
      </h2>
      <p className="mt-0.5 text-sm text-neutral-500">{children}</p>
    </div>
  );
}

function RoleCard({
  role,
  holders,
  narrowed,
  short,
  query,
  people,
  peopleError,
  open,
  onOpen,
  picked,
  onPick,
  expanded,
  onExpand,
  busy,
  error,
  recent,
  onGive,
  onTake,
}: {
  role: HrRole;
  holders: HrRoleHolder[];
  narrowed: boolean;
  /**
   * A name and a way to give it: a role in "Nobody holds yet" that still has
   * nobody. Not one in "Held" that just lost its last holder - that card keeps
   * its size, says so, and shows "Taken from …".
   */
  short: boolean;
  query: string;
  people: Employee[] | null;
  peopleError: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  picked: string;
  onPick: (employeeId: string) => void;
  expanded: boolean;
  onExpand: () => void;
  busy: string | null;
  error: RowError | null;
  recent: Recent | null;
  onGive: () => void;
  onTake: (holder: HrRoleHolder) => void;
}) {
  const auto = role.followsReportingLine;
  const total = role.holders.length;
  const compact = short && !auto;
  const fromLine = role.holders.filter(
    (h) => h.automatic && automaticReason(role, h).label === "From the reporting line",
  ).length;
  const visible = expanded ? holders : holders.slice(0, VISIBLE_HOLDERS);
  const hidden = holders.length - visible.length;

  const headingId = `hr-role-${role.id}`;
  const pickerId = `hr-role-${role.id}-give`;
  const giveErrorId = `hr-role-${role.id}-give-error`;
  const giving = busy === `give-${role.id}`;
  const kind = roleKind({
    kind: "custom",
    seeded: role.seeded,
    starter: false,
  });

  // Focus goes back to "Give role" when the tray folds, by Cancel or by a give.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const holding = new Set(role.holders.map((h) => h.userId));
  const options: SelectOption[] = (people ?? [])
    .filter((p) => p.isCurrent && !holding.has(p.person.id))
    .map((p) => ({
      value: p.id,
      label: p.person.name ?? "Unnamed",
      hint: [p.jobTitle, p.person.email].filter(Boolean).join(" · "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const giveError = error && error.userId === null ? error.message : null;

  const trigger = (extra?: string) => (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => onOpen(true)}
      disabled={busy !== null || peopleError}
      aria-label={`Give role: ${role.name}`}
      className={cx(buttonClass("secondary", "md"), "shrink-0", extra)}
    >
      <UserPlus size={17} aria-hidden />
      Give role
    </button>
  );

  return (
    // Line Manager's card is the tall one: across both columns, so it leaves no hole beside it.
    <li className={cx("min-w-0", auto && "lg:col-span-2")}>
      <Card as="article" className="flex h-full flex-col">
        <header className="px-5 pt-5">
          {/* Wraps: the description takes a row of its own, and on a phone a short card's button one more under it. */}
          <div className="flex flex-wrap items-start gap-x-3.5 gap-y-2.5 sm:gap-y-1">
            <IconTile icon={auto ? Workflow : ShieldCheck} hue={auto ? "sky" : "slate"} size={40} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 pt-2">
              <h3 id={headingId} className="text-[15px] font-semibold leading-snug text-neutral-900">
                {role.name}
              </h3>
              {/* Seeded on nearly every role, so it whispers; a role the organisation made itself says so. */}
              <Chip hue={role.seeded ? "slate" : kind.hue} icon={kind.icon}>
                {kind.label}
              </Chip>
              {auto && (
                <Chip hue="sky" icon={RefreshCw}>
                  Automatic
                </Chip>
              )}
            </div>
            {/*
              A role nobody holds is a name and a way to give it: the button sits where the count would. On a
              phone that squeezed a long name onto two lines, so there it goes last, full width, under the description.
            */}
            {compact && !open && trigger("order-last w-full sm:order-none sm:w-auto")}
            {!compact && (
              <p className="shrink-0 pt-0.5 text-right">
                <span className="block text-xl font-bold tabular-nums leading-none text-neutral-900">{total}</span>
                <span className="mt-1 block text-xs text-neutral-500">{total === 1 ? "holder" : "holders"}</span>
              </p>
            )}
            {/* Full width on a phone; aligned under the name (past the 40px tile and its gap) from sm up. */}
            {role.description && (
              <p
                className={cx(
                  "basis-full text-sm leading-relaxed text-neutral-600 sm:pl-[54px]",
                  compact && "line-clamp-2",
                )}
                title={compact ? role.description : undefined}
              >
                {role.description}
              </p>
            )}
          </div>
        </header>

        {auto && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/60 px-3.5 py-3 text-[13px] leading-relaxed text-neutral-600">
            <Workflow size={16} className="mt-0.5 shrink-0 text-sky-600" aria-hidden />
            <p>
              <span className="font-semibold text-neutral-900">Keeps itself up to date.</span> You can also give it by
              hand to somebody without reports.
              <span className="mt-1 block text-xs text-neutral-500">
                {fromLine} from the reporting line · {total - fromLine} given by hand
              </span>
            </p>
          </div>
        )}

        {!compact && (
          <div className="mt-4 border-t border-neutral-100 px-5">
            {holders.length === 0 ? (
              <p className="flex items-center gap-2 py-5 text-sm text-neutral-500">
                <Users size={16} className="shrink-0 text-neutral-400" aria-hidden />
                Nobody holds this role yet.
              </p>
            ) : (
              <>
                {narrowed && (
                  <p className="pt-3 text-xs text-neutral-500">
                    {holders.length} of {total} {total === 1 ? "holder matches" : "holders match"} “{query}”
                  </p>
                )}
                <ul className="divide-y divide-neutral-100" aria-label={`Holders of ${role.name}`}>
                  {visible.map((h) => (
                    <HolderRow
                      key={`${h.userId}-${h.automatic ? "a" : "h"}`}
                      role={role}
                      holder={h}
                      busy={busy}
                      fresh={recent?.kind === "given" && recent.userId === h.userId && !h.automatic}
                      error={error && error.userId === h.userId ? error.message : null}
                      onTake={() => onTake(h)}
                    />
                  ))}
                </ul>
                {(hidden > 0 || (!narrowed && expanded && holders.length > VISIBLE_HOLDERS)) && (
                  <button
                    type="button"
                    onClick={onExpand}
                    aria-expanded={expanded}
                    className="mb-1 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-primary-700 outline-none transition-colors hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    {hidden > 0 ? `Show all ${holders.length} holders` : "Show fewer"}
                    <ChevronDown
                      size={15}
                      className={cx("transition-transform motion-reduce:transition-none", hidden === 0 && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {compact && !open ? (
          <div className="pb-5" />
        ) : (
          <div
            className={cx(
              "mt-auto rounded-b-[1.125rem] border-t border-neutral-100 px-5",
              compact && "mt-4",
              open ? "bg-neutral-50/60 py-4" : "py-3",
            )}
          >
            {open ? (
              <>
                <label htmlFor={pickerId} className="mb-1.5 block text-xs font-semibold text-neutral-700">
                  Give {role.name} to
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <SearchableSelect
                    id={pickerId}
                    value={picked}
                    onChange={onPick}
                    options={options}
                    autoFocus
                    placeholder={people === null && !peopleError ? "Loading people…" : "Choose a person"}
                    searchPlaceholder="Search by name, job title or email"
                    noOptionsText={
                      peopleError
                        ? "The people list did not load."
                        : people === null
                          ? "Loading people…"
                          : "Everybody with an employee record already holds this role."
                    }
                    emptyText="Nobody by that name without this role."
                    disabled={people === null || busy !== null}
                    aria-invalid={giveError !== null}
                    aria-describedby={giveError ? giveErrorId : undefined}
                    className="min-w-0 flex-1"
                  />
                  <div className="flex gap-2">
                    <Button
                      icon={giving ? undefined : UserPlus}
                      onClick={onGive}
                      disabled={picked === "" || busy !== null}
                      aria-busy={giving || undefined}
                      className="flex-1 sm:flex-none"
                    >
                      {giving && <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden />}
                      {giving ? "Giving…" : "Give role"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => onOpen(false)}
                      disabled={giving}
                      aria-label={`Cancel giving ${role.name}`}
                      title="Cancel"
                      className={cx(buttonClass("ghost", "md"), "w-11 px-0")}
                    >
                      <X size={17} aria-hidden />
                    </button>
                  </div>
                </div>
                {giveError && (
                  <p id={giveErrorId} role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] text-error-700">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                    {giveError}
                  </p>
                )}
              </>
            ) : (
              <div className="flex min-h-11 items-center gap-3">
                <p className="min-w-0 flex-1 text-[13px]">
                  {recent && (
                    <span
                      className={cx(
                        "inline-flex items-center gap-1.5 font-medium",
                        recent.kind === "given" ? "text-mint-700" : "text-neutral-600",
                      )}
                    >
                      {recent.kind === "given" ? (
                        <CheckCircle2 size={15} className="shrink-0" aria-hidden />
                      ) : (
                        <UserMinus size={15} className="shrink-0" aria-hidden />
                      )}
                      <span className="truncate">
                        {recent.kind === "given" ? `Given to ${recent.name}` : `Taken from ${recent.name}`}
                      </span>
                    </span>
                  )}
                </p>
                {trigger()}
              </div>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}

function HolderRow({
  role,
  holder,
  busy,
  fresh,
  error,
  onTake,
}: {
  role: HrRole;
  holder: HrRoleHolder;
  busy: string | null;
  fresh: boolean;
  error: string | null;
  onTake: () => void;
}) {
  const taking = busy === `take-${role.id}-${holder.userId}`;
  const errorId = `hr-role-${role.id}-${holder.userId}-error`;
  const reason = holder.automatic ? automaticReason(role, holder) : null;

  let action: React.ReactNode;
  if (reason) {
    action = (
      <Chip hue="slate" icon={reason.label === "From the reporting line" ? Workflow : ShieldCheck} className="shrink-0">
        {reason.label}
      </Chip>
    );
  } else if (holder.employeeId === null) {
    action = <span className="shrink-0 text-xs text-neutral-500">No employee record</span>;
  } else {
    action = (
      <button
        type="button"
        onClick={onTake}
        disabled={busy !== null}
        aria-label={`Take ${role.name} from ${holder.name}`}
        aria-describedby={error ? errorId : undefined}
        aria-busy={taking || undefined}
        title={`Take ${role.name} from ${holder.name}`}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {taking ? (
          <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden />
        ) : (
          <UserMinus size={17} aria-hidden />
        )}
      </button>
    );
  }

  return (
    <li
      className={cx(
        "-mx-2 rounded-xl px-2 py-2.5 transition-[background-color,opacity] duration-500",
        taking && "opacity-60",
        fresh && "bg-mint-50",
      )}
    >
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2">
        {/* The name is said once, beside it; the avatar's own sr-only name would repeat it. */}
        <span aria-hidden className="inline-flex">
          <PersonAvatar name={holder.name} size={36} />
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-sm font-semibold text-neutral-900">{holder.name}</p>
          <p className="truncate text-xs text-neutral-500">{holder.email}</p>
        </div>
        {action}
      </div>
      {reason && <p className="sr-only">{reason.detail}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 pl-12 text-[13px] text-error-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </li>
  );
}

/** Four role cards' worth of shape while the first request is in flight. */
function RolesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading roles">
      <div className="mb-4 h-11 w-full max-w-sm animate-pulse rounded-xl bg-neutral-100" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="ws-card p-5">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-100" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
              {Array.from({ length: 3 }, (_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-100" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-neutral-100" />
                </div>
              ))}
            </div>
            <div className="mt-5 ml-auto h-11 w-32 animate-pulse rounded-xl bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
