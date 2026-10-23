"use client";

import { useId, useState } from "react";
import { Button } from "@/components/workspace/kit";
import { textareaClass, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { plainError } from "@/lib/api/finance-payments-client";

/**
 * A dialog that asks for one thing - a reason, or a bank reference - and
 * does the action with it. The error stays in the dialog, beside the field,
 * so nothing typed is lost when the API refuses.
 */
export default function ReasonDialog({
  title,
  subtitle,
  label,
  hint,
  confirmLabel,
  busyLabel,
  tone = "primary",
  single = false,
  maxLength = 500,
  placeholder,
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle?: React.ReactNode;
  label: string;
  hint?: string;
  confirmLabel: string;
  busyLabel: string;
  tone?: "primary" | "danger";
  /** A one-line input (a reference) rather than a text area (a reason). */
  single?: boolean;
  maxLength?: number;
  placeholder?: string;
  onConfirm: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const uid = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError(`${label} is needed.`);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(text.trim());
    } catch (err) {
      setError(plainError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep as it is</Button>
          <Button type="submit" variant={tone} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      }
    >
      <div>
        <label htmlFor={`${uid}-text`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          {label}
        </label>
        {single ? (
          <input
            id={`${uid}-text`}
            value={text}
            maxLength={maxLength}
            autoFocus
            autoComplete="off"
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${uid}-err` : hint ? `${uid}-hint` : undefined}
            className={`${inputClass} font-mono`}
          />
        ) : (
          <textarea
            id={`${uid}-text`}
            value={text}
            rows={3}
            maxLength={maxLength}
            autoFocus
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${uid}-err` : hint ? `${uid}-hint` : undefined}
            className={textareaClass}
          />
        )}
        {hint && !error && (
          <p id={`${uid}-hint`} className="mt-1.5 text-xs text-neutral-500">
            {hint}
          </p>
        )}
        <FieldError id={`${uid}-err`} message={error} />
      </div>
    </DialogFrame>
  );
}
