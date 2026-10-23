import { LogIn } from "lucide-react";
import ErrorState from "@/components/feedback/ErrorState";

/**
 * What a signed-out visitor sees at the address of a course that isn't in the
 * public catalogue.
 *
 * It might be an organisation's private course and they a member who hasn't
 * signed in yet — the link an admin shares from the console lands exactly
 * here — or the course might not exist at all. The page can't tell the two
 * apart without confirming to a stranger that a private course exists, so it
 * says both, and offers the sign-in that resolves it for a member. Signing in
 * brings them straight back to this address.
 */
export default function SignInToViewCourse({ slug }: { slug: string }) {
  const back = `/courses/${encodeURIComponent(slug)}`;

  return (
    <ErrorState
      icon={LogIn}
      tone="neutral"
      title="Sign in to view this course"
      body="If this course belongs to your organisation, sign in and it will open here. If you aren't a member, it isn't available to you — or the link may be mistyped."
      primaryAction={{ label: "Sign in", href: `/login?redirect=${encodeURIComponent(back)}` }}
      secondaryAction={{ label: "Browse public courses", href: "/courses" }}
    />
  );
}
