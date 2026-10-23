"use client";

import Link from "next/link";
import { ArrowRight, Lock, MessageSquare, PackagePlus, ShieldCheck } from "lucide-react";
import { buttonClass, cx } from "@/components/workspace/kit";
import { useAuth } from "@/lib/auth-store";
import { MODULE_LABEL, isUnreleased, moduleStatus, type SuiteModuleKey } from "@/lib/module-access";
import { isAdminRole, isPlatformPerson } from "@/lib/roles";

/**
 * Who switches a module on, told to the person reading its preview.
 *
 * A module is switched on for an organisation in one of two ways: its admin
 * gets it on Plan & billing (paid online, or requested from the platform owner
 * while online payment is off), or the platform owner activates it by hand.
 * So the panel routes the reader to whichever of those is theirs:
 *
 * - an organisation admin can get it (the primary action, preselected on the
 *   billing page) or raise it with the platform owner — a support ticket with
 *   the request already written;
 * - anybody else is told it is their admin's call;
 * - the platform's own people are pointed at the console where they do it.
 */
export function ModuleActivation({
  module,
  openHref,
  previewOnly = false,
}: {
  module: SuiteModuleKey;
  /** Where the live module starts, for the rare reader for whom it is already on. */
  openHref?: string;
  /**
   * The page is an illustrative preview with no console link of its own (the
   * Finance and Admin preview pages). All five modules are live (owner,
   * 9 October 2026), so this no longer claims the module is unbuilt: an
   * organisation that has it is sent to the real console, and one that does
   * not gets the usual way to switch it on.
   */
  previewOnly?: boolean;
}) {
  const { user } = useAuth();
  const label = MODULE_LABEL[module];
  const org = user?.organisationName ?? "your organisation";
  const active = moduleStatus(user, module) === "active";
  const consoleHref = openHref ?? (previewOnly ? CONSOLE_HREF[module] : undefined);

  if (active && consoleHref) {
    return (
      <Shell tone="ok" icon={ShieldCheck} title={`${label} is switched on for ${org}`}>
        <p>This page shows what the module does. Your organisation already has it.</p>
        <Link href={consoleHref} className={cx(buttonClass("primary", "md"), "mt-4")}>
          Open {label}
          <ArrowRight size={16} aria-hidden />
        </Link>
      </Shell>
    );
  }

  if (previewOnly && isUnreleased(user, module)) {
    return (
      <Shell tone="info" icon={Lock} title={`${label} isn't switched on here yet`}>
        <p>
          Everything below is illustrative, so you can see how {label} works. The platform administrator switches
          it on.
        </p>
      </Shell>
    );
  }

  if (isPlatformPerson(user)) {
    return (
      <Shell tone="info" icon={Lock} title={`${label} is switched on per organisation`}>
        <p>You activate it for an organisation from its Modules tab in the Platform console.</p>
        <Link href="/suite/platform/organisations" className={cx(buttonClass("primary", "md"), "mt-4")}>
          Open organisations
          <ArrowRight size={16} aria-hidden />
        </Link>
      </Shell>
    );
  }

  if (isAdminRole(user)) {
    const subject = `Please activate ${label} for ${org}`;
    return (
      <Shell tone="info" icon={Lock} title={`${label} isn't switched on for ${org}`}>
        <p>
          Get it on Plan &amp; billing, where you&apos;ll see the price, and it switches on for everyone in {org}. Or ask
          the platform administrator to activate it for you.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/suite/org/billing?module=${module}`} className={buttonClass("primary", "md")}>
            <PackagePlus size={16} aria-hidden />
            Get {label}
          </Link>
          <Link href={`/support?to=platform&subject=${encodeURIComponent(subject)}`} className={buttonClass("secondary", "md")}>
            <MessageSquare size={16} aria-hidden />
            Contact your platform administrator
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell tone="info" icon={Lock} title={`${label} isn't switched on for ${org}`}>
      <p>
        You can look around this preview. To use {label}, ask your organisation&apos;s admin — they can get it on
        Plan &amp; billing or request it from the platform administrator.
      </p>
    </Shell>
  );
}

/** Each module's real console, for a preview page that has no link of its own. */
const CONSOLE_HREF: Record<SuiteModuleKey, string> = {
  lms: "/suite/lms",
  hrm: "/suite/hrm",
  projects: "/suite/projects",
  finance: "/suite/finance",
  admin: "/suite/operations",
};

function Shell({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "info" | "ok";
  icon: typeof Lock;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cx(
        "flex flex-col gap-4 rounded-[1.25rem] border p-5 sm:flex-row sm:items-start sm:p-6",
        tone === "ok" ? "border-mint-100 bg-mint-50/60" : "border-info-500/25 bg-info-500/5",
      )}
    >
      <span
        className={cx(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          tone === "ok" ? "bg-mint-500 text-white" : "bg-info-600 text-white",
        )}
        aria-hidden
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-base font-bold tracking-tight text-neutral-900">{title}</h2>
        <div className="mt-1">{children}</div>
      </div>
    </section>
  );
}
