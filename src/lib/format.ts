// Money is in PKR. Clean, no-decimal display for a luxury feel: "Rs 48,000".
const pkr = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number): string {
  return `Rs ${pkr.format(Math.round(amount))}`;
}

export function discountPercent(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Rupees saved per piece vs the compare-at price, or null when not on sale. */
export function savingsOf(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return compareAt - price;
}

/** "12 Oct 2026" (or "12 Oct" with `year: false`, plus "3:05 pm" with `time: true`). */
export function formatDate(
  date: Date | string,
  { year = true, time = false }: { year?: boolean; time?: boolean } = {}
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (year) opts.year = "numeric";
  if (time) Object.assign(opts, { hour: "numeric", minute: "2-digit" });
  return time ? d.toLocaleString("en-PK", opts) : d.toLocaleDateString("en-PK", opts);
}
