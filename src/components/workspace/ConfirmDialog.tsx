"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, Trash2, type LucideIcon } from "lucide-react";
import { buttonClass, cx } from "./kit";

/**
 * The one confirmation every destructive action in the suite goes through.
 *
 * The owner's rule (26 Sep 2026): nothing is deleted on a single click.
 * `useConfirm()` returns a function that opens this dialog and resolves to
 * `true` only when somebody presses the confirm button, so a delete handler
 * reads as one guard line:
 *
 *     if (!(await confirm({ title: "Delete this course?", recoverable: true }))) return;
 *
 * `recoverable` says where the thing goes. A record lands in the organisation's
 * recycle bin and the dialog says so; a revocation, a dismissal or a wiped
 * secret does not, and the dialog says that instead. Telling somebody the
 * truth about undo is the point of asking them at all.
 *
 * Focus starts on Cancel, not on the destructive button: Enter pressed out of
 * habit should keep the data. Escape and the backdrop also cancel, and focus
 * goes back to whatever opened the dialog.
 */

export interface ConfirmOptions {
  title: string;
  /** What will happen, in a sentence. Defaults to a line built from `recoverable`. */
  body?: React.ReactNode;
  /** Defaults to "Delete". Name the action: "Remove", "Revoke", "Delete permanently". */
  confirmLabel?: string;
  /** True when the item goes to the recycle bin and can be restored. */
  recoverable?: boolean;
  /** "danger" (default) for removals; "primary" for a confirm that loses nothing. */
  tone?: "danger" | "primary";
  /** Overrides the tone's icon: a reversible, routine confirm need not wear a warning triangle. */
  icon?: LucideIcon;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
      opener.current?.focus();
    },
    [pending],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialogView options={pending} onSettle={settle} />}
    </ConfirmContext.Provider>
  );
}

/**
 * Opens the confirmation dialog.
 *
 * Under `ConfirmProvider` (the root layout provides it for every page) the
 * dialog renders in the app's tree. Without one — a component rendered on its
 * own, as the unit tests do — it mounts a dialog of its own for the one
 * question, so a missing provider can never turn a delete into a crash or,
 * worse, into a delete that skips the question.
 */
export function useConfirm(): Confirm {
  return useContext(ConfirmContext) ?? confirmDetached;
}

function confirmDetached(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const host = document.createElement("div");
    // Marked so a test run can clear a question nobody answered.
    host.setAttribute("data-confirm-host", "");
    document.body.appendChild(host);
    const root = createRoot(host);
    const settle = (ok: boolean) => {
      resolve(ok);
      // Unmounted after the click that settled it has finished propagating.
      queueMicrotask(() => {
        root.unmount();
        host.remove();
        opener?.focus();
      });
    };
    root.render(<ConfirmDialogView options={options} onSettle={settle} />);
  });
}

function ConfirmDialogView({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (ok: boolean) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const tone = options.tone ?? "danger";
  const Icon = options.icon ?? (tone === "danger" ? Trash2 : AlertTriangle);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSettle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSettle]);

  const body =
    options.body ??
    (options.recoverable
      ? "It moves to the organisation's recycle bin, where an admin can restore it."
      : "This can't be undone.");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain bg-neutral-900/45 p-4 backdrop-blur-[2px] animate-fade-in"
      onClick={(event) => {
        if (event.target === event.currentTarget) onSettle(false);
      }}
    >
      {/*
        The dialog renders beside the page rather than inside a module's
        WorkspaceShell, so it opts into the workspace tokens itself with `ws`.
        `.ws` also paints the canvas colour as unlayered CSS, which beats a
        utility class, hence the white set inline.
      */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        style={{ background: "white" }}
        className="ws mt-auto w-full max-w-md rounded-[1.25rem] sm:mb-auto p-6 shadow-2xl shadow-neutral-900/15"
      >
        <div className="flex items-start gap-4">
          <span
            className={cx(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              tone === "danger" ? "bg-error-500/10 text-error-600" : "bg-primary-50 text-primary-600",
            )}
            aria-hidden
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-title" className="text-lg font-bold tracking-tight text-neutral-900">
              {options.title}
            </h2>
            <div id="confirm-body" className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              {body}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onSettle(false)}
            className={buttonClass("secondary", "md")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSettle(true)}
            className={buttonClass(tone === "danger" ? "danger" : "primary", "md")}
          >
            {options.confirmLabel ?? "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
