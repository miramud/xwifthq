import { guardLearnerSpace } from "@/lib/module-guard";

/** Part of the LMS: a member of an organisation without it lands on the preview. */
export default async function LearnerSpaceLayout({ children }: { children: React.ReactNode }) {
  await guardLearnerSpace();
  return <>{children}</>;
}
