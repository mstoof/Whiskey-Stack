"use client";

import { useState } from "react";
import Link from "next/link";
import type { BottleDTO, FlightDTO } from "@/lib/serialize";
import { FlightBuilder } from "./FlightBuilder";
import { FlightLineup } from "./FlightLineup";

interface Props {
  initialFlights: FlightDTO[];
  bottles: BottleDTO[];
  aiEnabled: boolean;
}

export function FlightsView({ initialFlights, bottles, aiEnabled }: Props) {
  const [flights, setFlights] = useState<FlightDTO[]>(initialFlights);
  // null = not editing; "new" = creating; a FlightDTO = editing that one.
  const [editing, setEditing] = useState<FlightDTO | "new" | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function upsert(flight: FlightDTO) {
    setFlights((prev) => {
      const i = prev.findIndex((f) => f.id === flight.id);
      if (i === -1) return [flight, ...prev];
      const next = [...prev];
      next[i] = flight;
      return next;
    });
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this flight? This can't be undone.")) return;
    const prev = flights;
    setFlights((f) => f.filter((x) => x.id !== id)); // optimistic
    const res = await fetch(`/api/flights/${id}`, { method: "DELETE" });
    if (!res.ok) setFlights(prev); // roll back on failure
  }

  async function toggleShare(flight: FlightDTO) {
    setBusy(flight.id);
    try {
      const res = await fetch(`/api/flights/${flight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: flight.title,
          theme: flight.theme,
          notes: flight.notes,
          shared: !flight.shareToken,
          items: flight.items.map((i) => ({ bottleId: i.bottleId, note: i.note })),
        }),
      });
      const body = await res.json();
      if (res.ok) upsert(body as FlightDTO);
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(flight: FlightDTO) {
    if (!flight.shareToken) return;
    const url = `${window.location.origin}/f/${flight.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(flight.id);
      setTimeout(() => setCopied((c) => (c === flight.id ? null : c)), 2000);
    } catch {
      // Clipboard blocked, so surface the URL for the user to copy manually.
      window.prompt("Copy this share link:", url);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cask-100">Tasting flights</h1>
          <p className="mt-1 max-w-2xl text-sm text-cask-200/60">
            Build a themed, ordered lineup from bottles you own, then share it with a public link.
          </p>
        </div>
        {editing === null && (
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400"
          >
            + New flight
          </button>
        )}
      </div>

      {editing !== null && (
        <div className="mt-6">
          <FlightBuilder
            bottles={bottles}
            aiEnabled={aiEnabled}
            initial={editing === "new" ? null : editing}
            onSaved={upsert}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {flights.length === 0 && editing === null ? (
        <div className="mt-16 rounded-2xl border border-dashed border-cask-800/60 p-12 text-center">
          <p className="text-cask-200/60">
            No flights yet. Build one from your{" "}
            <Link href="/collection" className="text-cask-300 underline">shelf</Link>:
            pick a few bottles, put them in order, add a theme, and share it.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {flights.map((f) => {
            const isOpen = expanded[f.id];
            return (
              <div key={f.id} className="rounded-2xl border border-cask-800/60 bg-night-800/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-serif text-xl text-cask-100">{f.title}</h2>
                    <p className="text-xs text-cask-200/50">
                      {f.theme ? <span className="text-cask-200/70">{f.theme} · </span> : null}
                      {f.items.length} {f.items.length === 1 ? "pour" : "pours"}
                      {f.shareToken ? <span className="text-emerald-300"> · shared</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [f.id]: !e[f.id] }))}
                      className="rounded-lg border border-cask-800/70 px-3 py-1.5 text-xs text-cask-200/70 hover:border-cask-500 hover:text-cask-100"
                    >
                      {isOpen ? "Hide" : "View"}
                    </button>
                    <button
                      onClick={() => setEditing(f)}
                      className="rounded-lg border border-cask-800/70 px-3 py-1.5 text-xs text-cask-200/70 hover:border-cask-500 hover:text-cask-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleShare(f)}
                      disabled={busy === f.id}
                      className="rounded-lg border border-cask-800/70 px-3 py-1.5 text-xs text-cask-200/70 hover:border-cask-500 hover:text-cask-100 disabled:opacity-50"
                    >
                      {f.shareToken ? "Unshare" : "Share"}
                    </button>
                    {f.shareToken && (
                      <button
                        onClick={() => copyLink(f)}
                        className="rounded-lg border border-emerald-700/50 px-3 py-1.5 text-xs text-emerald-300 hover:border-emerald-500"
                      >
                        {copied === f.id ? "Copied!" : "Copy link"}
                      </button>
                    )}
                    <button
                      onClick={() => remove(f.id)}
                      className="rounded-lg border border-cask-800/70 px-3 py-1.5 text-xs text-red-400/70 hover:border-red-500/60 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4">
                    {f.notes && <p className="mb-3 text-sm text-cask-200/70">{f.notes}</p>}
                    <FlightLineup items={f.items} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-[11px] text-cask-200/40">
        Flights are for sharing what&apos;s on your shelf, not for planning how much to drink. Please enjoy
        responsibly.
      </p>
    </div>
  );
}
