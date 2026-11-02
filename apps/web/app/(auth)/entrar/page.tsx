import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

/** Aceita apenas caminhos internos (evita redirecionamento aberto). */
function safeNext(n?: string) { return n && /^\/(?!\/)[\w\-/]*$/.test(n) ? n : undefined; }

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next ?? "/");
  return <main className="shell"><h1 style={{ marginTop: "3rem" }}>Carreira da Fé</h1>
    <p className="muted">{next?.startsWith("/admin") ? "Acesso ao painel editorial." : "A Palavra no seu dia. Sem pressa, sem cobrança."}</p><AuthForm next={next} /></main>;
}
