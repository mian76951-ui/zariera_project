import { emailError, phoneError } from "./auth-rules";

// Options for the custom-design request form (shared by the form + server action).
export const PIECE_TYPES = ["Ring", "Necklace / Pendant", "Bracelet / Bangle", "Earrings", "Full set", "Other"] as const;
export const FINISHES = ["Gold-tone", "Silver-tone", "Rose gold-tone", "Two-tone", "Not sure yet"] as const;
export const BUDGETS = ["Under Rs 3,000", "Rs 3,000 – 6,000", "Rs 6,000 – 10,000", "Rs 10,000+", "Not sure yet"] as const;

// Reference photos attached to a custom-design request.
export const MAX_REFERENCE_PHOTOS = 3;
/** Per photo, after the browser shrinks it (originals it can't shrink must fit too). */
export const MAX_REFERENCE_BYTES = 3 * 1024 * 1024;
/** Heading the server writes above the photo links in the saved message. */
export const REFERENCE_PHOTOS_HEADING = "Reference photos:";

// Only links to our own reference uploads are treated as photos (a customer
// could type the heading into their description).
const OWN_REFERENCE_URL =
  /^(\/uploads\/references\/[a-z0-9-]+\.(jpg|png|webp|avif)|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/references\/[a-z0-9-]+\.(jpg|png|webp|avif))$/;

/** Splits a saved custom-request message into its text and reference-photo URLs. */
export function splitReferencePhotos(message: string): { text: string; photos: string[] } {
  const at = message.lastIndexOf(`\n${REFERENCE_PHOTOS_HEADING}\n`);
  if (at === -1) return { text: message, photos: [] };
  const lines = message.slice(at + REFERENCE_PHOTOS_HEADING.length + 2).split("\n").map((l) => l.trim());
  const photos = lines.filter((l) => OWN_REFERENCE_URL.test(l));
  if (photos.length === 0 || photos.length !== lines.filter(Boolean).length) return { text: message, photos: [] };
  return { text: message.slice(0, at).trimEnd(), photos };
}

// ---------- Field rules (live in the form, enforced again by the server) ----------

/** 5–10 letters (A–Z), single spaces between words allowed. */
export const CUSTOM_NAME_RE = /^[A-Za-z]+(?: [A-Za-z]+)*$/;

export function customNameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Please enter your name";
  if (!CUSTOM_NAME_RE.test(v)) return /\s{2,}/.test(v) ? "Use a single space between words" : "Use letters only (A–Z)";
  const letters = v.replace(/ /g, "").length;
  if (letters < 5) return "Name must have at least 5 letters";
  if (letters > 10) return "Name can have at most 10 letters";
  return null;
}

const oneOf = (options: readonly string[], message: string) => (v: string) => (options.includes(v) ? null : message);

export const CUSTOM_VALIDATORS: Record<string, (value: string) => string | null> = {
  name: customNameError,
  email: emailError,
  phone: phoneError,
  pieceType: oneOf(PIECE_TYPES, "Choose what you'd like us to make"),
  finish: oneOf(FINISHES, "Choose a finish"),
  budget: oneOf(BUDGETS, "Choose a budget"),
  neededBy: (v) => (v.trim().length > 60 ? "Keep this under 60 characters" : null),
  details: (v) => {
    const t = v.trim();
    if (t.length < 10) return "Tell us a little about your design (at least a sentence)";
    if (t.length > 3000) return "Please keep the description under 3,000 characters";
    return null;
  },
};
