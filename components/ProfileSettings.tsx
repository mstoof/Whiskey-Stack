"use client";

import { useState } from "react";
import { HANDLE_RE } from "@/lib/types";
import type { ProfileDTO } from "@/lib/serialize";

const inputCls =
  "w-full rounded-lg border border-cask-800/70 bg-night-900/60 px-3 py-2 text-sm text-cask-100 outline-none focus:border-cask-500";

export function ProfileSettings({
  initial,
  appUrl,
}: {
  initial: ProfileDTO | null;
  appUrl: string;
}) {
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // The handle whose public link we can safely show, only after a successful save.
  const [savedHandle, setSavedHandle] = useState(initial?.isPublic ? initial.handle : null);
  const [copied, setCopied] = useState(false);

  const normalized = handle.trim().toLowerCase();
  const handleValid = HANDLE_RE.test(normalized);
  const shareUrl = savedHandle ? `${appUrl}/u/${savedHandle}` : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: normalized, displayName, bio, isPublic }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not save.");
      const p: ProfileDTO = data.profile;
      setHandle(p.handle);
      setDisplayName(p.displayName ?? "");
      setBio(p.bio ?? "");
      setIsPublic(p.isPublic);
      setSavedHandle(p.isPublic ? p.handle : null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked. The link is visible for manual copy anyway.
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-cask-900/70 bg-night-900/40 p-6">
      <h2 className="font-serif text-xl text-cask-100">Your public shelf</h2>
      <p className="mt-1 text-sm text-cask-200/60">
        Shows bottles you own and have finished. Never prices, tasting notes, or your wishlist.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-cask-200">Handle</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-cask-200/40">/u/</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="peaty-pete"
              className={inputCls}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          {handle && !handleValid && (
            <span className="mt-1 block text-xs text-red-400">
              3–30 characters: lowercase letters, numbers and hyphens.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-cask-200">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional, shown as the page title"
            maxLength={60}
            className={`${inputCls} mt-1`}
          />
        </label>

        <label className="block">
          <span className="text-sm text-cask-200">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Optional, a short line about your shelf"
            maxLength={280}
            rows={2}
            className={`${inputCls} mt-1 resize-none`}
          />
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-1 h-4 w-4 accent-cask-500"
          />
          <span className="text-sm text-cask-200">
            Make my shelf public
            <span className="block text-xs text-cask-200/50">
              Anyone with the link can view it. Turn this off any time to take it offline.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !handleValid}
          className={`rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400 ${
            busy || !handleValid ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && !error && <span className="text-xs text-cask-200/60">Saved</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      {shareUrl && (
        <div className="mt-6 rounded-lg border border-cask-800/60 bg-night-950/40 p-4">
          <p className="text-xs uppercase tracking-wide text-cask-200/40">Your shelf is live at</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a href={`/u/${savedHandle}`} className="break-all text-sm text-cask-300 hover:text-cask-100">
              {shareUrl}
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border border-cask-800 px-3 py-1 text-xs text-cask-200 transition hover:border-cask-600"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={`/u/${savedHandle}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-cask-800 px-3 py-1 text-xs text-cask-200 transition hover:border-cask-600"
            >
              View
            </a>
          </div>
        </div>
      )}
    </form>
  );
}
