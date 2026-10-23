import SuiteHomeShell from "@/components/suite/SuiteHomeShell";

/**
 * The launcher and the modules that are not built yet.
 *
 * A route group, so /suite and /suite/admin keep their URLs while the built
 * consoles — /suite/lms, /suite/org, /suite/hrm, /suite/projects and
 * /suite/finance — sit outside this group with shells of their own. Without
 * the group, this shell would wrap theirs and every console would carry two
 * sets of chrome.
 *
 * Authentication is handled once by the parent /suite layout. There is no role
 * check here on purpose: the previews read no API, and seeing what a module
 * does is not a privilege. Each preview page renders its own PreviewBanner.
 */
export default function SuitePreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SuiteHomeShell>{children}</SuiteHomeShell>;
}
