"use client";

import Link from "next/link";
import { useState } from "react";
import { retailerNamesLabel, type Recommendation } from "@/lib/types";
import type { BottleDTO } from "@/lib/serialize";
import { RecommendationCard, recToWishlistPayload } from "./RecommendationCard";

type TargetType = "distillery" | "region";

interface Props {
  aiEnabled: boolean;
  distilleries: string[];
  regions: string[];
}

export function CompletePanel({ aiEnabled, distilleries, regions }: Props) {
  const [targetType, setTargetType] = useState<TargetType>("distillery");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owned, setOwned] = useState<BottleDTO[] | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [ranFor, setRanFor] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const chips = targetType === "distillery" ? distilleries : regions;

  async function run() {
    const t = target.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: t, targetType }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not build the set.");
      setOwned(body.owned as BottleDTO[]);
      setRecs(body.recommendations as Recommendation[]);
      setRanFor(t);
      setAdded({});
      setSaved({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the set.");
    } finally {
      setLoading(false);
    }
  }

  async function addToWishlist(r: Recommendation) {
    setAdded((a) => ({ ...a, [r.name]: true }));
    await fetch("/api/bottles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recToWishlistPayload(r)),
    });
  }

  async function saveForLater(r: Recommendation) {
    setSaved((s) => ({ ...s, [r.name]: true }));
    await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(r),
    });
  }

  function switchType(next: TargetType) {
    setTargetType(next);
    setTarget("");
  }

  return (
    <div>
      <h1 className="font-serif text-3xl text-cask-100">Complete the set</h1>
      <p className="mt-1 max-w-2xl text-sm text-cask-200/60">
        Pick a distillery or region and see the defining bottles you&apos;re still missing,
        each one buyable in the Netherlands at {retailerNamesLabel()}, cheapest price shown.
      </p>

      {!aiEnabled && (
        <div className="mt-5 rounded-lg border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-200">
          AI is off. Set <code className="rounded bg-night-950/60 px-1">GEMINI_API_KEY</code> or{" "}
          <code className="rounded bg-night-950/60 px-1">OPENROUTER_API_KEY</code> in your environment to enable it.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-cask-800/60 bg-night-800/40 p-5">
        <div className="flex rounded-lg border border-cask-800/70 bg-night-900/60 p-1 w-fit">
          {(["distillery", "region"] as const).map((tt) => (
            <button
              key={tt}
              onClick={() => switchType(tt)}
              className={`rounded-md px-3 py-1 text-sm capitalize transition ${
                targetType === tt ? "bg-cask-500/20 text-cask-200" : "text-cask-200/50 hover:text-cask-100"
              }`}
            >
              {tt}
            </button>
          ))}
        </div>

        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={targetType === "distillery" ? "e.g. Springbank, Lagavulin, Buffalo Trace" : "e.g. Islay, Speyside, Campbeltown"}
          className="mt-3 w-full rounded-md border border-cask-800/70 bg-night-900/80 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500"
        />

        {chips.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wide text-cask-200/40">
              From your collection
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => setTarget(c)}
                  className="rounded-full border border-cask-800/70 px-3 py-1 text-xs text-cask-200/70 hover:border-cask-500 hover:text-cask-100"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={run}
          disabled={loading || !aiEnabled || !target.trim()}
          className="mt-4 rounded-lg bg-cask-500 px-5 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400 disabled:opacity-50"
        >
          {loading ? "Building the set…" : "🧩 Find what I'm missing"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {ranFor && !loading && (
        <div className="mt-8">
          {owned && owned.length > 0 && (
            <div className="rounded-xl border border-cask-800/60 bg-night-900/40 p-4">
              <p className="text-sm text-cask-200/70">
                You already own <span className="text-cask-100">{owned.length}</span> from{" "}
                <span className="capitalize text-cask-100">{ranFor}</span>:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {owned.map((b) => (
                  <span
                    key={b.id}
                    className="rounded-full border border-cask-700/50 bg-night-950/50 px-3 py-1 text-xs text-cask-200/80"
                  >
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <h2 className="mt-6 font-serif text-xl text-cask-100">
            {recs.length > 0
              ? `${recs.length} to complete the set`
              : "Nothing left to add"}
          </h2>

          {recs.length === 0 ? (
            <p className="mt-2 text-sm text-cask-200/60">
              Couldn&apos;t find bottles you&apos;re missing from{" "}
              <span className="capitalize">{ranFor}</span> at our NL retailers right now. Try
              another {targetType}.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {recs.map((r) => (
                <RecommendationCard
                  key={r.name}
                  rec={r}
                  added={!!added[r.name]}
                  onAdd={() => addToWishlist(r)}
                  saved={!!saved[r.name]}
                  onSave={() => saveForLater(r)}
                />
              ))}
              <p className="sm:col-span-2 text-[11px] text-cask-200/40">
                Prices and availability are AI estimates from web search. Always verify on the
                retailer&apos;s site before buying. Saved for later? Find it again on your{" "}
                <Link href="/picks" className="text-cask-300 underline">Picks</Link> page.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
