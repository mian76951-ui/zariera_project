import { getVerifiedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Download all orders as CSV (opens in Excel / Google Sheets).
// Optional ?status=PENDING etc. to export one tab only.
export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formulas (CSV injection) and quote every cell.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await getVerifiedAdmin();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const status = new URL(request.url).searchParams.get("status")?.toUpperCase();
  const where = status && STATUSES.includes(status) ? { status: status as never } : {};

  let orders;
  try {
    orders = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, include: { items: true } });
  } catch {
    return new Response("Database unavailable", { status: 503 });
  }

  const header = [
    "Order number", "Date", "Status", "Payment method", "Payment status", "Transaction ID",
    "Customer", "Phone", "Email", "City", "Address", "Postal code",
    "Items", "Item count", "Subtotal (Rs)", "Shipping (Rs)", "Total (Rs)",
    "Courier", "Tracking number", "Notes",
  ];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.createdAt.toISOString().replace("T", " ").slice(0, 16),
    o.status,
    o.paymentMethod,
    o.paymentStatus,
    o.paymentTid ?? "",
    o.customerName,
    o.phone,
    o.email,
    o.city,
    o.address,
    o.postalCode ?? "",
    o.items.map((i) => `${i.name} x${i.quantity}`).join("; "),
    o.items.reduce((n, i) => n + i.quantity, 0),
    Number(o.subtotal),
    Number(o.shipping),
    Number(o.total),
    o.courier ?? "",
    o.trackingNumber ?? "",
    o.notes ?? "",
  ]);

  // BOM so Excel opens UTF-8 (Urdu names, "–" etc.) correctly.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zariera-orders-${status?.toLowerCase() || "all"}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
