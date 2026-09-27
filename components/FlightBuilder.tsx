"use client";

import { useMemo, useState } from "react";
import type { BottleDTO, FlightDTO } from "@/lib/serialize";
import { MAX_FLIGHT_ITEMS } from "@/lib/types";

interface Draft {
  bottleId: string;
  note: string;
}

interface Props {
  /** Pickable bottles (the owner's non-wishlist shelf). */
  bottles: BottleDTO[];
  aiEnabled: boolean;
  /** Existing flight to edit, or null to create a new one. */
  initial: FlightDTO | null;
  onSaved: (flight: FlightDTO) => void;
  onCancel: () => void;
}

export function FlightBuilder({ bottles, aiEnabled, initial, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [theme, setTheme] = useState(initial?.theme ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [shared, setShared] = useState(Boolean(initial?.shareToken));
  const [items, setItems] = useState<Draft[]>(
    initial?.items.map((i) => ({ bottleId: i.bottleId, note: i.note ?? "" })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(bottles.map((b) => [b.id, b])), [bottles]);
  const chosen = useMemo(() => new Set(items.map((i) => i.bottleId)), [items]);
  const available = bottles.filter((b) => !chosen.has(b.id));
  const full = items.length >= MAX_FLIGHT_ITEMS;

  function addBottle(id: string) {
    if (full || chosen.has(id)) return;
    setItems((prev) => [...prev, { bottleId: id, note: "" }]);
  }
  function removeAt(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function setNote(idx: number, note: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, note } : it)));
  }

  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/flights/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not build a flight.");
      const draftItems = (body.items as { bottleId: string; note: string | null }[])
        .filter((i) => byId.has(i.bottleId))
        .map((i) => ({ bottleId: i.bottleId, note: i.note ?? "" }));
      if (draftItems.length === 0) throw new Error("The AI picked bottles that aren't on your shelf. Try again.");
      if (!title.trim() && body.title) setTitle(String(body.title));
      if (!theme.trim() && body.theme) setTheme(String(body.theme));
      setItems(draftItems.slice(0, MAX_FLIGHT_ITEMS));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build a flight.");
    } finally {
      setSuggesting(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      setError("Give your flight a title.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one bottle.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        theme: theme.trim() || null,
        notes: notes.trim() || null,
        shared,
        items: items.map((i) => ({ bottleId: i.bottleId, note: i.note.trim() || null })),
      };
      const res = await fetch(initial ? `/api/flights/${initial.id}` : "/api/flights", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save the flight.");
      onSaved(body as FlightDTO);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the flight.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cask-800/60 bg-night-800/40 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-cask-100">{initial ? "Edit flight" : "New flight"}</h2>
        <button onClick={onCancel} className="text-sm text-cask-200/50 hover:text-cask-100">
          Cancel
        </button>
      </div>

      {bottles.length < 2 && (
        <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-200">
          Add at least two <span className="font-medium">owned</span> bottles to your collection to build a flight.
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title, e.g. A Peated Progression"
          maxLength={200}
          className="w-full rounded-md border border-cask-800/70 bg-night-900/80 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500"
        />
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Theme (optional), e.g. Islay night"
          maxLength={120}
          className="w-full rounded-md border border-cask-800/70 bg-night-900/80 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for the tasting (optional)"
        rows={2}
        maxLength={4000}
        className="mt-3 w-full rounded-md border border-cask-800/70 bg-night-900/80 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500"
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={suggest}
          disabled={!aiEnabled || suggesting || bottles.length < 2}
          title={aiEnabled ? undefined : "Set GEMINI_API_KEY or OPENROUTER_API_KEY to enable AI"}
          className="rounded-lg border border-cask-600/60 px-4 py-2 text-sm font-medium text-cask-200 transition hover:border-cask-400 hover:text-cask-100 disabled:opacity-40"
        >
          {suggesting ? "Building…" : "✨ Suggest a flight"}
        </button>
        {!aiEnabled && (
          <span className="text-xs text-amber-200/80">
            AI is off. Set <code className="rounded bg-night-950/60 px-1">GEMINI_API_KEY</code> or{" "}
            <code className="rounded bg-night-950/60 px-1">OPENROUTER_API_KEY</code> to enable it.
          </span>
        )}
      </div>

      {/* Chosen pours, in order */}
      {items.length > 0 && (
        <ol className="mt-5 space-y-2">
          {items.map((it, idx) => {
            const b = byId.get(it.bottleId);
            return (
              <li key={it.bottleId} className="rounded-xl border border-cask-800/60 bg-night-900/50 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cask-500/15 text-xs font-bold text-cask-200">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-serif text-cask-100" title={b?.name}>
                    {b?.name ?? "Unknown bottle"}
                    {b && (
                      <span className="ml-2 text-xs text-cask-200/40">
                        {[b.category, b.country].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                      className="rounded px-2 py-1 text-cask-200/60 hover:bg-night-800 hover:text-cask-100 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === items.length - 1}
                      aria-label="Move down"
                      className="rounded px-2 py-1 text-cask-200/60 hover:bg-night-800 hover:text-cask-100 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeAt(idx)}
                      aria-label="Remove"
                      className="rounded px-2 py-1 text-red-400/70 hover:bg-night-800 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <input
                  value={it.note}
                  onChange={(e) => setNote(idx, e.target.value)}
                  placeholder="Pour note (optional): what to notice"
                  maxLength={500}
                  className="mt-2 w-full rounded-md border border-cask-800/70 bg-night-950/60 px-3 py-1.5 text-xs text-cask-100 outline-none focus:border-cask-500"
                />
              </li>
            );
          })}
        </ol>
      )}

      {/* Add-a-bottle picker */}
      {available.length > 0 && !full && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wide text-cask-200/40">Add from your shelf</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {available.map((b) => (
              <button
                key={b.id}
                onClick={() => addBottle(b.id)}
                className="rounded-full border border-cask-800/70 px-3 py-1 text-xs text-cask-200/70 hover:border-cask-500 hover:text-cask-100"
              >
                + {b.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {full && (
        <p className="mt-3 text-xs text-cask-200/40">
          That&apos;s the {MAX_FLIGHT_ITEMS}-bottle maximum for one flight.
        </p>
      )}

      <label className="mt-5 flex items-center gap-2 text-sm text-cask-200/80">
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => setShared(e.target.checked)}
          className="h-4 w-4 rounded border-cask-700 bg-night-900 accent-cask-500"
        />
        Share with a public link (read-only, no login needed)
      </label>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-5 flex gap-3">
        <button
          onClick={save}
          disabled={saving || !title.trim() || items.length === 0}
          className="rounded-lg bg-cask-500 px-5 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400 disabled:opacity-50"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Create flight"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-cask-800/70 px-5 py-2 text-sm text-cask-200/70 hover:text-cask-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
