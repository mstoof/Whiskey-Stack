import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { profiles } from "@/lib/schema";
import { serializeProfile } from "@/lib/serialize";
import { ProfileSettings } from "@/components/ProfileSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl text-cask-100">Settings</h1>
      <p className="mt-1 text-sm text-cask-200/60">
        Manage your public shelf: an opt-in, read-only page others can view by link.
      </p>

      <div className="mt-8">
        <ProfileSettings
          initial={row ? serializeProfile(row) : null}
          appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
        />
      </div>
    </div>
  );
}
