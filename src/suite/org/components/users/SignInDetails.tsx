"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/workspace/kit";
import { Dialog } from "@/suite/hrm/components/console/Dialog";

/**
 * The one-time sign-in details for an invited user.
 *
 * The API returns a temporary password alongside the invitation email so an
 * admin can still get somebody in when mail isn't configured. It is shown
 * exactly once (the server keeps only the hash), so this panel says so, and
 * offers a copy button rather than asking anybody to transcribe it.
 */
export function SignInDetails({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${password}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-3 rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-700">
        <KeyRound size={18} className="mt-0.5 shrink-0" aria-hidden />
        We&apos;ve emailed them a sign-in link. If the email doesn&apos;t arrive, share these details instead. The
        password is shown only now, and they&apos;ll be asked to change it when they first sign in.
      </p>
      <dl className="grid gap-3 rounded-2xl border border-primary-100 bg-primary-50/40 p-4 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-neutral-500">Email</dt>
        <dd className="break-all text-neutral-900">{email}</dd>
        <dt className="font-semibold text-neutral-500">Temporary password</dt>
        <dd className="break-all font-mono text-neutral-900">{password}</dd>
      </dl>
      <div aria-live="polite">
        <Button icon={copied ? Check : Copy} onClick={copy}>
          {copied ? "Copied" : "Copy sign-in details"}
        </Button>
      </div>
    </div>
  );
}

/** The same details after "Resend invite", in a dialog of their own. */
export function SignInDetailsDialog({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Dialog title="Invitation sent again" subtitle={`A fresh sign-in link is on its way to ${email}.`} onClose={onClose}>
      <SignInDetails email={email} password={password} />
      <div className="mt-5 flex justify-end border-t border-neutral-100 pt-4">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
