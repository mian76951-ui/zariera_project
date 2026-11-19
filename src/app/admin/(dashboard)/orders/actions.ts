"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { bookShipment, isCourier } from "@/lib/couriers";
import { cancelOrderAndRestock, reopenOrder, ReopenError } from "@/lib/orders";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  canMoveOrder,
  canMovePayment,
  shippingBlockedReason,
  statusLabel,
  isWallet,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";

const STALE = { error: "The order changed meanwhile. Reload and try again." };

function refresh(id: string) {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
}

export type ShipState = { error?: string; ok?: boolean; simulated?: boolean };

export async function bookShipmentAction(
  id: string,
  _prev: ShipState,
  formData: FormData
): Promise<ShipState> {
  const admin = await requireAdmin();
  const courier = String(formData.get("courier") || "");
  if (!isCourier(courier)) return { error: "Please choose a courier." };

  let order;
  try {
    order = await prisma.order.findUnique({
      where: { id },
      include: { items: { select: { quantity: true } } },
    });
  } catch {
    return { error: "Database unavailable. Please try again." };
  }
  if (!order) return { error: "Order not found." };
  if (order.trackingNumber) return { error: "This order is already booked with a courier." };
  if (order.status === "CANCELLED" || order.status === "DELIVERED") {
    return { error: `A ${order.status.toLowerCase()} order can't be shipped.` };
  }
  const blocked = shippingBlockedReason(order);
  if (blocked) return { error: blocked };

  // Claim the order first (atomic) so a double-click or a second admin can't
  // book the same parcel twice. Released again if the booking fails.
  const claim = await prisma.order.updateMany({
    where: { id, trackingNumber: null, courier: null },
    data: { courier },
  });
  if (claim.count !== 1) return { error: "This order is already being booked." };

  const release = () =>
    prisma.order
      .updateMany({ where: { id, trackingNumber: null }, data: { courier: null } })
      .catch(() => undefined);

  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const result = await bookShipment(
    {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      email: order.email,
      phone: order.phone,
      address: order.address,
      city: order.city,
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      itemCount,
    },
    courier
  );

  if (!result.ok) {
    await release();
    return { error: result.error };
  }

  try {
    await prisma.order.update({
      where: { id },
      data: {
        courier,
        trackingNumber: result.trackingNumber,
        shippedAt: new Date(),
        status: "SHIPPED",
        events: {
          create: {
            type: "SHIPMENT_BOOKED",
            actor: admin.email,
            from: order.status,
            to: "SHIPPED",
            note: `${courier.toUpperCase()} · tracking ${result.trackingNumber}`,
          },
        },
      },
    });
  } catch {
    console.error(`[courier] booked ${courier} ${result.trackingNumber} for ${order.orderNumber} but could not save it`);
    return { error: `Booked (tracking ${result.trackingNumber}) but could not save. Note this number and retry.` };
  }

  refresh(id);
  return { ok: true, simulated: result.simulated };
}

export type StatusState = { ok?: boolean; error?: string };

/** Moves an order forward one (or more) steps. Cancel and Reopen have their own actions. */
export async function updateOrderStatus(
  id: string,
  _prev: StatusState,
  formData: FormData
): Promise<StatusState> {
  const admin = await requireAdmin();
  const status = String(formData.get("status")) as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return { error: "Invalid status." };
  if (status === "CANCELLED") return { error: "Use “Cancel order” to cancel." };
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { status: true, paymentMethod: true, paymentStatus: true, shippedAt: true },
    });
    if (!order) return { error: "Order not found." };
    if (order.status === status) return { ok: true };
    if (order.status === "CANCELLED") return { error: "This order is cancelled. Use “Reopen order” first." };
    if (!canMoveOrder(order.status, status)) {
      return { error: `A ${statusLabel(order.status).toLowerCase()} order can't go back to ${statusLabel(status).toLowerCase()}.` };
    }
    const shipping = status === "SHIPPED" || status === "DELIVERED";
    const blocked = shipping ? shippingBlockedReason(order) : null;
    if (blocked) return { error: blocked };
    const codCollected = status === "DELIVERED" && order.paymentMethod === "COD" && order.paymentStatus !== "PAID";

    const done = await prisma.$transaction(async (tx) => {
      // Conditional on the status we validated against (no lost updates).
      const res = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status,
          ...(shipping && !order.shippedAt ? { shippedAt: new Date() } : {}),
          ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
          ...(codCollected ? { paymentStatus: "PAID" as const } : {}),
        },
      });
      if (res.count !== 1) return false;
      await tx.orderEvent.createMany({
        data: [
          { orderId: id, type: "STATUS", actor: admin.email, from: order.status, to: status },
          ...(codCollected
            ? [{ orderId: id, type: "PAYMENT", actor: admin.email, from: order.paymentStatus, to: "PAID", note: "Cash collected on delivery" }]
            : []),
        ],
      });
      return true;
    });
    if (!done) return STALE;
    refresh(id);
    return { ok: true };
  } catch {
    return { error: "Could not update. Database unavailable." };
  }
}

/** Cancels an order with a reason and puts its items back in stock. */
export async function cancelOrderAction(id: string, _prev: StatusState, formData: FormData): Promise<StatusState> {
  const admin = await requireAdmin();
  const preset = String(formData.get("reason") ?? "").trim();
  const other = String(formData.get("otherReason") ?? "").trim();
  const reason = (preset === "Other" ? other : preset).slice(0, 200);
  if (!reason) return { error: "Please choose or type a reason for cancelling." };
  try {
    const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!order) return { error: "Order not found." };
    if (order.status === "CANCELLED") return { ok: true };
    if (order.status === "DELIVERED") return { error: "A delivered order can't be cancelled." };
    const done = await cancelOrderAndRestock(id, { from: order.status, reason, actor: admin.email });
    if (!done) return STALE;
    refresh(id);
    return { ok: true };
  } catch {
    return { error: "Could not cancel. Database unavailable." };
  }
}

/** Brings a cancelled order back to Pending (takes the stock out again). */
export async function reopenOrderAction(id: string): Promise<StatusState> {
  const admin = await requireAdmin();
  try {
    await reopenOrder(id, admin.email);
    refresh(id);
    return { ok: true };
  } catch (err) {
    if (err instanceof ReopenError) return { error: err.message };
    return { error: "Could not reopen. Database unavailable." };
  }
}

export async function updatePaymentStatus(
  id: string,
  _prev: StatusState,
  formData: FormData
): Promise<StatusState> {
  const admin = await requireAdmin();
  const paymentStatus = String(formData.get("paymentStatus")) as PaymentStatus;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) return { error: "Invalid payment status." };
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { paymentStatus: true, paymentMethod: true, status: true },
    });
    if (!order) return { error: "Order not found." };
    if (order.paymentStatus === paymentStatus) return { ok: true };
    if (!canMovePayment(order.paymentStatus, paymentStatus)) {
      return {
        error: `Can't change payment from ${order.paymentStatus.toLowerCase()} to ${paymentStatus.toLowerCase()}.`,
      };
    }
    // A verified Easypaisa / JazzCash payment also confirms a pending order.
    const tidVerified = paymentStatus === "PAID" && isWallet(order.paymentMethod);
    const confirm = tidVerified && order.status === "PENDING";
    const done = await prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id, paymentStatus: order.paymentStatus, ...(confirm ? { status: "PENDING" as const } : {}) },
        data: { paymentStatus, ...(confirm ? { status: "CONFIRMED" as const } : {}) },
      });
      if (res.count !== 1) return false;
      await tx.orderEvent.createMany({
        data: [
          {
            orderId: id,
            type: "PAYMENT",
            actor: admin.email,
            from: order.paymentStatus,
            to: paymentStatus,
            note: tidVerified ? "TID verified" : null,
          },
          ...(confirm ? [{ orderId: id, type: "STATUS", actor: admin.email, from: "PENDING", to: "CONFIRMED" }] : []),
        ],
      });
      return true;
    });
    if (!done) return STALE;
    refresh(id);
    return { ok: true };
  } catch {
    return { error: "Could not update. Database unavailable." };
  }
}
