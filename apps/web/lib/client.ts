"use client";
export async function call<T = any>(method: string, url: string, data?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: data ? { "Content-Type": "application/json" } : undefined, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Algo deu errado. Tente novamente.");
  return j;
}
