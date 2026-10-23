"use client";

import { use } from "react";
import RoleEditor from "@/suite/org/components/roles/RoleEditor";

export default function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RoleEditor id={id} />;
}
