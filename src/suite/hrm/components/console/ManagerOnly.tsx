"use client";

import { usePathname } from "next/navigation";
import { ShieldAlert, UserRound } from "lucide-react";
import { ButtonLink, Card, Empty } from "@/components/workspace/kit";
import { useAuth } from "@/lib/auth-store";
import { isTeamPage, mayOpenHrmPage } from "@/suite/hrm/lib/hrm-access";

/**
 * Wraps an HR management page: the HR manager's, and any HR custom role's
 * that holds a key of the feature the page answers to (S7, 2 Oct 2026).
 *
 * Which features a page answers to is read from its path
 * (`hrmFeaturesFor` in `@/suite/hrm/lib/hrm-access`), the same table the nav
 * uses; pass `features` to say it explicitly. A Recruiter opens Recruitment and
 * not Payroll, because those are the calls their role is let through on.
 *
 * It renders an explanation rather than redirecting. A redirect from a link
 * somebody was sent is indistinguishable from a broken link, and leaves them
 * with nothing to do about it; naming what is missing tells them who to ask.
 *
 * This is presentation. `access:hrm` on the API is the actual gate, and
 * a hand-typed URL gets a 403 from it whatever this component decides, so the
 * two can never disagree in the direction that matters.
 */
export default function ManagerOnly({
  children,
  features,
}: {
  children: React.ReactNode;
  /** HRM feature keys (e.g. `["recruitment"]`) that open this page. Defaults to the path's. */
  features?: readonly string[];
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname() ?? "";

  // Nothing at all until the session resolves. Flashing the refusal at somebody
  // who *is* the HR manager is worse than a blank moment.
  if (loading) return null;

  if (!mayOpenHrmPage(user, pathname, features)) {
    // My team (S9) is opened by having reports, not by a role.
    const team = isTeamPage(pathname);

    return (
      <Card>
        <Empty
          icon={ShieldAlert}
          hue="sun"
          title={team ? "My team is for line managers" : "Your roles don't open this HR page"}
          hint={
            team
              ? "It opens once someone reports to you. HR sets who reports to whom on each person's record, under Reports to."
              : "The HR Management Lead role opens every HR page. Other HR roles open the pages for what they cover. Ask your organisation's administrator, or whoever runs HR from the HR roles board, to give you a role."
          }
          action={
            <ButtonLink href="/suite/hrm/me" variant="primary" icon={UserRound}>
              My employment
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  return <>{children}</>;
}
