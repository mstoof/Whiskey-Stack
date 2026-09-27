import { stackServerApp } from "@/stack";
import { Nav } from "@/components/Nav";
import { LanguageProvider } from "@/components/LanguageProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Gate the whole app section behind auth; unauthenticated users get the sign-in page.
  await stackServerApp.getUser({ or: "redirect" });

  return (
    <LanguageProvider>
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      </div>
    </LanguageProvider>
  );
}
