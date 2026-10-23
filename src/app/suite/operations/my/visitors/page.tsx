import type { Metadata } from "next";
import MyVisitors from "@/suite/operations/components/my-visitors/MyVisitors";

export const metadata: Metadata = { title: "My visitors" };

/** Register who is coming to see you; reception expects them and tells you when they arrive. */
export default function Page() {
  return <MyVisitors />;
}
