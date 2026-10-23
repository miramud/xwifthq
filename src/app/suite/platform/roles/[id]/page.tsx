import RoleEditor from "@/suite/platform/components/access/RoleEditor";

export default async function PlatformRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoleEditor roleId={id} />;
}
