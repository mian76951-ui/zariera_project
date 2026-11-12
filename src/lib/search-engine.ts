import type { CategoryView, ProductView } from "./types";

// Storefront search: typo-tolerant, plural-aware, understands a few Urdu /
// everyday words ("angoothi", "kangan", "jhumka"), price phrases ("under 3000")
// and offer words ("sale"). Pure — runs on the product list in memory, which is
// fine for a catalog of a few thousand pieces.

export type SearchCategory = CategoryView & { count: number };

export type SearchResult = {
  products: ProductView[];
  /** Category the query asked for (e.g. "rings", "necklecs" → Necklaces). */
  category: SearchCategory | null;
  /** Typos we read past: "necklecs" → "necklace". */
  corrections: { from: string; to: string }[];
  minPrice: number | null;
  maxPrice: number | null;
  onSale: boolean;
  /** Not every word matched — these are the closest pieces instead. */
  partial: boolean;
};

const STOP = new Set(
  "a an and the for of with in on to my me i want need show find looking some any all piece pieces jewelry jewellery jewel item items product products buy rs pkr price under below above over less more than upto up max min within from between ki ka ke ky chahiye chahye dikhao wala wali waly".split(" ")
);

/** Everyday / Urdu words → the word the catalog uses. */
const ALIASES: Record<string, string> = {
  angoothi: "ring", anguthi: "ring", angothi: "ring", angootha: "ring", challa: "ring",
  haar: "necklace", har: "necklace", mala: "necklace", pendant: "necklace", locket: "necklace", choker: "necklace",
  jhumka: "earring", jhumki: "earring", bali: "earring", baliyan: "earring", tops: "earring", stud: "earring", hoop: "earring", earing: "earring",
  kangan: "bangle", kara: "bangle", kada: "bangle", churi: "bangle", chudi: "bangle",
  sona: "gold", sonay: "gold", golden: "gold", chandi: "silver", silvery: "silver",
  stainless: "steel", ss: "steel",
};

/** Words that point at a category even when the product name doesn't use them. */
const CATEGORY_HINTS: Record<string, string> = {
  bangle: "bracelet",
};

const SALE_WORDS = new Set(["sale", "sales", "discount", "discounted", "offer", "offers", "deal", "deals", "off"]);

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** rings → ring, necklaces → necklace, watches → watch. */
function singular(w: string): string {
  if (w.length > 4 && /(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function words(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular);
}

/** Damerau–Levenshtein distance, stops early once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** How well one query word matches one catalog word: 1 exact, 0.85 prefix (0.75 for 1–2 letters), 0.65 typo, 0 none. */
function similarity(q: string, t: string): number {
  if (q === t) return 1;
  if (t.startsWith(q)) return q.length >= 3 ? 0.85 : 0.75;
  if (q.length < 3 || (q.length === 3 && t.length < 4)) return 0;
  const allowed = q.length >= 7 ? 2 : 1;
  return distance(q, t, allowed) <= allowed ? 0.65 : 0;
}

type Field = { words: string[]; weight: number };

function fieldsOf(p: ProductView): Field[] {
  return [
    { words: words(p.name), weight: 5 },
    { words: words(p.category.name), weight: 6 },
    { words: words(p.material ?? ""), weight: 3 },
    { words: words(`${p.description ?? ""} ${p.specs ?? ""}`), weight: 1 },
  ];
}

function parsePrice(text: string): { min: number | null; max: number | null; rest: string } {
  let min: number | null = null;
  let max: number | null = null;
  const num = (s: string) => {
    const n = Number(s.replace(/,/g, "").replace(/k$/i, ""));
    return /k$/i.test(s) ? n * 1000 : n;
  };
  const N = String.raw`(?:rs\.?\s*)?(\d[\d,]*k?)`;
  let rest = text
    .replace(new RegExp(String.raw`\b${N}\s*(?:-|to)\s*${N}\b`, "gi"), (_, a, b) => {
      min = num(a);
      max = num(b);
      return " ";
    })
    .replace(new RegExp(String.raw`\b(?:under|below|less than|upto|up to|within|max|tak)\s*${N}`, "gi"), (_, a) => {
      max = num(a);
      return " ";
    })
    .replace(new RegExp(String.raw`\b(?:above|over|more than|from|min)\s*${N}`, "gi"), (_, a) => {
      min = num(a);
      return " ";
    });
  // "3000 se kam" / "3000 tak"
  rest = rest.replace(new RegExp(String.raw`${N}\s*(?:se kam|tak|or less)\b`, "gi"), (_, a) => {
    max = num(a);
    return " ";
  });
  return { min, max, rest };
}

export function searchCatalog(
  query: string,
  products: ProductView[],
  categories: SearchCategory[]
): SearchResult {
  const { min, max, rest } = parsePrice(fold(query));
  const isNum = (w: string) => /^\d+$/.test(w);
  const typed = words(rest);
  const raw = typed.filter((w) => !STOP.has(w) && !isNum(w));
  const onSale = raw.some((w) => SALE_WORDS.has(w));
  const terms = raw.filter((w) => !SALE_WORDS.has(w)).map((w) => ALIASES[w] ?? w);
  // Still typing a first short word that happens to be a stop word ("a", "on"):
  // treat it as a prefix instead of listing the whole catalog.
  const last = typed.at(-1);
  if (terms.length === 0 && !onSale && min == null && max == null && last && !isNum(last)) terms.push(last);

  // Words the catalog knows; typos are corrected towards names / categories / materials only.
  const vocab = new Set<string>();
  const known = new Set<string>();
  for (const p of products) {
    fieldsOf(p).forEach((f, i) => f.words.forEach((w) => (i < 3 ? vocab : known).add(w)));
  }
  for (const c of categories) words(c.name).forEach((w) => vocab.add(w));
  vocab.forEach((w) => known.add(w));

  const corrections: { from: string; to: string }[] = [];
  const fixed = terms.map((t) => {
    if (known.has(t)) return t;
    for (const v of known) if (v.startsWith(t)) return t;
    let best = "";
    let bestScore = 0;
    for (const v of vocab) {
      const s = similarity(t, v);
      if (s > bestScore) [best, bestScore] = [v, s];
    }
    if (best) {
      corrections.push({ from: t, to: best });
      return best;
    }
    return t;
  });

  // A word that names a category ("ring", "necklace", "bangle" → bracelet).
  let category: SearchCategory | null = null;
  for (const t of fixed) {
    const target = CATEGORY_HINTS[t] ?? t;
    const hit = categories.find((c) => words(c.name).includes(target));
    if (hit) {
      category = hit;
      break;
    }
  }

  const inRange = (p: ProductView) =>
    (min == null || p.price >= min) &&
    (max == null || p.price <= max) &&
    (!onSale || (p.compareAtPrice != null && p.compareAtPrice > p.price));

  const categoryWord = category ? singular(fold(category.name)) : null;
  const scored = products.filter(inRange).map((p) => {
    const fields = fieldsOf(p);
    let score = 0;
    let matched = 0;
    for (const t of fixed) {
      const isCategoryWord = (CATEGORY_HINTS[t] ?? t) === categoryWord;
      // "necklace" shouldn't pull in a ring whose description mentions necklaces.
      // 1–2 letters only match name / category / material, or "g" would hit every description.
      const n = (isCategoryWord && p.category.slug !== category!.slug) || t.length < 3 ? 3 : fields.length;
      let best = 0;
      for (let i = 0; i < n; i++) for (const w of fields[i].words) best = Math.max(best, similarity(t, w) * fields[i].weight);
      if (isCategoryWord && p.category.slug === category!.slug) {
        // In the category; pieces whose name says it too ("… Bangle" for "bangles") come first.
        const named = fields[0].words.some((w) => similarity(t, w) > 0);
        best = Math.max(best, 6) + (named ? 2 : 0);
      }
      if (best > 0) matched++;
      score += best;
    }
    // Small nudges so ties look sensible: in stock first, then featured.
    score += (p.stock > 0 ? 0.3 : 0) + (p.featured ? 0.1 : 0);
    return { p, score, matched };
  });

  if (fixed.length === 0) {
    // Only a price range and/or "sale" — list everything that fits.
    const list = scored.sort((a, b) => b.score - a.score).map((x) => x.p);
    return { products: list, category: null, corrections, minPrice: min, maxPrice: max, onSale, partial: false };
  }

  const all = scored.filter((x) => x.matched === fixed.length);
  const some = scored.filter((x) => x.matched > 0);
  const partial = all.length === 0 && some.length > 0;
  const list = (partial ? some : all).sort((a, b) => b.matched - a.matched || b.score - a.score).map((x) => x.p);

  return { products: list, category, corrections, minPrice: min, maxPrice: max, onSale, partial };
}
