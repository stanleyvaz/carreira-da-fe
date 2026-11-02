"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBook, IconHeart, IconRing, IconSun } from "./Icons";
const TABS = [["/", "Hoje", IconSun], ["/aprender", "Aprender", IconBook], ["/exercitar", "Exercitar", IconHeart], ["/minha-jornada", "Minha jornada", IconRing]] as const;
export default function Tabs() {
  const p = usePathname();
  return <nav className="tabs" aria-label="Principal">{TABS.map(([h, l, I]) =>
    <Link key={h} href={h} aria-current={(h === "/" ? p === "/" : p.startsWith(h)) ? "page" : undefined}><I /><span>{l}</span></Link>)}</nav>;
}
