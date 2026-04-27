export interface AmexRow {
  date: string;           // YYYY-MM-DD
  description: string;
  amount: number;         // positive = charge
  category?: string;
  reference?: string;
  provider: "anthropic" | "openai" | null;
}

export interface ParseResult {
  rows: AmexRow[];
  skipped: number;
  format: string;
}

const MERCHANT_PATTERNS: { provider: "anthropic" | "openai"; patterns: RegExp[] }[] = [
  {
    provider: "anthropic",
    patterns: [/anthropic/i, /claude/i],
  },
  {
    provider: "openai",
    patterns: [/openai/i, /chatgpt/i, /open\s*ai/i],
  },
];

function matchProvider(text: string): "anthropic" | "openai" | null {
  for (const { provider, patterns } of MERCHANT_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return provider;
  }
  return null;
}

function parseDate(raw: string): string {
  raw = raw.trim();
  // MM/DD/YYYY → YYYY-MM-DD
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  // YYYY-MM-DD passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return raw;
}

function parseAmount(raw: string): number {
  // Amex exports charges as positive, credits as negative
  // Some exports use negative for charges — we normalise to positive = charge
  const clean = raw.replace(/[,$\s]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.abs(n);
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

function detectColumns(header: string[]): {
  date: number; description: number; amount: number; category?: number; reference?: number;
} | null {
  const h = header.map((c) => c.toLowerCase().replace(/[^a-z]/g, ""));

  const dateIdx = h.findIndex((c) => c.includes("date"));
  const descIdx = h.findIndex(
    (c) => c.includes("description") || c.includes("merchant") || c.includes("payee") || c.includes("transaction"),
  );
  const amtIdx = h.findIndex(
    (c) => c.includes("amount") || c.includes("debit") || c.includes("charge"),
  );

  if (dateIdx === -1 || descIdx === -1 || amtIdx === -1) return null;

  return {
    date: dateIdx,
    description: descIdx,
    amount: amtIdx,
    category: h.findIndex((c) => c.includes("category")) >= 0 ? h.findIndex((c) => c.includes("category")) : undefined,
    reference: h.findIndex((c) => c.includes("reference") || c.includes("ref")) >= 0
      ? h.findIndex((c) => c.includes("reference") || c.includes("ref"))
      : undefined,
  };
}

export function parseAmexCsv(csvText: string): ParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0, format: "unknown" };

  // Find the header row (skip any Amex preamble lines)
  let headerIdx = 0;
  let cols: ReturnType<typeof detectColumns> = null;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const parts = splitCsvLine(lines[i]);
    cols = detectColumns(parts);
    if (cols) { headerIdx = i; break; }
  }

  // Fallback: assume 3-column format (Date, Description, Amount)
  const fallback = !cols;
  if (fallback) {
    cols = { date: 0, description: 1, amount: 2 };
  }

  const format = fallback ? "3-column (fallback)" : `detected (cols: date=${cols!.date}, desc=${cols!.description}, amt=${cols!.amount})`;

  const rows: AmexRow[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    if (parts.length < 3) { skipped++; continue; }

    const dateRaw = parts[cols!.date] ?? "";
    const descRaw = parts[cols!.description] ?? "";
    const amtRaw = parts[cols!.amount] ?? "";

    const date = parseDate(dateRaw);
    const amount = parseAmount(amtRaw);

    if (!date || amount === 0) { skipped++; continue; }

    const matchText = [descRaw, parts[cols!.category ?? -1] ?? ""].join(" ");
    const provider = matchProvider(matchText);

    rows.push({
      date,
      description: descRaw,
      amount,
      category: cols!.category !== undefined ? parts[cols!.category] : undefined,
      reference: cols!.reference !== undefined ? parts[cols!.reference] : undefined,
      provider,
    });
  }

  return { rows, skipped, format };
}
