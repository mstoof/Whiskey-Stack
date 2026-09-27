"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UserButton } from "@stackframe/stack";
import { useLanguage, type DescriptionLanguage } from "./LanguageProvider";

interface NavLink {
  href: string;
  label: string;
}

/** Always visible, standalone. */
const SETTINGS: NavLink = { href: "/settings", label: "Settings" };

/**
 * Everything, grouped into dropdowns, keeps the bar to 5 top-level items
 * (4 groups + Settings) instead of one link per page.
 */
const GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: "Collection",
    links: [
      { href: "/collection", label: "Collection" },
      { href: "/wishlist", label: "Wishlist" },
    ],
  },
  {
    label: "Discover",
    links: [
      { href: "/discover", label: "Discover" },
      { href: "/complete", label: "Complete the set" },
      { href: "/picks", label: "Picks" },
    ],
  },
  {
    label: "Insights",
    links: [
      { href: "/insights", label: "Insights" },
      { href: "/value", label: "Value" },
    ],
  },
  {
    label: "Activity",
    links: [
      { href: "/watchlist", label: "Watchlist" },
      { href: "/flights", label: "Flights" },
    ],
  },
];

const linkCls = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
    active ? "bg-cask-500/15 text-cask-200" : "text-cask-200/60 hover:text-cask-100"
  }`;

function NavGroup({ label, links, active }: { label: string; links: NavLink[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click: dropdowns don't otherwise know when to give up focus.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 ${linkCls(active)}`}
        aria-expanded={open}
      >
        {label}
        <span className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-cask-800/70 bg-night-900 p-1 shadow-xl">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-cask-200/80 transition hover:bg-cask-500/10 hover:text-cask-100"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * EN/NL toggle for bottle description tooltips only. See LanguageProvider.
 * Everything else in the UI has no Dutch copy and stays English either way.
 */
function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const options: DescriptionLanguage[] = ["en", "nl"];

  return (
    <div
      className="flex rounded-lg border border-cask-800/70 bg-night-900/60 p-1"
      title="Description language"
    >
      {options.map((l) => (
        <button
          key={l}
          onClick={() => setLanguage(l)}
          aria-pressed={language === l}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition ${
            language === l ? "bg-cask-500/20 text-cask-200" : "text-cask-200/50 hover:text-cask-100"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-cask-900/70 bg-night-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
        <Link href="/collection" className="font-serif text-lg font-bold text-cask-200">
          🥃 Whiskey&nbsp;Stack
        </Link>
        <div className="flex items-center gap-1">
          {GROUPS.map((g) => (
            <NavGroup
              key={g.label}
              label={g.label}
              links={g.links}
              active={g.links.some((l) => l.href === pathname)}
            />
          ))}
          <Link href={SETTINGS.href} className={linkCls(pathname === SETTINGS.href)}>
            {SETTINGS.label}
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <LanguageToggle />
          <UserButton />
        </div>
      </nav>
    </header>
  );
}
