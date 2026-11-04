import { currentUser } from "@/lib/auth";
import { AppUsersPanel } from "@/components/admin/AppUsers";
export default async function Page() {
  const u = (await currentUser())!;
  return <AppUsersPanel role={u.role} />;
}
