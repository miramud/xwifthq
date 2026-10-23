"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Award,
  Briefcase,
  CalendarDays,
  Clock,
  FolderKanban,
  GraduationCap,
  Mail,
  MailCheck,
  Pencil,
  ShieldCheck,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Button, ButtonLink, Card, Empty, Panel, Progress, StatGrid } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { useAuth } from "@/lib/auth-store";
import { formatDate, timeAgo } from "@/lib/console-data";
import { assignments } from "@/lib/api/saas-client";
import { ApiError, managesAdmins, users, type OrgUserDetail } from "@/lib/api/users-client";
import { permissions as permissionsApi, type Catalogue } from "@/lib/api/roles-client";
import { EffectivePermissions, SELF_SERVICE_ONLY } from "../roles/PermissionMatrix";
import {
  BackLink,
  ErrorNote,
  FaceAvatar,
  InfoList,
  InfoRow,
  ListRow,
  Skeleton,
  StatCard,
  StatusChip,
  Timeline,
  humanise,
} from "@/suite/lms/components/ui/ws";
import { RoleChip, RoleChips, StatusPill, extraRoles } from "./usersUi";
import { SignInDetailsDialog } from "./SignInDetails";
import { auditActionSentence, auditSubject } from "../auditLabels";

function progressHue(p: number): Hue {
  return p >= 75 ? "mint" : p >= 40 ? "blue" : "sun";
}

/**
 * One user, everything the organisation knows about them in one place: who
 * they are here, what they do, how their learning is going, their employment
 * record and their projects.
 *
 * Each course row opens that user's view of the course (progress,
 * performance, leaderboard), which the course page's Learners tab also leads
 * to — the same answer from either direction.
 */
export default function UserProfile({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { user: me } = useAuth();

  const [account, setAccount] = useState<OrgUserDetail | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [details, setDetails] = useState<{ email: string; password: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);

  useEffect(() => {
    let alive = true;
    permissionsApi
      .catalogue()
      .then((c) => alive && setCatalogue(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const requestKey = `${id}:${reloadKey}`;
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let alive = true;
    users
      .get(id)
      .then((p) => {
        if (!alive) return;
        setAccount(p);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof ApiError ? e.message : "This user didn't load.");
      })
      .finally(() => alive && setSettledKey(requestKey));
    return () => {
      alive = false;
    };
  }, [id, reloadKey, requestKey]);

  const self = me?.id === id;
  // Somebody managing users through a custom role can't touch an admin.
  const locked = account?.role === "admin" && !managesAdmins(me?.role);

  const remove = useCallback(async () => {
    if (!account) return;
    const ok = await confirm({
      title: `Delete ${account.name}?`,
      body: (
        <>
          They lose access straight away and move to the organisation&apos;s recycle bin, where an admin can restore
          them with their learning history intact.
        </>
      ),
      confirmLabel: "Delete user",
      recoverable: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await users.remove(account.id);
      router.push("/suite/org/users");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `${account.name} wasn't deleted.`);
    }
  }, [confirm, account, router]);

  const resend = useCallback(async () => {
    if (!account) return;
    setError(null);
    try {
      const { temporaryPassword } = await users.resendInvite(account.id);
      if (temporaryPassword) setDetails({ email: account.email, password: temporaryPassword });
      else setNotice(`Invitation sent again to ${account.email}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The invitation wasn't sent.");
    }
  }, [account]);

  const enableSignIn = useCallback(async () => {
    if (!account) return;
    setError(null);
    try {
      await users.update(account.id, { signInDisabled: false });
      setNotice(`${account.name} can sign in again.`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sign-in wasn't switched back on.");
    }
  }, [account]);

  const withdraw = useCallback(
    async (courseSlug: string, courseTitle: string) => {
      if (!account) return;
      const ok = await confirm({
        title: `Withdraw ${account.name} from ${courseTitle}?`,
        body: "They lose access to the course. Their progress is kept, so assigning it again picks up where they stopped.",
        confirmLabel: "Withdraw",
      });
      if (!ok) return;
      setError(null);
      try {
        await assignments.revokeCourse(courseSlug, account.id);
        setNotice(`${account.name} was withdrawn from ${courseTitle}.`);
        setReloadKey((k) => k + 1);
      } catch (e) {
        setError(e instanceof ApiError || e instanceof Error ? e.message : "That didn't save.");
      }
    },
    [confirm, account],
  );

  if (loading && !account) {
    return (
      <div>
        <BackLink href="/suite/org/users" label="Back to users" />
        <p className="sr-only">Loading user…</p>
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-[140px]" />
          <Skeleton className="h-[360px]" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <BackLink href="/suite/org/users" label="Back to users" />
        <Card>
          <Empty
            icon={Users}
            title="This user isn't here."
            hint="They may have been deleted. Check the recycle bin to restore them."
            action={
              <ButtonLink href="/suite/org/recycle-bin" size="sm">
                Open the recycle bin
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  if (!account) {
    return (
      <div>
        <BackLink href="/suite/org/users" label="Back to users" />
        <Card>
          <Empty
            icon={Users}
            title="This user didn't load."
            hint={error ?? "Try again in a moment."}
            hue="coral"
            action={
              <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const { learning } = account;

  return (
    <div>
      {details && (
        <SignInDetailsDialog email={details.email} password={details.password} onClose={() => setDetails(null)} />
      )}
      <BackLink href="/suite/org/users" label="Back to users" />

      {/* ---------- header ---------- */}
      <section className="ws-card mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <FaceAvatar name={account.name} src={account.avatarUrl} size={64} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">
                {account.name}
                {self && <span className="ml-2 align-middle text-sm font-medium text-neutral-500">(you)</span>}
              </h1>
              <p className="mt-0.5 truncate text-sm text-neutral-500">
                {account.jobTitle ? `${account.jobTitle} · ` : ""}
                {account.email}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <RoleChip role={account.role} label={account.roleLabel} />
                <StatusPill status={account.status} />
                {extraRoles(account).length > 0 && <RoleChips roles={extraRoles(account)} max={6} />}
              </div>
            </div>
          </div>
          {locked ? (
            <p className="max-w-xs text-sm text-neutral-500">Only an admin can edit, delete or re-invite an admin.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {account.status === "invited" && (
                <Button icon={MailCheck} onClick={resend}>
                  Resend invite
                </Button>
              )}
              <ButtonLink href={`/suite/org/users/${account.id}/edit`} variant="primary" icon={Pencil}>
                Edit user
              </ButtonLink>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={remove}
                disabled={self}
                title={self ? "You can't delete your own account. Ask another admin." : undefined}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
        {self && (
          <p className="mt-4 text-xs text-neutral-500">
            You can&apos;t delete your own account or change your own role. Another admin can.
          </p>
        )}
      </section>

      {/*
        A leaver's sign-in is switched off on their leaving date (the owner's
        ruling, 2 Oct 2026). Said here, with the way back, so an admin asked
        "why can't they log in" has the answer on the person's page.
      */}
      {account.signInDisabledAt && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sun-500/25 bg-sun-50 px-4 py-3">
          <p className="text-sm text-sun-700">
            Sign-in switched off on {formatDate(account.signInDisabledAt)}. They can&apos;t sign in until it is switched
            back on.
          </p>
          {!locked && !self && (
            <Button size="sm" onClick={enableSignIn}>
              Switch sign-in back on
            </Button>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && (
        <p className="mb-5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{notice}</p>
      )}
      {error && <ErrorNote className="mb-5">{error}</ErrorNote>}

      {/* ---------- learning at a glance ---------- */}
      <StatGrid cols={4}>
        <StatCard
          featured
          featuredHue="grape"
          label="Courses"
          value={account.stats.enrolments}
          icon={GraduationCap}
          hint={`${account.stats.completed} completed`}
        />
        <StatCard label="Average progress" value={`${account.stats.averageProgress}%`} icon={Activity} hue="mint" />
        <StatCard label="Certificates" value={account.stats.certificates} icon={Award} hue="sun" />
        <StatCard
          label="Points"
          value={learning.points == null ? "-" : learning.points.toLocaleString()}
          icon={Star}
          hue="coral"
          hint={learning.points == null ? "Gamification is off" : undefined}
        />
      </StatGrid>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Learning" subtitle="Every course they hold, and how far they've got" icon={GraduationCap} hue="grape">
            {learning.enrolments.length === 0 ? (
              <Empty
                icon={GraduationCap}
                title="No courses yet."
                hint="Assign a course from its page in the LMS console."
                hue="grape"
                action={
                  <ButtonLink href="/suite/lms/courses" size="sm">
                    Browse courses
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {learning.enrolments.map((e) => {
                  const live = e.status.toLowerCase() !== "completed" && e.status.toLowerCase() !== "cancelled";
                  return (
                    <li key={e.courseSlug} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                      <Link
                        href={`/suite/lms/courses/${e.courseSlug}/learners/${account.id}`}
                        className="group min-w-0 flex-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-700">
                            {e.courseTitle}
                          </span>
                          <StatusChip status={e.status} />
                        </span>
                        <span className="mt-2 block">
                          <Progress value={e.percent} hue={progressHue(e.percent)} size="sm" label={`Progress in ${e.courseTitle}`} />
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-neutral-500">
                          <span>{e.percent}% done</span>
                          {e.quizAverage != null && <span>Quiz average {e.quizAverage}%</span>}
                          <span>
                            {e.completedAt
                              ? `Completed ${formatDate(e.completedAt)}`
                              : e.lastActivityAt
                                ? `Active ${timeAgo(e.lastActivityAt)}`
                                : `Enrolled ${formatDate(e.enrolledAt)}`}
                          </span>
                        </span>
                      </Link>
                      {live && (
                        <Button
                          size="sm"
                          onClick={() => withdraw(e.courseSlug, e.courseTitle)}
                          aria-label={`Withdraw from ${e.courseTitle}`}
                        >
                          Withdraw
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Certificates" icon={Award} hue="sun">
            {learning.certificates.length === 0 ? (
              <p className="py-2 text-sm text-neutral-500">No certificates yet. They&apos;re issued when a course is completed.</p>
            ) : (
              <ul className="space-y-1">
                {learning.certificates.map((c) => (
                  <ListRow
                    key={c.serial}
                    title={c.courseTitle}
                    meta={`Issued ${formatDate(c.issuedAt)} · ${c.serial}`}
                    href={`/suite/lms/certificates/${c.serial}`}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Roles & permissions"
            subtitle={`${account.permissions.length} effective permission${account.permissions.length === 1 ? "" : "s"}`}
            icon={ShieldCheck}
            hue="grape"
          >
            <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Roles held">
              <li>
                <RoleChip role={account.role} label={account.roleLabel} />
              </li>
              {extraRoles(account).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/suite/org/roles/${r.id}`}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300 ${
                      r.kind === "custom" ? "bg-grape-50 text-grape-700" : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
            {catalogue ? (
              <EffectivePermissions catalogue={catalogue} keys={account.permissions} empty={SELF_SERVICE_ONLY} />
            ) : (
              <p className="text-xs text-neutral-500">Loading what these roles allow…</p>
            )}
          </Panel>

          <Panel title="Details" icon={Users}>
            <InfoList>
              <InfoRow icon={Mail} label="Email">
                {account.email}
              </InfoRow>
              <InfoRow icon={Briefcase} label="Job title">
                {account.jobTitle ?? "Not set"}
              </InfoRow>
              <InfoRow icon={CalendarDays} label="Joined">
                {formatDate(account.createdAt)}
              </InfoRow>
              <InfoRow icon={Clock} label="Last active">
                {account.lastActiveAt ? timeAgo(account.lastActiveAt) : "Never signed in"}
              </InfoRow>
            </InfoList>
          </Panel>

          <Panel title="Employment" icon={Briefcase} hue="coral">
            {account.employee ? (
              <ul>
                <ListRow
                  title={account.employee.jobTitle ?? account.jobTitle ?? "Employee"}
                  meta={[account.employee.department, humanise(account.employee.status)].filter(Boolean).join(" · ")}
                  href={`/suite/hrm/people/${account.employee.id}`}
                />
              </ul>
            ) : (
              <p className="py-1 text-sm text-neutral-500">No employment record. HR adds one when somebody is hired.</p>
            )}
          </Panel>

          <Panel title="Projects" icon={FolderKanban} hue="sky">
            {account.projects.length === 0 ? (
              <p className="py-1 text-sm text-neutral-500">Not on any project.</p>
            ) : (
              <ul className="space-y-1">
                {account.projects.map((p) => (
                  <ListRow
                    key={p.slug}
                    title={p.name}
                    meta={humanise(p.role)}
                    href={`/suite/projects/${p.slug}`}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity" icon={Activity} hue="mint">
            {account.recentActivity.length === 0 ? (
              <p className="py-1 text-sm text-neutral-500">Nothing recorded yet.</p>
            ) : (
              <Timeline
                items={account.recentActivity.slice(0, 8).map((a, i) => {
                  const subject = auditSubject(a.meta);
                  return {
                    id: `${a.at}-${i}`,
                    icon: Activity,
                    hue: "mint" as Hue,
                    text: (
                      <>
                        {auditActionSentence(a.action)}
                        {subject && <span className="text-neutral-500"> · {subject}</span>}
                      </>
                    ),
                    when: <span title={formatDate(a.at)}>{timeAgo(a.at)}</span>,
                  };
                })}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
