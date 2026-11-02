import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Carreira da Fé — A Palavra no seu dia", description: "Pequenos momentos para conhecer, compreender e viver a Palavra." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light dark" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
