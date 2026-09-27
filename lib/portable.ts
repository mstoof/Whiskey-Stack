import type { BottleDTO } from "./serialize";

/**
 * Data portability for the collection (CSV + JSON). Pure functions, safe to
 * import from client components: no server-only deps. Export runs entirely in
 * the browser off the already-loaded BottleDTO[]; import parses a file into
 * candidate objects that the /api/bottles/import route re-validates with
 * `bottleInputSchema` (so nothing here is trusted server-side).
 */

/**
 * Editable columns included in a CSV export, in order. Server-set fields
 * (`id`, timestamps) and cron-written price-watch fields are intentionally
 * omitted since they aren't re-importable and would just clutter a spreadsheet.
 * JSON export keeps the full DTO instead (see `bottlesToJson`).
 */
export const EXPORT_COLUMNS = [
  "name",
  "distillery",
  "country",
  "region",
  "category",
  "ageStatement",
  "abv",
  "status",
  "rating",
  "purchasePriceEur",
  "purchaseStore",
  "targetPriceEur",
  "flavorTags",
  "notes",
  "imageUrl",
  "descriptionEn",
  "descriptionNl",
] as const;

type ExportColumn = (typeof EXPORT_COLUMNS)[number];

// ─── Export ──────────────────────────────────────────────────────────────────

/** RFC-4180 quoting: wrap cells containing quote/comma/newline, double quotes. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function cellValue(b: BottleDTO, col: ExportColumn): string {
  if (col === "flavorTags") return (b.flavorTags ?? []).join("; ");
  const v = b[col] as string | number | null;
  return v == null ? "" : String(v);
}

/** The collection as CSV: header row of EXPORT_COLUMNS + one row per bottle. */
export function bottlesToCsv(bottles: BottleDTO[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const rows = bottles.map((b) => EXPORT_COLUMNS.map((col) => csvCell(cellValue(b, col))).join(","));
  return [header, ...rows].join("\r\n");
}

/** The collection as pretty JSON: the full DTO (lossless personal record). */
export function bottlesToJson(bottles: BottleDTO[]): string {
  return JSON.stringify(bottles, null, 2);
}

// ─── Import ──────────────────────────────────────────────────────────────────

/** Quote-aware CSV → rows of cells. Handles CRLF/LF, escaped `""`, and a BOM. */
function parseCsvRows(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse CSV text into objects keyed by the (trimmed) header row. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((cells) => !(cells.length === 1 && cells[0] === "")) // drop blank lines
    .map((cells) => {
      const obj: Record<string, string> = {};
      header.forEach((key, idx) => {
        obj[key] = cells[idx] ?? "";
      });
      return obj;
    });
}

/**
 * One CSV row → a candidate bottle object for `bottleInputSchema`. Empty cells
 * are OMITTED (not sent as ""), which matters because `z.coerce.number("")` is
 * `0`, so a blank ABV must import as null/absent, not zero, and schema
 * defaults (e.g. status "owned") apply. Numeric strings are left as strings;
 * the schema's `z.coerce.number()` handles them. `flavorTags` splits on `;`/`,`.
 */
export function csvRowToCandidate(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of EXPORT_COLUMNS) {
    const raw = row[col];
    if (raw == null) continue;
    const value = raw.trim();
    if (col === "flavorTags") {
      const tags = value
        .split(/[;,]/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) out.flavorTags = tags;
      continue;
    }
    if (value === "") continue;
    out[col] = value;
  }
  return out;
}

function looksLikeJson(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("[") || t.startsWith("{");
}

/**
 * Turn an uploaded file's text into an array of candidate bottle objects. JSON
 * may be a raw array or a `{ bottles: [...] }` wrapper (what our own export could
 * grow into); anything else is treated as CSV. The server validates every entry,
 * so unknown/untrusted keys (id, userId, timestamps) are harmless here.
 */
export function readImportFile(text: string, filename: string): unknown[] {
  const isJson = filename.toLowerCase().endsWith(".json") || (!filename.toLowerCase().endsWith(".csv") && looksLikeJson(text));
  if (isJson) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { bottles?: unknown }).bottles)) {
      return (parsed as { bottles: unknown[] }).bottles;
    }
    throw new Error('JSON must be an array of bottles or an object with a "bottles" array.');
  }
  return parseCsv(text).map(csvRowToCandidate);
}
