import { currentUser } from "@/lib/auth";
import { TopicsPanel } from "@/components/admin/Panels";
export default async function Page() {
  const u = (await currentUser())!;
  return <TopicsPanel role={u.role} />;
}
