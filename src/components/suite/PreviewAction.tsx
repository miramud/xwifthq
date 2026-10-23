import type { LucideIcon } from "lucide-react";

/**
 * A control the real module has and this preview does not.
 *
 * The alternative — rendering a live-looking button that swallows the click —
 * is the single fastest way to make a preview read as a mock-up. So the button
 * is genuinely `disabled`, styled as disabled, and carries a visible sentence
 * saying why, wired with `aria-describedby` so the reason is announced with
 * the button rather than stranded beside it.
 *
 * The id is derived from the label rather than from `useId`, because deriving
 * it keeps this a Server Component: one hydration boundary saved for a control
 * that can never be pressed.
 */
export function PreviewAction({
  icon: Icon,
  label,
  reason,
}: {
  icon: LucideIcon;
  label: string;
  reason: string;
}) {
  const id = `preview-action-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <span className="flex items-center gap-2.5">
      <button
        type="button"
        disabled
        aria-describedby={id}
        className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-4 text-sm font-semibold text-neutral-500"
      >
        <Icon size={16} aria-hidden="true" />
        {label}
      </button>
      <span id={id} className="max-w-[10rem] text-xs leading-snug text-neutral-500">
        {reason}
      </span>
    </span>
  );
}
