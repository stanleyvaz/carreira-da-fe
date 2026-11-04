import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import ForcedPasswordForm from "@/components/ForcedPasswordForm";

function safeNext(n?: string) { return n && /^\/(?!\/)[\w\-/]*$/.test(n) ? n : "/"; }

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/entrar");
  const next = safeNext((await searchParams).next);
  if (!u.mustChangePassword) redirect(next);
  return <main className="shell"><h1 style={{ marginTop: "3rem" }}>Crie sua senha</h1>
    <p className="muted">Você entrou com uma senha temporária. Escolha uma senha só sua para continuar.</p><ForcedPasswordForm next={next} /></main>;
}
