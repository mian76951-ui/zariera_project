import { revalidatePath, revalidateTag } from "next/cache";

// Cross-request caches for storefront data, and the one call that refreshes each.
// `expire: 0` = the next visitor gets fresh data (never a stale page), which is
// what an admin expects right after saving.

export const CATALOG_TAG = "catalog";
export const SETTINGS_TAG = "store-settings";

function refresh(tag: string) {
  try {
    revalidateTag(tag, { expire: 0 });
  } catch (err) {
    // Outside a request (scripts / seed) there is no cache to refresh.
    if (process.env.NEXT_RUNTIME) console.error(`[cache] could not refresh "${tag}":`, err);
  }
}

/** Products, categories or stock changed. */
export const refreshCatalog = () => refresh(CATALOG_TAG);

/** An admin edit to products / categories: fresh catalog data and fresh cached
 *  pages (every route, incl. ISR product pages) on the next visit. */
export function refreshStorefront() {
  refreshCatalog();
  revalidatePath("/", "layout");
}

/** Admin → Settings saved. */
export const refreshSettings = () => refresh(SETTINGS_TAG);
