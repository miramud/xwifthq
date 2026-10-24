"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Save, Users } from "lucide-react";
import { Button, ButtonLink, Card, Empty, PageHeader } from "@/components/workspace/kit";
import { useAuth } from "@/lib/auth-store";
import { ApiError, managesAdmins, users, type OrgUserDetail } from "@/lib/api/users-client";
import { BackLink, Skeleton } from "@/suite/lms/components/ui/ws";
import { UserForm, toInput, type UserFormValues } from "./UserForm";

/**
 * Editing a user: the same form as adding one, filled in.
 *
 * The API decides what may change (it refuses demoting the last admin, and
 * refuses taking away your own admin access), and the form shows its reason
 * beside the field. Your own admin role is also locked here up front, so the
 * refusal is the backstop rather than the first you hear of the rule.
 */
export default function EditUser({ id }: { id: string }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const [account, setAccount] = useState<OrgUserDetail | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
      .catch(
        (e: unknown) =>
          alive &&
          setError({
            status: e instanceof ApiError ? e.status : 0,
            message: e instanceof ApiError ? e.message : "This user didn't load.",
          }),
      )
      .finally(() => alive && setSettledKey(requestKey));
    return () => {
      alive = false;
    };
  }, [id, reloadKey, requestKey]);

  const back = `/suite/org/users/${id}`;

  if (loading) {
    return (
      <div>
        <BackLink href={back} label="Back to profile" />
        <p className="sr-only">Loading user…</p>
        <Skeleton className="h-[520px]" />
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
            title={error?.status === 404 ? "This user isn't here." : "This user didn't load."}
            hint={error?.status === 404 ? "They may have been deleted." : error?.message}
            hue="coral"
            action={
              error?.status === 404 ? (
                <ButtonLink href="/suite/org/users" size="sm">
                  Back to users
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

  const initial: UserFormValues = {
    name: account.name,
    email: account.email,
    roleIds: account.roles.filter((r) => r.kind === "custom").map((r) => r.id),
    jobTitle: account.jobTitle ?? "",
  };
  const self = me?.id === account.id;

  if (account.role === "admin" && !managesAdmins(me?.role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <BackLink href={back} label="Back to profile" />
        <PageHeader eyebrow="User management" title={`Edit ${account.name}`} />
        <div className="ws-card flex items-start gap-4 p-5 text-sm text-neutral-600 sm:p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-grape-50 text-grape-700" aria-hidden>
            <Lock size={18} />
          </span>
          <p className="pt-2">{account.name} is an admin. Only an admin can change an admin&apos;s details or roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href={back} label="Back to profile" />
      <PageHeader eyebrow="User management" title={`Edit ${account.name}`} subtitle="Changes apply as soon as you save them." />
      <div className="ws-card p-5 sm:p-6">
        <UserForm
          initial={initial}
          self={self}
          canGrantAdmin={managesAdmins(me?.role)}
          onSubmit={async (values) => {
            await users.update(account.id, toInput(values));
            router.push(back);
          }}
        >
          {({ saving }) => (
            <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
              <ButtonLink href={back}>Cancel</ButtonLink>
              <Button type="submit" variant="primary" icon={Save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </UserForm>
      </div>
    </div>
  );
}
