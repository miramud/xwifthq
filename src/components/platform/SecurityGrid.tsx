import {
  Archive,
  Building2,
  Lock,
  Palette,
  Repeat,
  ScrollText,
  ShieldCheck,
  KeyRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Eight statements about how the platform is built, not eight reassurances.
 *
 * Every card names a mechanism — where the boundary is enforced, where the
 * token lives, what a retried payment does — because "enterprise-grade
 * security" is a phrase and "the token never reaches browser JavaScript" is a
 * fact somebody can check.
 *
 * All eight tiles are teal. This is a suite-level section: it belongs to the
 * platform rather than to any one module, so no product hue appears.
 */

interface Control {
  icon: LucideIcon;
  title: string;
  body: string;
}

const CONTROLS: Control[] = [
  {
    icon: Building2,
    title: "Multi-tenancy and isolation",
    body: "Every record in every module is scoped to an organisation. The boundary is enforced in the API rather than in the interface, so a request that escapes its scope fails at the source rather than being hidden by a filter.",
  },
  {
    icon: ShieldCheck,
    title: "Roles and delegated authority",
    body: "Roles are shared across the suite, and your approval workflows decide who may approve what and up to which amount. Delegation is recorded, and high-value approvals ask for a second sign-in check.",
  },
  {
    icon: ScrollText,
    title: "One audit trail",
    body: "Every mutation writes the actor, the record and the time to the same log. Evidence for a policy attestation and evidence for a ledger posting are the same query against the same table.",
  },
  {
    icon: Archive,
    title: "Residency and retention",
    body: "Documents and records carry the statutory period they belong to, and disposal runs against a retention schedule rather than happening by accident. What was kept, and why, is answerable.",
  },
  {
    icon: Lock,
    title: "Encrypted in transit and at rest",
    body: "Traffic is TLS end to end and stored data is encrypted at rest. Credentials for third-party channels are write-only: an owner configures them and no response ever returns them.",
  },
  {
    icon: KeyRound,
    title: "The session model",
    body: "The API token lives in an httpOnly cookie set by the Next.js layer and never reaches browser JavaScript. A script injected into the page cannot read a token it cannot see.",
  },
  {
    icon: Repeat,
    title: "Idempotent money transitions",
    body: "A payment or a posting that is retried lands once. Financial state changes are keyed so a duplicated request is recognised as the same request rather than applied a second time.",
  },
  {
    icon: Palette,
    title: "Per-organisation branding",
    body: "Logo and accent colour per organisation, with the contrast check running as the administrator types. An accent too pale to read never reaches the people who would have to read it.",
  },
];

export function SecurityGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {CONTROLS.map((control) => {
        const Glyph = control.icon;

        return (
          <div
            key={control.title}
            className="xw-tile p-6"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]">
              <Glyph className="h-5 w-5 text-primary-600" aria-hidden="true" />
            </span>
            <h3 className="xw-h3 mt-5 text-base">
              {control.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {control.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
