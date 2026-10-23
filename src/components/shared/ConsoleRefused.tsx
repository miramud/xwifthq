import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * What somebody sees when they open a console their role does not reach.
 *
 * The console layouts used to redirect to `/?error=admin-only`, which nothing
 * reads, so a member who followed a link to /suite/org landed on the
 * marketing home page with no idea why. This says what happened and sends
 * them to their own landing page instead.
 *
 * Rendered by the layouts on the server, before any of the console renders.
 * With `inline` it is one page of a console somebody *is* in - a custom-role
 * holder (S8) on a page their keys do not reach - so it sits inside the shell
 * and says the page, not the console, is out of reach. The API refuses
 * regardless.
 */
export default function ConsoleRefused({
  console: name,
  who,
  home,
  inline = false,
}: {
  /** "Organisation console", "Platform console". */
  console: string;
  /** Who it is for, as a phrase: "your organisation's admins". */
  who: string;
  /** Where this person normally lands. */
  home: string;
  /** One page of a console they are in, rendered inside its shell. */
  inline?: boolean;
}) {
  const Wrapper = inline ? "div" : "main";

  return (
    <Wrapper
      className={
        inline
          ? "flex justify-center px-4 py-16"
          : "flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-12"
      }
    >
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm"
      >
        <ShieldAlert aria-hidden className="mx-auto mb-3 text-sun-700" size={28} />
        {inline ? (
          <>
            <h1 className="text-lg font-semibold text-neutral-900">Your roles don&apos;t open this page</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              They open other parts of the {name}; the menu shows which. If you need this page, ask one of {who}.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-neutral-900">The {name} is for {who}</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Your account doesn&apos;t have access to it. If you need something changed here, ask one of
              {" "}
              {who}.
            </p>
          </>
        )}
        <Link
          href={home}
          className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-white outline-none hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          Go to my workspace
        </Link>
      </div>
    </Wrapper>
  );
}
