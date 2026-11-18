import { prisma } from "./prisma";
import { cancelOrderAndRestock } from "./orders";
import { isGateway } from "./order-status";

// Applies a verified gateway result to an order (by order number).
// Idempotent and state-guarded:
//  - success: only PENDING/FAILED payments become PAID; a PENDING order becomes
//    CONFIRMED. Cancelled/shipped orders keep their status (admin can refund).
//  - failure: only a PENDING payment becomes FAILED, and the unpaid order is
//    cancelled with its stock restored so the shopper can simply retry.
//  - amount (when the gateway reports it) must match the order total.
export async function markOrderPayment(
  orderNumber: string,
  paid: boolean,
  amount?: number | null
): Promise<boolean> {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, total: true, status: true, paymentStatus: true, paymentMethod: true },
    });
    // Only gateway orders are settled by callbacks. COD and Easypaisa/JazzCash
    // (manual TID) orders are confirmed by an admin.
    if (!order || !isGateway(order.paymentMethod)) return false;

    if (paid) {
      if (amount != null && Math.abs(Number(order.total) - amount) > 1) {
        console.error(`[payment] amount mismatch for ${orderNumber}: got ${amount}, expected ${order.total}`);
        return false;
      }
      if (order.paymentStatus === "PAID") return true; // duplicate notification
      const res = await prisma.order.updateMany({
        where: { id: order.id, paymentStatus: { in: ["PENDING", "FAILED"] } },
        data: { paymentStatus: "PAID" },
      });
      await prisma.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "CONFIRMED" },
      });
      return res.count === 1;
    }

    if (order.paymentStatus !== "PENDING") return true; // already resolved
    const res = await prisma.order.updateMany({
      where: { id: order.id, paymentStatus: "PENDING" },
      data: { paymentStatus: "FAILED" },
    });
    if (res.count === 1) await cancelOrderAndRestock(order.id, { reason: "Online payment failed", actor: "system" });
    return true;
  } catch (err) {
    console.error("[payment] could not update order:", err);
    return false;
  }
}
