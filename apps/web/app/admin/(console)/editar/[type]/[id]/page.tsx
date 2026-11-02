import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listTopicsAdmin } from "@/lib/services/editorial";
import Editor from "@/components/admin/Editor";
export default async function Page({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (!["journey", "reflection", "activity"].includes(type)) notFound();
  const u = (await currentUser())!;
  return <Editor type={type as any} id={id} role={u.role} topics={(await listTopicsAdmin()) as any} />;
}
