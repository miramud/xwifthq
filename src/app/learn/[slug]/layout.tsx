import type { Metadata } from "next";
import { guardLearnerSpace } from "@/lib/module-guard";

export const metadata: Metadata = {
  title: "Course player",
};

export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardLearnerSpace();
  return <>{children}</>;
}
