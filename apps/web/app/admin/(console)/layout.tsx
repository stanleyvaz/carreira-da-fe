import { redirect } from "next/navigation";
import { ADMIN_ROLES } from "@jornada/shared";
import { currentUser } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";
import { DialogProvider } from "@/components/admin/Dialog";
import { ToastProvider } from "@/components/admin/Toast";
import "../admin.css";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u) redirect("/entrar?next=/admin");
  if (!ADMIN_ROLES.includes(u.role)) redirect("/");
  return <ToastProvider><DialogProvider>
    <div className="adm"><AdminNav role={u.role} name={u.displayName ?? u.email} /><main className="admmain" id="conteudo">{children}</main></div>
  </DialogProvider></ToastProvider>;
}
