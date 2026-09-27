"use client";

import { useMemo, useState } from "react";
import type { BottleDTO } from "@/lib/serialize";
import { BottleCard } from "./BottleCard";
import { BottleForm } from "./BottleForm";
import { CollectionIO } from "./CollectionIO";

export function CollectionView({ initialBottles }: { initialBottles: BottleDTO[] }) {
  const [bottles, setBottles] = useState<BottleDTO[]>(() => initialBottles.filter((b) => b.status === "owned"));
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BottleDTO | null>(null);

  const stats = useMemo(() => {
    const owned = bottles.filter((b) => b.status === "owned");
    const rated = bottles.filter((b) => b.rating != null);
    const countries = new Set(bottles.map((b) => b.country).filter(Boolean));
    const avg = rated.length
      ? Math.round(rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length)
      : null;
    return { owned: owned.length, total: bottles.length, countries: countries.size, avg };
  }, [bottles]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bottles.filter((b) => {
      if (!q) return true;
      return [b.name, b.distillery, b.country, b.region, b.category, ...(b.flavorTags ?? [])]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [bottles, query]);

  /**
   * Grouped by country, each group sorted by name, so the shelf reads as one
   * country's bottles stacked together, then the next. No-country bottles get
   * their own bucket at the end rather than being silently dropped.
   */
  const byCountry = useMemo(() => {
    const groups = new Map<string, BottleDTO[]>();
    for (const b of visible) {
      const key = b.country?.trim() || "Unknown";
      const list = groups.get(key);
      if (list) list.push(b);
      else groups.set(key, [b]);
    }
    for (const list of groups.values()) list.sort((a, c) => a.name.localeCompare(c.name));
    return [...groups.entries()].sort(([a], [c]) => {
      if (a === "Unknown") return 1;
      if (c === "Unknown") return -1;
      return a.localeCompare(c);
    });
  }, [visible]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(b: BottleDTO) {
    setEditing(b);
    setFormOpen(true);
  }
  function onSaved(saved: BottleDTO) {
    setBottles((prev) => {
      if (saved.status !== "owned") return prev.filter((b) => b.id !== saved.id);
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setFormOpen(false);
    setEditing(null);
  }
  async function onDelete(id: string) {
    if (!confirm("Delete this bottle from your collection?")) return;
    setBottles((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/bottles/${id}`, { method: "DELETE" });
  }
  // Prepend imported bottles, deduped by id (mirrors onSaved's upsert).
  function mergeImported(dtos: BottleDTO[]) {
    setBottles((prev) => [...dtos.filter((b) => b.status === "owned"), ...prev.filter((p) => !dtos.some((d) => d.id === p.id))]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-cask-100">Your collection</h1>
          <p className="mt-1 text-sm text-cask-200/60">
            {stats.owned} bottle{stats.owned === 1 ? "" : "s"} on the shelf · {stats.countries} countries
            {stats.avg != null ? ` · average rating ★ ${stats.avg}/100` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CollectionIO bottles={bottles} onImported={mergeImported} />
          <button onClick={openAdd}
            className="rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400">
            + Add bottle
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, region, flavour…"
          className="min-w-[200px] flex-1 rounded-lg border border-cask-800/70 bg-night-900/60 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500"
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-cask-800/60 p-12 text-center">
          <p className="text-cask-200/60">
            {bottles.length === 0
              ? "Your shelf is empty. Add a bottle you own to get started."
              : "No bottles match your search."}
          </p>
          {bottles.length === 0 && (
            <button onClick={openAdd} className="mt-4 rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-cask-400">
              + Add your first bottle
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {byCountry.map(([country, group]) => (
            <div key={country}>
              <h2 className="flex items-baseline gap-2 border-b border-cask-900/60 pb-2 font-serif text-lg text-cask-200">
                {country}
                <span className="font-sans text-xs font-normal text-cask-200/40">
                  {group.length} bottle{group.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="mt-4 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((b) => (
                  <BottleCard key={b.id} bottle={b} onEdit={openEdit} onDelete={onDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <BottleForm
          initial={editing}
          onSaved={onSaved}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
