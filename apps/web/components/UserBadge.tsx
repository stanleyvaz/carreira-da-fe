import Link from "next/link";
/** Ícone do usuário no canto superior direito de todas as telas. */
export default function UserBadge({ name, email, hasAvatar }: { name: string | null; email: string; hasAvatar: boolean }) {
  const initial = (name || email)[0]?.toUpperCase();
  return <Link href="/minha-jornada#perfil" aria-label="Meu perfil" className="userbadge">
    {hasAvatar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src="/api/me/avatar-view" alt="" width={36} height={36} /> : <span aria-hidden>{initial}</span>}
  </Link>;
}
