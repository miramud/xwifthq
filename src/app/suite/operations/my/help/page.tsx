import type { Metadata } from "next";
import MyHelp from "@/suite/operations/components/my-help/MyHelp";

export const metadata: Metadata = { title: "Ask for help" };

/** Ask the service desk for something, and follow what you asked. */
export default function Page() {
  return <MyHelp />;
}
