import type { Metadata } from "next";
import MyPolicies from "@/suite/operations/components/my-documents/MyPolicies";

export const metadata: Metadata = { title: "Policies to read" };

/** The policies in force; those sent to me to read first. */
export default function MyPoliciesPage() {
  return <MyPolicies />;
}
