import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { profiles } from "@/lib/schema";
import { serializeProfile } from "@/lib/serialize";
import { profileInputSchema } from "@/lib/types";

/**
 * The current user's public-shelf profile. There is at most one row per user
 * (userId PK), so a shelf is private until the user picks a handle and turns
 * `isPublic` on. `userId` always comes from auth, never from the client.
 */
export async function GET() {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  return NextResponse.json({ profile: row ? serializeProfile(row) : null });
}

export async function PUT(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = profileInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const input = parsed.data;

  // Reject a handle already claimed by someone else (the unique index is the
  // backstop; this gives a friendly message before hitting it).
  const [clash] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.handle, input.handle), ne(profiles.userId, user.id)))
    .limit(1);
  if (clash) return NextResponse.json({ error: "That handle is taken." }, { status: 409 });

  const values = {
    handle: input.handle,
    displayName: input.displayName?.trim() ? input.displayName.trim() : null,
    bio: input.bio?.trim() ? input.bio.trim() : null,
    isPublic: input.isPublic,
  };

  try {
    const [row] = await db
      .insert(profiles)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...values, updatedAt: new Date() } })
      .returning();
    return NextResponse.json({ profile: serializeProfile(row) });
  } catch (err) {
    // Unique-violation on the handle index (race with the check above).
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return NextResponse.json({ error: "That handle is taken." }, { status: 409 });
    }
    throw err;
  }
}
