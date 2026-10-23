"use client";

import { useId, useState } from "react";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { Field, inputClass } from "@/suite/lms/components/ui/ws";
import { RolesPicker } from "./RolesPicker";
import { ApiError, type OrgUserInput } from "@/lib/api/users-client";

/**
 * The one form behind "Add user" and "Edit user".
 *
 * Roles are one list: this organisation's roles, as many as apply. An admin
 * is whoever holds the Organisation admin role (roles redesign, phase 3b), so
 * it is ticked there like any other role; there is no separate Admin/User
 * choice to disagree with it.
 *
 * Refusals come back from the API as field errors (a taken email, your own
 * admin access) or a message (the last admin) and are shown where they belong
 * rather than in a toast that disappears with the reason.
 */

export interface UserFormValues {
  name: string;
  email: string;
  /** Role ids from this organisation. */
  roleIds: string[];
  jobTitle: string;
}

export const EMPTY_USER: UserFormValues = {
  name: "",
  email: "",
  roleIds: [],
  jobTitle: "",
};

export function toInput(v: UserFormValues): OrgUserInput {
  return {
    name: v.name.trim(),
    email: v.email.trim(),
    roleIds: v.roleIds,
    jobTitle: v.jobTitle.trim() || null,
  };
}

export function UserForm({
  initial,
  onSubmit,
  self = false,
  canGrantAdmin = true,
  children,
}: {
  initial: UserFormValues;
  /** Throws an `ApiError` on refusal; the form shows it. */
  onSubmit: (values: UserFormValues) => Promise<void>;
  /** Their own account: nobody takes away their own admin access. */
  self?: boolean;
  /**
   * False for somebody managing users through a custom role: a role carrying
   * Organisation admin or Confidential access is an admin's to give.
   */
  canGrantAdmin?: boolean;
  /** The actions row, given `saving`. */
  children: (state: { saving: boolean }) => React.ReactNode;
}) {
  const uid = useId();
  const [values, setValues] = useState<UserFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setFieldErrors({});
    try {
      await onSubmit(values);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.errors ?? {});
        // A 422 with field errors already says it beside the field; the
        // summary line is for refusals that belong to no single field.
        setMessage(e.errors && Object.keys(e.errors).length > 0 ? "Check the highlighted fields." : e.message);
      } else {
        setMessage("That didn't save. Check your connection and try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const errorFor = (key: string) => fieldErrors[key]?.[0] ?? null;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {message && (
        <p role="alert" className="rounded-xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-700">
          {message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-name`} label="Full name" hint="Required">
          <input
            id={`${uid}-name`}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            required
            autoComplete="off"
            aria-invalid={errorFor("name") ? true : undefined}
            aria-describedby={errorFor("name") ? `${uid}-name-error` : undefined}
            className={inputClass}
          />
          <FieldError id={`${uid}-name-error`} error={errorFor("name")} />
        </Field>
        <Field id={`${uid}-email`} label="Work email" hint="Required">
          <input
            id={`${uid}-email`}
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            required
            autoComplete="off"
            aria-invalid={errorFor("email") ? true : undefined}
            aria-describedby={errorFor("email") ? `${uid}-email-error` : undefined}
            className={inputClass}
          />
          <FieldError id={`${uid}-email-error`} error={errorFor("email")} />
        </Field>
      </div>

      <Field id={`${uid}-title`} label="Job title" hint="Optional">
        <JobTitlePicker
          mode="name"
          id={`${uid}-title`}
          value={values.jobTitle}
          onChange={(name) => set("jobTitle", name)}
          clearable
          aria-invalid={errorFor("jobTitle") ? true : undefined}
          aria-describedby={errorFor("jobTitle") ? `${uid}-title-error` : undefined}
        />
        <FieldError id={`${uid}-title-error`} error={errorFor("jobTitle")} />
      </Field>

      <fieldset className="space-y-3 rounded-2xl border border-neutral-200/80 p-4 sm:p-5">
        <legend className="px-1 text-[15px] font-semibold text-neutral-900">Roles</legend>

        <p className="text-xs text-neutral-500">
          This organisation&apos;s roles. Pick any that apply, or none. Organisation admin makes them an admin.
        </p>
        <RolesPicker
          roleIds={values.roleIds}
          onChange={(roleIds) => setValues((v) => ({ ...v, roleIds }))}
          canGrantProtected={canGrantAdmin}
          keepOwnAdmin={self}
        />
        <FieldError id={`${uid}-roles-error`} error={errorFor("roleIds")} />
      </fieldset>

      {children({ saving })}
    </form>
  );
}

function FieldError({ id, error }: { id: string; error: string | null }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-error-700">
      {error}
    </p>
  );
}
