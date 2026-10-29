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
