import Link from "next/link";
import { stackServerApp } from "@/stack";
import { NL_RETAILERS, retailerNamesLabel } from "@/lib/types";

export default async function LandingPage() {
  const user = await stackServerApp.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-6 rounded-full border border-cask-700/60 bg-cask-950/40 px-4 py-1 text-sm text-cask-300">
        🥃 Your whisky, organised
      </span>
      <h1 className="font-serif text-5xl font-bold leading-tight text-cask-100 sm:text-6xl">
        Whiskey&nbsp;Stack
      </h1>
      <p className="mt-5 max-w-xl text-lg text-cask-200/80">
        Keep track of every label on your shelf, then let AI find your next bottle,
        matched to your taste and priced across {retailerNamesLabel()} so you
        always buy the cheapest.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        {user ? (
          <Link
            href="/collection"
            className="rounded-lg bg-cask-500 px-6 py-3 font-semibold text-night-950 transition hover:bg-cask-400"
          >
            Open your collection →
          </Link>
        ) : (
          <>
            <Link
              href="/handler/sign-in"
              className="rounded-lg bg-cask-500 px-6 py-3 font-semibold text-night-950 transition hover:bg-cask-400"
            >
              Sign in with a magic link
            </Link>
            <Link
              href="/handler/sign-up"
              className="rounded-lg border border-cask-700 px-6 py-3 font-semibold text-cask-100 transition hover:border-cask-500"
            >
              Create an account
            </Link>
          </>
        )}
      </div>

      <div className="mt-16 grid gap-5 sm:grid-cols-3">
        {[
          { t: "Your shelf", d: "Log bottles with tasting notes, ratings, ABV and price." },
          { t: "AI discovery", d: "Get bottles that fill the gaps in your collection." },
          { t: "Best NL price", d: `Cheapest offer across ${NL_RETAILERS.length} NL retailers.` },
        ].map((f) => (
          <div
            key={f.t}
            className="rounded-xl border border-cask-800/60 bg-night-800/40 p-5 text-left"
          >
            <h3 className="font-serif text-lg text-cask-200">{f.t}</h3>
            <p className="mt-1 text-sm text-cask-200/70">{f.d}</p>
          </div>
        ))}
      </div>

      <footer className="mt-16 text-xs text-cask-200/40">
        Open source · self-hostable on Vercel · drink responsibly.
      </footer>
    </main>
  );
}
