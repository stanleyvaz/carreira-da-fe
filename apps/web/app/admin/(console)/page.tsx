import { currentUser } from "@/lib/auth";
import Dashboard from "@/components/admin/Dashboard";
export default async function Page({ searchParams }: { searchParams: Promise<{ promover?: string }> }) {
  const u = (await currentUser())!; const { promover } = await searchParams;
  return <Dashboard role={u.role} promoteId={promover} />;
}
