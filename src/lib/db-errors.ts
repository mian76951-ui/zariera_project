// Classifies Prisma / database errors so the shopper gets the right message and
// the real cause is always logged (visible in Vercel / Netlify function logs).

export type DbErrorKind = "unavailable" | "duplicate" | "in-use" | "not-migrated" | "engine" | "unknown";

export function dbErrorKind(err: unknown): DbErrorKind {
  const e = err as { code?: string; errorCode?: string; message?: string; name?: string } | null;
  const code = e?.code || e?.errorCode || "";
  const msg = e?.message || "";
  if (code === "P2002" || /Unique constraint/i.test(msg)) return "duplicate";
  // Foreign key: the row is still referenced (e.g. a product in past orders).
  if (code === "P2003" || /Foreign key constraint/i.test(msg)) return "in-use";
  if (
    ["P1000", "P1001", "P1002", "P1003", "P1008", "P1010", "P1011", "P1017"].includes(code) ||
    /Can't reach database|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection|Authentication failed|TLS|timed out/i.test(msg) ||
    e?.name === "PrismaClientInitializationError"
  )
    return "unavailable";
  if (code === "P2021" || code === "P2022" || /does not exist in the current database|relation .* does not exist/i.test(msg))
    return "not-migrated";
  if (/Query Engine|could not locate|libquery_engine|binaryTargets/i.test(msg)) return "engine";
  return "unknown";
}

/** Logs the full error with a tag and returns its kind. */
export function logDbError(tag: string, err: unknown): DbErrorKind {
  const kind = dbErrorKind(err);
  console.error(`[${tag}] database error (${kind}):`, err);
  return kind;
}
