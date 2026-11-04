import { currentUser } from "@/lib/auth";
import { CompanionPanel } from "@/components/admin/CompanionPhrases";
export default async function Page() {
  const u = (await currentUser())!;
  return <CompanionPanel role={u.role} />;
}
