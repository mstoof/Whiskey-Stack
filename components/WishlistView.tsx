"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BottleDTO } from "@/lib/serialize";
import { BottleCard } from "./BottleCard";
import { BottleForm } from "./BottleForm";

/**
 * A dedicated page for wishlist bottles, same country-grouped card layout as
 * `/collection` (CollectionView), scoped server-side to `status = 'wishlist'`
 * instead of filtered client-side. No status tabs (there's only one status
 * here) and no CollectionIO import/export (bulk-importing arbitrary-status
 * rows into a wishlist-only view would be an odd fit).
 *
 * Distinct from `/watchlist`: this is every wishlist bottle; that page is
 * specifically the ones with a `targetPriceEur` the daily cron re-prices. A
 * bottle can be on this page without being watched. Set a target price (via
 * "+ Add bottle" / "Edit") to start watching it, then find it there too.
 */
export function WishlistView({ initialBottles }: { initialBottles: BottleDTO[] }) {
  const [bottles, setBottles] = useState<BottleDTO[]>(() => initialBottles.filter((b) => b.status === "wishlist"));
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BottleDTO | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("whiskey-stack-wishlist-collapsed");
      if (saved) setCollapsed(JSON.parse(saved) as Record<string, boolean>);
    } catch {
      // Ignore unavailable or malformed browser storage.
    }
  }, []);

  const watchedCount = useMemo(
    () => bottles.filter((b) => b.targetPriceEur != null).length,
    [bottles],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bottles;
    return bottles.filter((b) =>
      [b.name, b.distillery, b.country, b.region, b.category, ...(b.flavorTags ?? [])]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [bottles, query]);

  /** Same country-grouping as CollectionView. See its comment for why. */
  const byCountry = useMemo(() => {
    const groups = new Map<string, BottleDTO[]>();
    const special = new Set(["Unique choices", "Luxury Whisky's"]);
    for (const b of visible) {
      if (special.has(b.category ?? "")) continue;
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

  const specialGroups = useMemo(() => {
    const labels = ["Unique choices", "Luxury Whisky's"] as const;
    return labels.map((label) => [label, visible.filter((b) => b.category === label).sort((a, c) => a.name.localeCompare(c.name))] as const)
      .filter(([, group]) => group.length > 0);
  }, [visible]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function toggleGroup(label: string) {
    setCollapsed((current) => {
      const next = { ...current, [label]: !current[label] };
      try {
        window.localStorage.setItem("whiskey-stack-wishlist-collapsed", JSON.stringify(next));
      } catch {
        // Ignore unavailable browser storage.
      }
      return next;
    });
  }
  function openEdit(b: BottleDTO) {
    setEditing(b);
    setFormOpen(true);
  }
  function onSaved(saved: BottleDTO) {
    setBottles((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      // Changed away from "wishlist" (e.g. marked owned): it no longer
      // belongs on this page, so drop it instead of upserting it in place.
      if (saved.status !== "wishlist") {
        return idx === -1 ? prev : prev.filter((b) => b.id !== saved.id);
      }
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setFormOpen(false);
    setEditing(null);
  }
  async function onDelete(id: string) {
    if (!confirm("Remove this bottle from your wishlist?")) return;
    setBottles((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/bottles/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-cask-100">Your wishlist</h1>
          <p className="mt-1 text-sm text-cask-200/60">
            {bottles.length} bottle{bottles.length === 1 ? "" : "s"} you want
            {watchedCount > 0 && (
              <>
                {" "}
                · <span className="text-cask-200">{watchedCount}</span> with a target price:
                see the{" "}
                <Link href="/watchlist" className="text-cask-300 underline">
                  Watchlist
                </Link>
              </>
            )}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400"
        >
          + Add to wishlist
        </button>
      </div>

      <div className="mt-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, region, flavour…"
          className="min-w-[200px] w-full max-w-md rounded-lg border border-cask-800/70 bg-night-900/60 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500 sm:w-auto"
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-cask-800/60 p-12 text-center">
          <p className="text-cask-200/60">
            {bottles.length === 0
              ? "Nothing on your wishlist yet. Add a bottle you're after to get started."
              : "No bottles match your search."}
          </p>
          {bottles.length === 0 && (
            <button
              onClick={openAdd}
              className="mt-4 rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-cask-400"
            >
              + Add your first wishlist bottle
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {specialGroups.map(([label, group]) => (
            <div key={label}>
              <button type="button" onClick={() => toggleGroup(label)} aria-expanded={!collapsed[label]}
                className="flex w-full items-baseline gap-2 border-b border-cask-900/60 pb-2 text-left font-serif text-lg text-cask-200 hover:text-cask-100">
                {label}
                <span className="font-sans text-xs font-normal text-cask-200/40">
                  {group.length} bottles
                </span>
                <span className="ml-auto text-sm text-cask-200/50">{collapsed[label] ? "▸" : "▾"}</span>
              </button>
              {!collapsed[label] && <div className="mt-4 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((b) => <BottleCard key={b.id} bottle={b} onEdit={openEdit} onDelete={onDelete} />)}
              </div>}
            </div>
          ))}
          {byCountry.map(([country, group]) => (
            <div key={country}>
              <button type="button" onClick={() => toggleGroup(country)} aria-expanded={!collapsed[country]}
                className="flex w-full items-baseline gap-2 border-b border-cask-900/60 pb-2 text-left font-serif text-lg text-cask-200 hover:text-cask-100">
                {country}
                <span className="font-sans text-xs font-normal text-cask-200/40">
                  {group.length} bottle{group.length === 1 ? "" : "s"}
                </span>
                <span className="ml-auto text-sm text-cask-200/50">{collapsed[country] ? "▸" : "▾"}</span>
              </button>
              {!collapsed[country] && <div className="mt-4 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((b) => (
                  <BottleCard key={b.id} bottle={b} onEdit={openEdit} onDelete={onDelete} />
                ))}
              </div>}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <BottleForm
          initial={editing}
          defaultStatus="wishlist"
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
