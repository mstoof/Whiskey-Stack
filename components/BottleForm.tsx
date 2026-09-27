"use client";

import { useState } from "react";
import type { BottleDTO } from "@/lib/serialize";
import { BOTTLE_STATUS_LABELS, BOTTLE_STATUSES, CATEGORIES, retailerNamesLabel, type BottleVision } from "@/lib/types";

/** Downscale a picked image in the browser so uploads stay small and fast. */
async function fileToResizedBase64(
  file: File,
  maxDim = 1024,
  quality = 0.8,
): Promise<{ data: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not load the image."));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process the image.");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", quality);
  return { data: out.split(",")[1] ?? "", mimeType: "image/jpeg" };
}

interface Props {
  initial?: BottleDTO | null;
  defaultStatus?: string;
  onSaved: (bottle: BottleDTO) => void;
  onCancel: () => void;
}

const labelCls = "block text-xs font-medium uppercase tracking-wide text-cask-200/60";
const inputCls =
  "mt-1 w-full rounded-md border border-cask-800/70 bg-night-900/80 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500";

export function BottleForm({ initial, defaultStatus, onSaved, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    distillery: initial?.distillery ?? "",
    country: initial?.country ?? "",
    region: initial?.region ?? "",
    category: initial?.category ?? "",
    ageStatement: initial?.ageStatement?.toString() ?? "",
    abv: initial?.abv?.toString() ?? "",
    status: initial?.status ?? defaultStatus ?? "owned",
    rating: initial?.rating?.toString() ?? "",
    purchasePriceEur: initial?.purchasePriceEur?.toString() ?? "",
    purchaseStore: initial?.purchaseStore ?? "",
    targetPriceEur: initial?.targetPriceEur?.toString() ?? "",
    flavorTags: (initial?.flavorTags ?? []).join(", "),
    notes: initial?.notes ?? "",
    imageUrl: initial?.imageUrl ?? "",
    descriptionEn: initial?.descriptionEn ?? "",
    descriptionNl: initial?.descriptionNl ?? "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    setScanError(null);
    setScanned(false);
    setScanning(true);
    try {
      const { data, mimeType } = await fileToResizedBase64(file);
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: data, mimeType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not read the label.");
      }
      const { suggestion } = (await res.json()) as { suggestion: BottleVision };
      if (suggestion.identified === false) {
        throw new Error("That doesn't look like a whisky bottle. Try another photo.");
      }

      // Match the model's category to a canonical option, case-insensitively.
      const rawCat = suggestion.category?.trim().toLowerCase();
      const category = rawCat ? CATEGORIES.find((c) => c === rawCat) ?? "" : "";

      setForm((f) => ({
        ...f,
        name: suggestion.name ?? f.name,
        distillery: suggestion.distillery ?? f.distillery,
        country: suggestion.country ?? f.country,
        region: suggestion.region ?? f.region,
        category: category || f.category,
        ageStatement: suggestion.ageStatement != null ? String(suggestion.ageStatement) : f.ageStatement,
        abv: suggestion.abv != null ? String(suggestion.abv) : f.abv,
        flavorTags:
          suggestion.flavorTags && suggestion.flavorTags.length > 0
            ? suggestion.flavorTags.join(", ")
            : f.flavorTags,
      }));
      setScanned(true);
      // Reading the label needs no search, so it's fast; pricing does, so it
      // runs as a separate, non-blocking follow-up once we have a name.
      if (suggestion.name) void lookupPrice(suggestion.name);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Could not read the label.");
    } finally {
      setScanning(false);
    }
  }

  async function lookupPrice(name: string) {
    setPriceLoading(true);
    try {
      const res = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return; // soft-fail, the label read already succeeded
      const { offers } = (await res.json()) as { offers?: { priceEur: number | null; retailer: string }[] };
      const cheapest = offers?.[0];
      if (cheapest?.priceEur != null) {
        setForm((f) => ({
          ...f,
          purchasePriceEur: String(cheapest.priceEur),
          purchaseStore: cheapest.retailer,
        }));
      }
    } catch {
      // Soft-fail: leave price blank, the user can fill it in or retry.
    } finally {
      setPriceLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      distillery: form.distillery.trim() || null,
      country: form.country.trim() || null,
      region: form.region.trim() || null,
      category: form.category || null,
      ageStatement: form.ageStatement ? Number(form.ageStatement) : null,
      abv: form.abv ? Number(form.abv) : null,
      status: form.status,
      rating: form.rating ? Number(form.rating) : null,
      purchasePriceEur: form.purchasePriceEur ? Number(form.purchasePriceEur) : null,
      purchaseStore: form.purchaseStore.trim() || null,
      targetPriceEur:
        form.status === "wishlist" && form.targetPriceEur ? Number(form.targetPriceEur) : null,
      flavorTags: form.flavorTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      descriptionEn: form.descriptionEn.trim() || null,
      descriptionNl: form.descriptionNl.trim() || null,
    };

    try {
      const res = await fetch(initial ? `/api/bottles/${initial.id}` : "/api/bottles", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not save the bottle.");
      }
      const saved = (await res.json()) as BottleDTO;
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night-950/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="my-8 w-full max-w-2xl rounded-2xl border border-cask-800/70 bg-night-900 p-6 shadow-2xl"
      >
        <h2 className="font-serif text-2xl text-cask-100">
          {initial ? "Edit bottle" : "Add a bottle"}
        </h2>

        <div className="mt-5 rounded-xl border border-dashed border-cask-700/60 bg-night-950/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-cask-100">📷 Add by photo</p>
              <p className="text-xs text-cask-200/60">
                Snap the label and let AI fill in the details. Check them before saving.
              </p>
            </div>
            <label
              className={`shrink-0 cursor-pointer rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400 ${
                scanning ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {scanning ? "Reading…" : "Scan label"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPickPhoto}
                disabled={scanning}
              />
            </label>
          </div>
          {scanError && <p className="mt-2 text-sm text-red-400">{scanError}</p>}
          {scanned && !scanError && (
            <p className="mt-2 text-sm text-cask-300">
              Filled in from the photo
              {priceLoading
                ? ". Looking up the best price…"
                : ". Any price found is a current estimate from the retailer's site. Verify before buying."}{" "}
              Review and edit anything below, then save.
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name} onChange={set("name")} required
              placeholder="Lagavulin 16 Year Old" />
          </div>
          <div>
            <label className={labelCls}>Distillery / brand</label>
            <input className={inputCls} value={form.distillery} onChange={set("distillery")} />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select className={inputCls} value={form.category} onChange={set("category")}>
              <option value="">Choose a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input className={inputCls} value={form.country} onChange={set("country")} placeholder="Scotland" />
          </div>
          <div>
            <label className={labelCls}>Region</label>
            <input className={inputCls} value={form.region} onChange={set("region")} placeholder="Islay" />
          </div>
          <div>
            <label className={labelCls}>Age (years)</label>
            <input className={inputCls} type="number" min={0} max={100} value={form.ageStatement} onChange={set("ageStatement")} />
          </div>
          <div>
            <label className={labelCls}>ABV %</label>
            <input className={inputCls} type="number" step="0.1" min={0} max={100} value={form.abv} onChange={set("abv")} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={set("status")}>
              {BOTTLE_STATUSES.map((s) => (
                <option key={s} value={s}>{BOTTLE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Your rating (0–100)</label>
            <input className={inputCls} type="number" min={0} max={100} value={form.rating} onChange={set("rating")} />
          </div>
          <div>
            <label className={labelCls}>Price paid (€)</label>
            <input className={inputCls} type="number" step="0.01" min={0} value={form.purchasePriceEur} onChange={set("purchasePriceEur")} />
          </div>
          <div>
            <label className={labelCls}>Bought at</label>
            <input className={inputCls} value={form.purchaseStore} onChange={set("purchaseStore")} placeholder="Gall & Gall" />
          </div>
          {form.status === "wishlist" && (
            <div className="sm:col-span-2 rounded-lg border border-cask-800/60 bg-night-950/40 p-3">
              <label className={labelCls}>🎯 Target price (€): watch for a drop</label>
              <input className={inputCls} type="number" step="0.01" min={0} value={form.targetPriceEur} onChange={set("targetPriceEur")} placeholder="e.g. 45.00" />
              <p className="mt-1 text-xs text-cask-200/50">
                We&apos;ll re-check {retailerNamesLabel()} daily and flag it in your
                Watchlist (and email you, if email is configured) when it drops to this price.
              </p>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelCls}>Flavour tags (comma-separated)</label>
            <input className={inputCls} value={form.flavorTags} onChange={set("flavorTags")} placeholder="peat, smoke, sea salt, vanilla" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls} rows={3} value={form.notes} onChange={set("notes")} />
            <p className="mt-1 text-xs text-cask-200/40">Your own private tasting notes.</p>
          </div>
          <div>
            <label className={labelCls}>Description (English)</label>
            <textarea
              className={inputCls}
              rows={3}
              value={form.descriptionEn}
              onChange={set("descriptionEn")}
              placeholder="What makes this bottle special…"
            />
          </div>
          <div>
            <label className={labelCls}>Description (Nederlands)</label>
            <textarea
              className={inputCls}
              rows={3}
              value={form.descriptionNl}
              onChange={set("descriptionNl")}
              placeholder="Wat maakt deze fles bijzonder…"
            />
          </div>
          <p className="sm:col-span-2 -mt-2 text-xs text-cask-200/40">
            Describe the whisky here. This appears when you hover over the info icon on a bottle card.
            Your tasting notes stay separate.
          </p>
          <div className="sm:col-span-2">
            <label className={labelCls}>Image URL</label>
            <input className={inputCls} value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-cask-800 px-4 py-2 text-sm text-cask-200 hover:border-cask-600">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-cask-500 px-5 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400 disabled:opacity-50">
            {saving ? "Saving…" : initial ? "Save changes" : "Add bottle"}
          </button>
        </div>
      </form>
    </div>
  );
}
