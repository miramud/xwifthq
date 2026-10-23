import { redirect } from "next/navigation";

/**
 * "Who does what" became HR's roles board (roles redesign, phase 3a): a
 * bookmark or an old link lands there.
 */
export default function HrmDesignationsPage() {
  redirect("/suite/hrm/roles");
}
