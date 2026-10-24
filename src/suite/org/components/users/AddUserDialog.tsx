"use client";

import { useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/workspace/kit";
import { Dialog } from "@/suite/hrm/components/console/Dialog";
import { useAuth } from "@/lib/auth-store";
import { managesAdmins, users, type OrgUser } from "@/lib/api/users-client";
import { EMPTY_USER, UserForm, toInput } from "./UserForm";
import { SignInDetails } from "./SignInDetails";

/**
 * Adding one user. Nobody types a password for somebody else: the new
 * account gets the platform's set-password email, the same one every
 * invitee receives, and shows as "Invited" until they use it.
 *
 * When the API hands back a one-time temporary password, the dialog stays open
 * on a second step showing it, because closing would lose it for good.
 */
export function AddUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (account: OrgUser) => void;
}) {
  const [created, setCreated] = useState<{ user: OrgUser; password: string } | null>(null);
  const { user: me } = useAuth();

  if (!open) return null;

  if (created) {
    const finish = () => {
      const { user } = created;
      setCreated(null);
      onCreated(user);
    };
    return (
      <Dialog title={`${created.user.name} was added`} subtitle="Their sign-in details, shown once." onClose={finish}>
        <SignInDetails email={created.user.email} password={created.password} />
        <div className="mt-5 flex justify-end border-t border-neutral-100 pt-4">
          <Button variant="primary" onClick={finish}>
            Done
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Add a user" subtitle="They'll join this organisation straight away." onClose={onClose} wide>
      <UserForm
        initial={EMPTY_USER}
        canGrantAdmin={managesAdmins(me?.role)}
        onSubmit={async (values) => {
          const { user, temporaryPassword } = await users.create(toInput(values));
          if (temporaryPassword) setCreated({ user, password: temporaryPassword });
          else onCreated(user);
        }}
      >
        {({ saving }) => (
          <>
            <p className="flex items-start gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
              <Mail size={18} className="mt-0.5 shrink-0" aria-hidden />
              We&apos;ll email them a link to set their own password. Until they do, they show as Invited.
            </p>
            <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
              <Button onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" icon={UserPlus} disabled={saving}>
                {saving ? "Adding…" : "Add user"}
              </Button>
            </div>
          </>
        )}
      </UserForm>
    </Dialog>
  );
}
