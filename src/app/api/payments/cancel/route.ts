import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelOrderAndRestock } from "@/lib/orders";
import { siteUrl } from "@/lib/site";
import { isGateway } from "@/lib/order-status";

// The gateway sends the shopper here when they abandon/cancel payment.
// Releases the reserved stock of that still-unpaid online order so a retry
// doesn't leave a duplicate pending order behind. Only recent, unpaid,
// online orders can be cancelled this way (order numbers are unguessable).
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const orderNumber = new URL(request.url).searchParams.get("order")?.trim() ?? "";
  if (orderNumber) {
    try {
      const o = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true, paymentMethod: true, paymentStatus: true, status: true, createdAt: true },
      });
      if (
        o &&
        isGateway(o.paymentMethod) && // never COD or a manual Easypaisa/JazzCash order
        o.paymentStatus === "PENDING" &&
        o.status === "PENDING" &&
        Date.now() - o.createdAt.getTime() < MAX_AGE_MS
      ) {
        await prisma.order.updateMany({
          where: { id: o.id, paymentStatus: "PENDING" },
          data: { paymentStatus: "FAILED" },
        });
        await cancelOrderAndRestock(o.id, { from: o.status, reason: "Payment cancelled by customer", actor: "customer" });
      }
    } catch (err) {
      console.error("[payment] cancel handling failed:", err);
    }
  }
  return NextResponse.redirect(`${siteUrl}/checkout?payment=cancelled`, { status: 303 });
}
