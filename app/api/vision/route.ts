import { NextResponse } from "next/server";
import { stackServerApp } from "@/stack";
import { extractBottleFromImage, AiNotConfiguredError } from "@/lib/ai";

export const maxDuration = 60; // vision + reasoning can take a moment

export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const imageBase64: unknown = body?.imageBase64;
  const mimeType: unknown = body?.mimeType;

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return NextResponse.json({ error: "An image is required." }, { status: 400 });
  }
  if (typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  }

  try {
    const suggestion = await extractBottleFromImage(imageBase64, mimeType);
    return NextResponse.json({ suggestion });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("vision error:", err);
    return NextResponse.json(
      { error: "Could not read the label. Enter the details manually." },
      { status: 502 },
    );
  }
}
