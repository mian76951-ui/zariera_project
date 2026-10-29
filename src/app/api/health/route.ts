import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dbErrorKind } from "@/lib/db-errors";
import { vercelBlobConfigured } from "@/lib/uploads";

// Deployment self-check: open /api/health on the live site to see what's
// missing. Never returns secrets — only yes/no flags, the DB *host name* and
// short hints.
export const dynamic = "force-dynamic";

const REQUIRED_TABLES = ["Category", "Product", "Order", "OrderItem", "User", "Customer", "Setting"];

function dbUrlInfo() {
  const raw = process.env.DATABASE_URL || "";
  try {
    const u = new URL(raw);
    return {
      set: true,
      host: u.hostname,
      isLocalhost: ["localhost", "127.0.0.1", "::1"].includes(u.hostname),
      pooled: u.hostname.includes("-pooler"),
      pgbouncerParam: u.searchParams.get("pgbouncer") === "true",
      sslmode: u.searchParams.get("sslmode") || null,
      channelBinding: u.searchParams.has("channel_binding"),
    };
  } catch {
    return { set: Boolean(raw), host: null, isLocalhost: false, pooled: false, pgbouncerParam: false, sslmode: null, channelBinding: false };
  }
}

const HINTS: Record<string, string> = {
  unavailable: "Can't connect — check DATABASE_URL (Neon pooled URL, ?sslmode=require&pgbouncer=true&connection_limit=1).",
  "not-migrated": "Connected, but tables are missing — run `npx prisma migrate deploy` against this database.",
  "in-use": "A row is still referenced by another (foreign key).",
  engine: "Prisma engine missing — redeploy without build cache (binaryTargets includes rhel-openssl-3.0.x).",
  unknown: "Unexpected database error — see the function logs for [health].",
};

export async function GET() {
  const url = dbUrlInfo();
  const managedHost = Boolean(process.env.VERCEL || process.env.NETLIFY);
  const warnings: string[] = [];
  if (!url.set) warnings.push("DATABASE_URL is not set.");
  if (managedHost && url.isLocalhost) warnings.push("DATABASE_URL points to localhost — the live site can't reach your PC. Use the Neon URL.");
  if (url.pooled && !url.pgbouncerParam) warnings.push("Pooled Neon URL without pgbouncer=true — add &pgbouncer=true&connection_limit=1.");
  if (url.channelBinding) warnings.push("Remove channel_binding=require from DATABASE_URL (not supported by Prisma).");
  if (!process.env.DIRECT_URL) warnings.push("DIRECT_URL is not set (needed for migrations).");

  const secret = process.env.AUTH_SECRET || "";
  if (secret.length < 16) warnings.push("AUTH_SECRET is missing or shorter than 16 characters — logins will fail.");
  if (!process.env.NEXT_PUBLIC_SITE_URL) warnings.push("NEXT_PUBLIC_SITE_URL is not set.");

  let database: { ok: boolean; kind?: string; code?: string; hint?: string } = { ok: false };
  let tables: { ok: boolean; missing: string[] } = { ok: false, missing: REQUIRED_TABLES };
  let counts: Record<string, number> | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true };
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
    const have = new Set(rows.map((r) => r.table_name));
    const missing = REQUIRED_TABLES.filter((t) => !have.has(t));
    tables = { ok: missing.length === 0, missing };
    if (missing.length === 0) {
      const [products, categories, admins, orders] = await Promise.all([
        prisma.product.count(),
        prisma.category.count(),
        prisma.user.count(),
        prisma.order.count(),
      ]);
      counts = { products, categories, admins, orders };
      if (products === 0) warnings.push("No products in this database — run `npm run db:copy` (or seed) into it.");
      if (admins === 0) warnings.push("No admin user — run `npm run db:create-admin` against this database.");
    } else {
      warnings.push(HINTS["not-migrated"]);
    }
  } catch (err) {
    const kind = dbErrorKind(err);
    const code = (err as { code?: string; errorCode?: string })?.code || (err as { errorCode?: string })?.errorCode;
    console.error("[health] database check failed:", err);
    database = { ok: false, kind, code, hint: HINTS[kind] };
    warnings.push(HINTS[kind]);
  }

  const uploads = vercelBlobConfigured()
    ? process.env.BLOB_STORE_ID
      ? "vercel-blob (oidc)"
      : "vercel-blob (token)"
    : process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT
      ? "netlify-blobs"
      : process.env.VERCEL
        ? "NOT CONFIGURED (create a Vercel Blob store)"
        : "disk";
  if (uploads.startsWith("NOT")) warnings.push("Admin image uploads need a Vercel Blob store (Storage → Create → Blob, connect to this project).");
  if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS))
    warnings.push("SMTP is not set — new customers can't get their sign-up verification code (and order / reset emails aren't sent). Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.");

  const ok = database.ok && tables.ok && secret.length >= 16 && !(managedHost && url.isLocalhost);
  return NextResponse.json(
    {
      ok,
      host: process.env.VERCEL ? "vercel" : process.env.NETLIFY ? "netlify" : "node",
      checks: {
        databaseUrl: url,
        directUrlSet: Boolean(process.env.DIRECT_URL),
        authSecretSet: secret.length >= 16,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
        database,
        tables,
        counts,
        uploads,
      },
      warnings,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
