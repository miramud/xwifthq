"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/workspace/kit";
import { UserPlus, Search, Check, X, TriangleAlert, Mail, Plus } from "lucide-react";
import { ApiError, type AssignmentInvite } from "@/lib/api/saas-client";

export interface AssignableStudent {
  id: string;
  name: string;
  email: string;
  initials?: string;
}

/**
 * Picks learners and grants them something — a course or a whole path.
 *
 * The interaction that matters here is selection at scale. An institution
 * assigning onboarding does it to a cohort, not to one person, so:
 *
 *  • Search filters, and "select all" applies to the *filtered* set, which is
 *    how someone selects a cohort by typing part of its name.
 *  • The count is always visible in the confirm button, because "assign to 34
 *    learners" is a different decision from "assign to 3".
 *  • Rows are labels wrapping a real checkbox, so the whole row is a target and
 *    the control is keyboard-navigable and announced correctly.
 *
 * **Somebody who has no account yet.** An address — and, optionally, the
 * person's name — can be typed in under the search and added to the list. The
 * API creates the account as a User and sends one welcome email with a
 * temporary password, the sign-in link and the link to what was assigned — so
 * there is no separate create-user step to remember, and no half-made account
 * left behind if the assignment fails. An address that already has an account
 * is assigned to and is *not* sent new credentials.
 *
 * The outcome is reported per learner rather than as a bare success: newly
 * assigned, already held, newly invited, and — by name, with the reason —
 * everybody who was skipped, so a seat limit or a typo is never a silent miss.
 *
 * **Who already has it.** `held` names everybody already on the course or
 * path, with the badge to show (Assigned, Self-enrolled…). Those rows are
 * ticked and locked, sorted below the people who can still be picked, and
 * "select all" passes over them — so nobody is assigned twice by accident and
 * the admin can see at a glance who is still outstanding.
 */

export interface AssignResult {
  assigned: number;
  alreadyHeld?: number;
  invited?: number;
  skipped?: { who: string; reason: string }[];
}
export default function AssignDialog({
  title,
  subtitle,
  students,
  loading = false,
  onAssign,
  onClose,
  subject = "course",
  held,
}: {
  title: string;
  subtitle?: string;
  students: AssignableStudent[];
  loading?: boolean;
  onAssign: (recipients: { studentIds: string[]; emails: AssignmentInvite[] }) => Promise<AssignResult>;
  onClose: () => void;
  /** What is being assigned, for the copy: "this course" / "this learning path". */
  subject?: "course" | "learning path";
  /** Learner id → badge text, for everybody who already has it. */
  held?: ReadonlyMap<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invites, setInvites] = useState<AssignmentInvite[]>([]);
  const [inviteDraft, setInviteDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AssignResult | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const isHeld = (id: string) => held?.has(id) ?? false;

  // People who can still be picked first; those who already have it after.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? students.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      : students;
    if (!held || held.size === 0) return matched;
    return [...matched.filter((s) => !held.has(s.id)), ...matched.filter((s) => held.has(s.id))];
  }, [students, query, held]);

  const selectable = useMemo(() => filtered.filter((s) => !held?.has(s.id)), [filtered, held]);
  const heldCount = useMemo(() => students.filter((s) => held?.has(s.id)).length, [students, held]);

  const allFilteredSelected =
    selectable.length > 0 && selectable.every((s) => selected.has(s.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      if (isHeld(id)) return prev;
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

  // Applies to what is on screen, so typing a cohort name then "select all"
  // selects that cohort rather than the whole institution.
  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        selectable.forEach((s) => next.delete(s.id));
      } else {
        selectable.forEach((s) => next.add(s.id));
      }
      return next;
    });

  /*
    Validated here as well as server-side. Not for security — the API refuses a
    bad address regardless — but so that a typo is caught while the admin is
    still looking at it, rather than coming back as one failed row inside a
    bulk result.
  */
  function addInvite() {
    const email = inviteDraft.trim().toLowerCase();

    if (email === "") return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("That does not look like an email address.");
      return;
    }

    if (invites.some((i) => i.email === email)) {
      setInviteError("Already on the list.");
      return;
    }

    // Somebody who already has an account should be ticked in the list above,
    // not invited again — saying so is clearer than silently de-duplicating.
    const existing = students.find((s) => s.email.toLowerCase() === email);

    if (existing !== undefined && isHeld(existing.id)) {
      setInviteError(`${existing.name} already has this ${subject}.`);
      return;
    }

    if (existing !== undefined) {
      setSelected((prev) => new Set(prev).add(existing.id));
      setInviteDraft("");
      setNameDraft("");
      setInviteError(null);
      return;
    }

    const name = nameDraft.trim();
    setInvites((prev) => [...prev, name === "" ? { email } : { email, name }]);
    setInviteDraft("");
    setNameDraft("");
    setInviteError(null);
  }

  const total = selected.size + invites.length;

  async function submit() {
    if (total === 0 || saving) return;

    setSaving(true);
    setError(null);

    try {
      setDone(await onAssign({ studentIds: [...selected], emails: invites }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete the assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={() => !saving && onClose()}
        className="fixed inset-0 cursor-default bg-neutral-900/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        className="relative mt-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.375rem] sm:mb-auto bg-white shadow-2xl sm:rounded-[1.375rem]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
          <div className="min-w-0">
            <h2 id="assign-title" className="text-lg font-semibold text-neutral-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-neutral-500">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-50">
              <Check className="h-6 w-6 text-mint-700" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-neutral-900">
              {done.assigned} learner{done.assigned === 1 ? "" : "s"} assigned
            </p>
            {(done.alreadyHeld ?? 0) > 0 && (
              <p className="mt-1.5 text-sm text-neutral-500">
                {done.alreadyHeld} already had it — nothing was changed for them.
              </p>
            )}
            {(done.invited ?? 0) > 0 && (
              <p className="mt-1.5 text-sm text-neutral-500">
                {done.invited} new account{done.invited === 1 ? " was" : "s were"} created and sent a
                welcome email with a temporary password, the sign-in link and the link to this {subject}.
              </p>
            )}
            {(done.skipped?.length ?? 0) > 0 && (
              <div className="mt-5 rounded-2xl border border-sun-100 bg-sun-50 p-4 text-left">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-sun-700">
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {done.skipped!.length} not assigned
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {done.skipped!.map((s, i) => (
                    <li key={`${s.who}-${i}`} className="text-neutral-700">
                      <span className="break-all font-semibold">{s.who}</span>
                      <span className="text-neutral-500"> — {s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" onClick={onClose} className={`${buttonClass("primary")} mt-6`}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-neutral-200 p-5 pb-3">
              <label htmlFor="assign-search" className="sr-only">
                Search learners
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <input
                  id="assign-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email"
                  className="h-11 w-full rounded-xl border border-neutral-200 pl-10 pr-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                />
              </div>

              {filtered.length > 0 && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  {selectable.length > 0 ? (
                    <button
                      type="button"
                      onClick={toggleAllFiltered}
                      className="text-sm font-semibold text-primary-700 hover:text-primary-800"
                    >
                      {allFilteredSelected ? "Clear selection" : `Select all ${selectable.length}`}
                    </button>
                  ) : (
                    <p className="text-sm text-neutral-500">Everyone listed already has it.</p>
                  )}
                  <p className="text-right text-xs text-neutral-500" aria-live="polite">
                    {total} selected
                    {heldCount > 0 && ` · ${heldCount} already ${heldCount === 1 ? "has" : "have"} it`}
                  </p>
                </div>
              )}

              {/* Add somebody who has no account yet. */}
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-3.5">
                <label
                  htmlFor="assign-invite"
                  className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Not on the platform yet?
                </label>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Add their email, and their name if you know it. We&apos;ll create their account and
                  send one welcome email with a temporary password, the sign-in link and the link to
                  this {subject}.
                </p>

                <label htmlFor="assign-invite-name" className="sr-only">
                  Their name (optional)
                </label>
                <input
                  id="assign-invite-name"
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInvite();
                    }
                  }}
                  placeholder="Their name (optional)"
                  autoComplete="off"
                  className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                />
                <div className="mt-2 flex gap-2">
                  <input
                    id="assign-invite"
                    type="email"
                    value={inviteDraft}
                    onChange={(e) => {
                      setInviteDraft(e.target.value);
                      setInviteError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addInvite();
                      }
                    }}
                    placeholder="name@organisation.com"
                    aria-describedby={inviteError !== null ? "assign-invite-error" : undefined}
                    aria-invalid={inviteError !== null}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  />
                  <button
                    type="button"
                    onClick={addInvite}
                    disabled={inviteDraft.trim() === ""}
                    className={`${buttonClass("secondary", "sm")} !h-10 shrink-0`}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add
                  </button>
                </div>

                {inviteError !== null && (
                  <p id="assign-invite-error" role="alert" className="mt-1.5 text-xs text-error-700">
                    {inviteError}
                  </p>
                )}

                {invites.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-1.5">
                    {invites.map(({ email, name }) => (
                      <li key={email} className="max-w-full">
                        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50 py-1 pl-2.5 pr-1 text-xs font-medium text-sky-700">
                          <span className="min-w-0 truncate">{name ? `${name} · ${email}` : email}</span>
                          <button
                            type="button"
                            onClick={() => setInvites((prev) => prev.filter((i) => i.email !== email))}
                            aria-label={`Remove ${email}`}
                            className="rounded-full p-0.5 text-neutral-500 transition-colors hover:bg-neutral-900/10 hover:text-neutral-800"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-2 p-5" role="status" aria-busy="true">
                  <span className="sr-only">Loading learners</span>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-2xl bg-neutral-100 motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-neutral-500">
                  {students.length === 0
                    ? "No learners in this organisation yet — add one by email above."
                    : "No learners match that search. You can still add someone by email above."}
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {filtered.map((student) => {
                    const badge = held?.get(student.id);
                    return (
                    <li key={student.id}>
                      <label
                        title={badge ? `Already has this ${subject}` : undefined}
                        className={
                          badge
                            ? "flex cursor-not-allowed items-center gap-3 bg-neutral-50/70 px-5 py-3"
                            : "flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-primary-50/40 has-[:checked]:bg-primary-50/60"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={badge !== undefined || selected.has(student.id)}
                          disabled={badge !== undefined}
                          onChange={() => toggle(student.id)}
                          aria-describedby={badge ? `held-${student.id}` : undefined}
                          className="h-4 w-4 shrink-0 rounded border-neutral-300 accent-primary-600 focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                          {student.initials ?? student.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-neutral-900">
                            {student.name}
                          </span>
                          <span className="block truncate text-xs text-neutral-500">
                            {student.email}
                          </span>
                        </span>
                        {badge && (
                          <span
                            id={`held-${student.id}`}
                            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-mint-50 px-2 py-0.5 text-[11px] font-semibold text-mint-700"
                          >
                            <Check className="h-3 w-3" aria-hidden="true" />
                            {badge}
                          </span>
                        )}
                      </label>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-neutral-200 p-5">
              {error && (
                <p
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded-xl bg-error-500/5 px-3 py-2.5 text-sm text-error-700"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={total === 0 || saving}
                className={`${buttonClass("primary")} w-full`}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {saving
                  ? "Assigning…"
                  : total === 0
                    ? "Select learners to assign"
                    : `Assign to ${total} learner${total === 1 ? "" : "s"}`}
              </button>

              {invites.length > 0 && !saving && (
                <p className="mt-2 text-center text-[11px] text-neutral-500">
                  {invites.length} of them will be sent an invitation.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
