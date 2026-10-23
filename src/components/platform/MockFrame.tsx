import { HUE, type ProductHue } from "@/lib/products";

/**
 * The frame every hand-drawn product mock sits in.
 *
 * All five product pages share it so their mocks read as five screens of one
 * product rather than five screenshots from five tools. The mocks themselves
 * are JSX — simplified, in-brand, obviously drawn. Nothing here is a real
 * screenshot and the frame never pretends otherwise.
 *
 * The chrome is `aria-hidden` because a title bar and three dots are furniture,
 * not content. What goes inside decides its own semantics: a mock that is pure
 * decoration should hide itself, and one that carries a real figure should
 * describe itself.
 */
export function MockFrame({
  label,
  hue,
  children,
  className = "",
}: {
  label: string;
  hue: ProductHue;
  children: React.ReactNode;
  className?: string;
}) {
  const tokens = HUE[hue];

  return (
    <div
      className={`xw-frame overflow-hidden ${className}`}
    >
      <div
        className="flex items-center gap-3 border-b border-neutral-100 bg-white px-4 py-2.5"
        aria-hidden="true"
      >
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-neutral-100 px-3 py-1">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tokens.rule}`} />
          <span className="truncate text-[11px] font-medium text-neutral-500">{label}</span>
        </span>
      </div>

      <div className="bg-white p-5">{children}</div>
    </div>
  );
}
