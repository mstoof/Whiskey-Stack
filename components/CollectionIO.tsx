"use client";

import { useState } from "react";
import type { BottleDTO } from "@/lib/serialize";
import { bottlesToCsv, bottlesToJson, readImportFile } from "@/lib/portable";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Build a Blob and trigger a browser download. No server round-trip. */
function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export (CSV/JSON) + import controls for the collection toolbar. */
export function CollectionIO({
  bottles,
  onImported,
}: {
  bottles: BottleDTO[];
  onImported: (dtos: BottleDTO[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Run an action then collapse the native <details> menu it lives in.
  const runAndClose = (fn: () => void) => (e: React.MouseEvent) => {
    fn();
    (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
  };

  function exportCsv() {
    download(`whiskey-stack-collection-${today()}.csv`, bottlesToCsv(bottles), "text/csv;charset=utf-8");
  }
  function exportJson() {
    download(`whiskey-stack-collection-${today()}.json`, bottlesToJson(bottles), "application/json");
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const rows = readImportFile(await file.text(), file.name);
      if (rows.length === 0) throw new Error("No rows found in that file.");
      const res = await fetch("/api/bottles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bottles: rows }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Import failed.");
      if (Array.isArray(data.bottles) && data.bottles.length) onImported(data.bottles);
      let msg = `Imported ${data.imported}`;
      if (data.skipped) msg += ` · skipped ${data.skipped}`;
      if (data.errors?.length) msg += ` (row ${data.errors[0].row}: ${data.errors[0].message})`;
      setStatus(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-lg border border-cask-800 px-4 py-2 text-sm text-cask-200 transition hover:border-cask-600 [&::-webkit-details-marker]:hidden">
          Export
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-cask-800 bg-night-900 shadow-lg">
          <button
            onClick={runAndClose(exportCsv)}
            className="block w-full px-4 py-2 text-left text-sm text-cask-200 transition hover:bg-cask-500/10"
          >
            Download CSV
          </button>
          <button
            onClick={runAndClose(exportJson)}
            className="block w-full px-4 py-2 text-left text-sm text-cask-200 transition hover:bg-cask-500/10"
          >
            Download JSON
          </button>
        </div>
      </details>

      <label
        className={`shrink-0 cursor-pointer rounded-lg border border-cask-800 px-4 py-2 text-sm text-cask-200 transition hover:border-cask-600 ${
          busy ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {busy ? "Importing…" : "Import"}
        <input
          type="file"
          accept=".csv,.json,application/json,text/csv"
          className="hidden"
          onChange={onPickFile}
          disabled={busy}
        />
      </label>

      {(status || error) && (
        <span
          title={error ?? status ?? undefined}
          className={`max-w-[240px] truncate text-xs ${error ? "text-red-400" : "text-cask-200/60"}`}
        >
          {error ?? status}
        </span>
      )}
    </div>
  );
}
