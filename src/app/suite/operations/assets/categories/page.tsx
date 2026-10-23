import type { Metadata } from "next";
import CategoriesAndKits from "@/suite/operations/components/assets/CategoriesAndKits";

export const metadata: Metadata = { title: "Asset categories and kits" };

/** Tag codes, Finance classes, and the onboarding kits new starters are given. */
export default function CategoriesAndKitsPage() {
  return <CategoriesAndKits />;
}
