"use client";

import { use } from "react";
import UserProfile from "@/suite/org/components/users/UserProfile";

export default function OrgUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UserProfile id={id} />;
}
