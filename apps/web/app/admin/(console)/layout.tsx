import { redirect } from "next/navigation";
import { ADMIN_ROLES } from "@jornada/shared";
import { currentUser } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u) redirect("/entrar?next=/admin");
  if (!ADMIN_ROLES.includes(u.role)) redirect("/");
  return <div className="adm"><AdminNav role={u.role} name={u.displayName ?? u.email} /><main className="admmain">{children}</main></div>;
}
