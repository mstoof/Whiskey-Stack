import { NextResponse } from "next/server";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { serializeBottle, type BottleDTO } from "@/lib/serialize";
import { bottleInputSchema, MAX_IMPORT_ROWS } from "@/lib/types";
import { toInsertValues } from "../route";

/**
 * Bulk-import bottles from a CSV/JSON file. The client parses the file into an
 * array of candidate objects (see lib/portable.ts) and POSTs `{ bottles: [...] }`.
 * Every candidate is re-validated with the same `bottleInputSchema` + built with
 * the same `toInsertValues` as the create route, so an import row is exactly as
 * trusted as a form-created one: `userId` comes from auth and unknown keys (id,
 * timestamps, cron fields) are dropped by Zod. Partial success: valid rows are
 * inserted, invalid rows are skipped and reported by row number.
 */
export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { bottles?: unknown } | null;
  const candidates = body && Array.isArray(body.bottles) ? (body.bottles as unknown[]) : null;
  if (!candidates) {
    return NextResponse.json({ error: 'Expected a JSON body like { "bottles": [...] }.' }, { status: 400 });
  }
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }
  if (candidates.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `Too many rows: ${candidates.length}. The import limit is ${MAX_IMPORT_ROWS}.` },
      { status: 400 },
    );
  }

  const values: Array<{ userId: string } & ReturnType<typeof toInsertValues>> = [];
  const errors: { row: number; message: string }[] = [];

  candidates.forEach((candidate, i) => {
    const parsed = bottleInputSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
      return;
    }
    values.push({ userId: user.id, ...toInsertValues(parsed.data) });
  });

  let created: BottleDTO[] = [];
  if (values.length > 0) {
    const rows = await db.insert(bottles).values(values).returning();
    created = rows.map(serializeBottle);
  }

  return NextResponse.json({
    imported: created.length,
    skipped: errors.length,
    errors,
    bottles: created,
  });
}
