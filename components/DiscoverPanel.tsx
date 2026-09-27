"use client";

import Link from "next/link";
import { useState } from "react";
import { retailerNamesLabel, type Recommendation } from "@/lib/types";
import { RecommendationCard, recToWishlistPayload } from "./RecommendationCard";

const CHIPS = [
  "Peaty & smoky",
  "Under €50",
  "Something Japanese",
  "Sherry bombs",
  "A good bourbon",
  "Higher ABV / cask strength",
];

export function DiscoverPanel({ aiEnabled }: { aiEnabled: boolean }) {
  const [preferences, setPreferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  async function discover() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Discovery failed.");
      setRecs(body.recommendations as Recommendation[]);
      setAdded({});
      setSaved({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed.");
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

  return (
    <div>
      <h1 className="font-serif text-3xl text-cask-100">Discover your next bottle</h1>
      <p className="mt-1 max-w-2xl text-sm text-cask-200/60">
        AI looks at your collection and suggests bottles that broaden it, each one buyable
        in the Netherlands at {retailerNamesLabel()}, with the cheapest price shown.
      </p>

      {!aiEnabled && (
        <div className="mt-5 rounded-lg border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-200">
          AI discovery is off. Set <code className="rounded bg-night-950/60 px-1">GEMINI_API_KEY</code> or{" "}
          <code className="rounded bg-night-950/60 px-1">OPENROUTER_API_KEY</code> in your environment to enable it.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-cask-800/60 bg-night-800/40 p-5">
        <label className="text-xs font-medium uppercase tracking-wide text-cask-200/60">
          What are you in the mood for? (optional)
        </label>
        <textarea
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          rows={2}
          placeholder="e.g. peaty Islay under €60, or a smooth easy sipper for guests"
          className="mt-2 w-full rounded-md border border-cask-800/70 bg-night-900/80 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => setPreferences((p) => (p ? `${p}, ${c.toLowerCase()}` : c))}
              className="rounded-full border border-cask-800/70 px-3 py-1 text-xs text-cask-200/70 hover:border-cask-500 hover:text-cask-100">
              {c}
            </button>
          ))}
        </div>
        <button onClick={discover} disabled={loading || !aiEnabled}
          className="mt-4 rounded-lg bg-cask-500 px-5 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400 disabled:opacity-50">
          {loading ? "Searching the shelves…" : "✨ Find bottles"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {recs.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
            Prices and availability are AI estimates from web search. Always verify on the retailer&apos;s site before buying.
            Saved for later? Find it again on your{" "}
            <Link href="/picks" className="text-cask-300 underline">Picks</Link> page.
          </p>
        </div>
      )}
    </div>
  );
}
