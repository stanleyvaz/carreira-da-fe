import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { trackActivity } from "@/lib/services/usage";
import { currentUser } from "@/lib/auth";
import { getPreferences } from "@/lib/services/user";
import Tabs from "@/components/Tabs";
import UserBadge from "@/components/UserBadge";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u) redirect("/entrar");
  if (u.mustChangePassword) redirect("/trocar-senha");
  void trackActivity(u.id, (await headers()).get("x-forwarded-for")?.split(",")[0].trim());
  if (!((await getPreferences(u.id)) as any)?.onboarded) redirect("/onboarding");
  return <><div className="topbar"><UserBadge name={u.displayName} email={u.email} hasAvatar={!!u.hasAvatar} /></div><main className="shell">{children}</main><Tabs /></>;
}
