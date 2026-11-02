import { currentUser } from "@/lib/auth";
import { listTopicsAdmin } from "@/lib/services/editorial";
import NotificationsPanel from "@/components/admin/NotificationsPanel";
export default async function Page() {
  const u = (await currentUser())!;
  return <NotificationsPanel role={u.role} topics={(await listTopicsAdmin()) as any} />;
}
