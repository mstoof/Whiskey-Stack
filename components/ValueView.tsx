"use client";

import type { ValueSnapshotDTO } from "@/lib/serialize";

function fmtEur(n: number): string {
  return `€${n.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
}

function fmtEurSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}€${Math.abs(n).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cask-800/70 bg-night-900/60 px-4 py-3">
      <div className="text-2xl font-semibold text-cask-100 tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wide text-cask-200/50">{label}</div>
    </div>
  );
}

/** Pure-SVG line chart: cost basis (always) + watched market value (if any). */
function ValueLineChart({ snapshots }: { snapshots: ValueSnapshotDTO[] }) {
  const width = 640;
  const height = 260;
  const padL = 56;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const n = snapshots.length;
  const maxVal = Math.max(
    1,
    ...snapshots.map((s) => s.purchaseValueEur),
    ...snapshots.map((s) => s.marketValueEur ?? 0),
  );
  const niceMax = Math.ceil((maxVal * 1.15) / 4) * 4;

  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) => padT + innerH - (innerH * v) / niceMax;

  const purchasePath = snapshots
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.purchaseValueEur).toFixed(1)}`)
    .join(" ");

  const marketPoints = snapshots
    .map((s, i) => (s.marketValueEur != null ? { i, v: s.marketValueEur } : null))
    .filter((p): p is { i: number; v: number } => p != null);
  const marketPath = marketPoints
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(" ");

  const gridFracs = [0, 0.25, 0.5, 0.75, 1];
  const labelIdx =
    n <= 5
      ? snapshots.map((_, i) => i)
      : [...new Set([0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((3 * (n - 1)) / 4), n - 1])];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Collection value over time"
    >
      {gridFracs.map((f) => (
        <g key={f}>
          <line
            x1={padL}
            y1={y(niceMax * f)}
            x2={width - padR}
            y2={y(niceMax * f)}
            stroke="currentColor"
            className="text-cask-800/40"
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={y(niceMax * f)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-cask-200/50 text-[10px]"
          >
            {fmtEur(Math.round(niceMax * f))}
          </text>
        </g>
      ))}

      {labelIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={height - 6}
          textAnchor="middle"
          className="fill-cask-200/50 text-[10px]"
        >
          {fmtDate(snapshots[i].date)}
        </text>
      ))}

      <path
        d={purchasePath}
        fill="none"
        className="stroke-cask-400"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {snapshots.map((s, i) => (
        <circle key={i} cx={x(i)} cy={y(s.purchaseValueEur)} r={2.5} className="fill-cask-300" />
      ))}

      {marketPoints.length > 0 && (
        <path
          d={marketPath}
          fill="none"
          className="stroke-emerald-400"
          strokeWidth={2}
          strokeDasharray="4 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {marketPoints.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={2.5} className="fill-emerald-300" />
      ))}
    </svg>
  );
}

export function ValueView({ snapshots }: { snapshots: ValueSnapshotDTO[] }) {
  if (snapshots.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-3xl text-cask-100">Value</h1>
        <div className="mt-16 rounded-2xl border border-dashed border-cask-800/60 p-12 text-center">
          <p className="text-cask-200/60">
            No value history yet. We snapshot your collection&apos;s worth once a day. Add a
            few owned bottles and check back tomorrow.
          </p>
        </div>
      </div>
    );
  }

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const delta = latest.purchaseValueEur - first.purchaseValueEur;
  const hasMarket = snapshots.some((s) => s.marketValueEur != null);

  return (
    <div>
      <h1 className="font-serif text-3xl text-cask-100">Value</h1>
      <p className="mt-1 max-w-2xl text-sm text-cask-200/60">
        What you&apos;ve put into your shelf over time, plus the current market value of
        anything you&apos;re watching, from your daily price checks.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Owned bottles" value={String(latest.ownedCount)} />
        <Stat label="Cost basis" value={fmtEur(latest.purchaseValueEur)} />
        <Stat label="Watched value" value={latest.marketValueEur != null ? fmtEur(latest.marketValueEur) : "–"} />
        {snapshots.length > 1 && <Stat label={`Since ${fmtDate(first.date)}`} value={fmtEurSigned(delta)} />}
      </div>

      <div className="mt-6 rounded-2xl border border-cask-800/70 bg-night-900/60 p-5">
        <div className="flex flex-wrap items-center gap-4 text-xs text-cask-200/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cask-400" /> Cost basis
          </span>
          {hasMarket && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Watched market value
            </span>
          )}
        </div>
        <div className="mt-3">
          {snapshots.length < 2 ? (
            <p className="py-10 text-center text-sm text-cask-200/50">
              Just one snapshot so far. A trend line appears once we have a few days of history.
            </p>
          ) : (
            <ValueLineChart snapshots={snapshots} />
          )}
        </div>
      </div>

      <p className="mt-4 text-[11px] text-cask-200/40">
        Cost basis is what you paid for owned bottles. Watched value is the cheapest NL price we
        found the last time we checked a watched wishlist bottle, not a live market price.
      </p>
    </div>
  );
}
