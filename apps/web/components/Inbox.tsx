"use client";
import Link from "next/link";
import { useState } from "react";
import { call } from "@/lib/client";
const HREF = (k: string, id: string | null) => k === "resource" ? `/conteudo/${id}` : k === "journey" ? `/aprender/${id}` : k === "praticar" ? "/exercitar" : "/";
export default function Inbox({ items }: { items: { id: string; title: string; body: string; linkKind: string; linkId: string | null; read: boolean }[] }) {
  const [list, setList] = useState(items);
  if (!list.length) return null;
  return <section aria-label="Novidades"><div className="sectionh"><h2>Novidades</h2>
    <button className="chip" onClick={async () => { await call("POST", "/api/me/notifications", {}); setList([]); }}>Marcar como lidas</button></div>
    {list.map((n) => <Link key={n.id} className="card link" href={HREF(n.linkKind, n.linkId)} onClick={() => void call("POST", "/api/me/notifications", { id: n.id })}>
      <h3 style={{ margin: 0 }}>{n.title}</h3><p className="muted small" style={{ margin: ".15rem 0 0" }}>{n.body}</p></Link>)}</section>;
}
