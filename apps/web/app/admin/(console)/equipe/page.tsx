import { currentUser } from "@/lib/auth";
import { StaffPanel } from "@/components/admin/Panels";
export default async function Page() {
  const u = (await currentUser())!;
  return <StaffPanel role={u.role} />;
}
