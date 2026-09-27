import { stackServerApp } from "@/stack";
import { isAiConfigured } from "@/lib/ai";
import { DiscoverPanel } from "@/components/DiscoverPanel";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  await stackServerApp.getUser({ or: "redirect" });
  return <DiscoverPanel aiEnabled={isAiConfigured()} />;
}
