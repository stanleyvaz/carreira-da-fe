import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listTopics } from "@/lib/services/user";
import OnboardingForm from "@/components/OnboardingForm";
export default async function Page() {
  if (!(await currentUser())) redirect("/entrar");
  return <main className="shell"><h1>Vamos começar</h1><OnboardingForm topics={await listTopics()} /></main>;
}
