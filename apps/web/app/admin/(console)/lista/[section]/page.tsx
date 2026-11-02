import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listTopicsAdmin } from "@/lib/services/editorial";
import { SECTIONS, type SectionKey } from "@/lib/adminLabels";
import ContentList from "@/components/admin/ContentList";
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in SECTIONS)) notFound();
  const u = (await currentUser())!;
  return <ContentList section={section as SectionKey} role={u.role} topics={(await listTopicsAdmin()) as any} />;
}
