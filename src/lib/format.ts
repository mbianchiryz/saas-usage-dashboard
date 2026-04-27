export function fmtUSD(n: number, opts?: { compact?: boolean }) {
  if (opts?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(n);
}

export function fmtNum(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}
