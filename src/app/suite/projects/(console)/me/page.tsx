import type { Metadata } from "next";
import MyWork from "@/suite/projects/components/MyWork";

export const metadata: Metadata = {
  title: "My work",
  robots: { index: false, follow: false },
};

/**
 * Everything assigned to this person, across every project.
 *
 * The question a board cannot answer: somebody on three projects has three
 * boards and one working day.
 */
export default function MyWorkPage() {
  return <MyWork />;
}
