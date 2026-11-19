import { randomInt } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { shippingFor } from "./settings-shared";
import { getStoreSettings } from "./settings";
import { after } from "next/server";
import { sendOrderEmails } from "./email";
import { refreshCatalog } from "./cache-tags";
import { isWallet, needsPaymentBeforeShipping, normalizeTid, tidError } from "./order-status";


export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Please enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(30),
  address: z.string().trim().min(5, "Enter your delivery address").max(500),
  city: z.string().trim().min(2, "Enter your city").max(100),
  postalCode: z.string().max(20).nullish(),
  notes: z.string().max(1000).nullish(),
  paymentMethod: z.enum(["COD", "PAYFAST", "SAFEPAY", "EASYPAISA", "JAZZCASH"]),
  // Easypaisa / JazzCash Transaction ID (required for those methods only)
  paymentTid: z.preprocess((v) => (v == null || v === "" ? undefined : normalizeTid(v)), z.string().optional()),
  items: z
    .array(
      z.object({
        productId: z.string().max(100),
        name: z.string().max(200),
        price: z.number().nonnegative(),
        quantity: z.number().int().positive().max(99),
      })
    )
    .min(1, "Your cart is empty")
    .max(50),
}).superRefine((d, ctx) => {
  const problem = isWallet(d.paymentMethod) ? tidError(d.paymentTid, d.paymentMethod) : null;
  if (problem) ctx.addIssue({ code: "custom", path: ["paymentTid"], message: problem });
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type CreateOrderResult =
  | { ok: true; orderNumber: string; total: number }
  | { ok: false; error: string };

// User-facing validation problems (bad cart) vs unexpected server errors.
class OrderValidationError extends Error {}

// Unambiguous alphabet (no 0/O, 1/I/L). 8 crypto-random chars ≈ 40 bits, so
// order numbers can't be guessed (they also act as a lookup key with the email).
const ORDER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  let rand = "";
  for (let i = 0; i < 8; i++) rand += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)];
  return `ZR-${stamp}-${rand}`;
}

type Tx = Prisma.TransactionClient;

export type OrderEventType = "PLACED" | "STATUS" | "PAYMENT" | "CANCELLED" | "REOPENED" | "SHIPMENT_BOOKED";

/** Adds a line to an order's timeline (inside the caller's transaction). */
export function logOrderEvent(
  tx: Tx | typeof prisma,
  orderId: string,
  e: { type: OrderEventType; actor: string; from?: string | null; to?: string | null; note?: string | null }
) {
  return tx.orderEvent.create({
    data: { orderId, type: e.type, actor: e.actor, from: e.from ?? null, to: e.to ?? null, note: e.note ?? null },
  });
}

// Cancels an order exactly once and puts its items back into stock.
// Safe to call repeatedly — only the call that flips the status restocks.
// A delivered order can't be cancelled.
export async function cancelOrderAndRestock(
  orderId: string,
  opts: { from?: string; reason?: string; actor?: string } = {}
): Promise<boolean> {
  const restocked = await prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: { notIn: ["CANCELLED", "DELIVERED"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: opts.reason ?? null },
    });
    if (res.count !== 1) return false;
    await logOrderEvent(tx, orderId, {
      type: "CANCELLED",
      actor: opts.actor ?? "system",
      from: opts.from,
      to: "CANCELLED",
      note: opts.reason,
    });
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true },
    });
    for (const i of items) {
      await tx.product.update({
        where: { id: i.productId },
        data: { stock: { increment: i.quantity } },
      });
    }
    return true;
  });
  if (restocked) refreshCatalog();
  return restocked;
}

export class ReopenError extends Error {}

// Brings a cancelled order back to PENDING and takes its items out of stock
// again — all or nothing: if any piece is short, nothing changes.
export async function reopenOrder(orderId: string, actor: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentMethod: true, paymentStatus: true },
    });
    if (!order) throw new ReopenError("Order not found.");
    if (order.status !== "CANCELLED") throw new ReopenError("Only a cancelled order can be reopened.");
    if (needsPaymentBeforeShipping(order.paymentMethod) && (order.paymentStatus === "FAILED" || order.paymentStatus === "REFUNDED")) {
      throw new ReopenError(
        `This order's payment is ${order.paymentStatus.toLowerCase()}, so it can't be reopened. The customer needs to place a new order.`
      );
    }
    const res = await tx.order.updateMany({
      where: { id: orderId, status: "CANCELLED" },
      data: { status: "PENDING", cancelledAt: null, cancelReason: null },
    });
    if (res.count !== 1) throw new ReopenError("The order changed meanwhile. Reload and try again.");
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true, name: true },
    });
    for (const i of items) {
      const took = await tx.product.updateMany({
        where: { id: i.productId, stock: { gte: i.quantity } },
        data: { stock: { decrement: i.quantity } },
      });
      if (took.count !== 1) {
        const p = await tx.product.findUnique({ where: { id: i.productId }, select: { stock: true } });
        throw new ReopenError(`Not enough stock for "${i.name}" (need ${i.quantity}, have ${p?.stock ?? 0}).`);
      }
    }
    await logOrderEvent(tx, orderId, { type: "REOPENED", actor, from: "CANCELLED", to: "PENDING" });
  });
  refreshCatalog();
}

export async function createOrder(
  input: CheckoutInput,
  customerId?: string | null
): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const data = parsed.data;

  try {
    // Re-price against the database to prevent client-side tampering,
    // validate stock, then create the order and decrement stock atomically.
    const ids = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, active: true },
      select: { id: true, name: true, price: true, stock: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Merge duplicate lines for the same product so stock checks are per product.
    const qtyById = new Map<string, number>();
    for (const i of data.items) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.quantity);

    const lineItems = [...qtyById].map(([productId, quantity]) => {
      const p = byId.get(productId);
      const name = data.items.find((i) => i.productId === productId)?.name ?? "An item";
      if (!p)
        throw new OrderValidationError(
          `"${name}" is no longer available. Please remove it from your cart and try again.`
        );
      if (p.stock < quantity)
        throw new OrderValidationError(
          p.stock <= 0
            ? `"${p.name}" is sold out. Please remove it from your cart.`
            : `Only ${p.stock} left of "${p.name}". Please lower the quantity.`
        );
      return { productId: p.id, name: p.name, price: Number(p.price), quantity };
    });

    const subtotal = lineItems.reduce((s, i) => s + i.price * i.quantity, 0);
    // Shipping rules come from Admin → Settings (same values the checkout shows).
    const shipping = shippingFor(subtotal, (await getStoreSettings()).shipping);
    const total = subtotal + shipping;
    const email = data.email.trim().toLowerCase();

    // Only attach a customerId that actually exists — a stale session cookie
    // pointing at a deleted account would otherwise cause a foreign-key error.
    let safeCustomerId: string | null = null;
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      safeCustomerId = customer?.id ?? null;
    }

    // Decrement stock *conditionally* inside the transaction so two concurrent
    // checkouts can never oversell: the update only matches while enough stock
    // remains, otherwise the whole order rolls back.
    let orderNumber = "";
    let createdOrder: { id: string; createdAt: Date } | null = null;
    for (let attempt = 0; attempt < 3 && !createdOrder; attempt++) {
      orderNumber = generateOrderNumber();
      try {
        createdOrder = await prisma.$transaction(async (tx) => {
          for (const i of lineItems) {
            const res = await tx.product.updateMany({
              where: { id: i.productId, active: true, stock: { gte: i.quantity } },
              data: { stock: { decrement: i.quantity } },
            });
            if (res.count !== 1)
              throw new OrderValidationError(
                `"${i.name}" just sold out or has fewer pieces left. Please update your cart.`
              );
          }
          const created = await tx.order.create({
            data: {
              orderNumber,
              customerName: data.customerName.trim(),
              email,
              phone: data.phone.trim(),
              address: data.address.trim(),
              city: data.city.trim(),
              postalCode: data.postalCode?.trim() || null,
              notes: data.notes?.trim() || null,
              paymentMethod: data.paymentMethod,
              paymentTid: isWallet(data.paymentMethod) ? data.paymentTid : null,
              customerId: safeCustomerId,
              subtotal,
              shipping,
              total,
              items: { create: lineItems },
              events: { create: { type: "PLACED", actor: "customer", to: "PENDING" } },
            },
            select: { id: true, createdAt: true },
          });
          return created;
        });
      } catch (err) {
        // Retry only on an (astronomically unlikely) order-number collision.
        const msg = err instanceof Error ? err.message : "";
        if (!(err instanceof OrderValidationError) && /P2002|Unique constraint/i.test(msg) && /orderNumber/.test(msg)) continue;
        throw err;
      }
    }
    if (!createdOrder) throw new Error("Could not allocate an order number");
    refreshCatalog(); // stock changed

    // (Admins see new orders via the dashboard bell, which polls /api/admin/orders/latest.)

    // Order is safely saved. Email is best-effort — never fail a saved order
    // just because SMTP is unavailable — and it goes out after the reply, so
    // the shopper reaches the confirmation page without waiting on SMTP.
    after(async () => {
      try {
        await sendOrderEmails({
          orderNumber,
          customerName: data.customerName,
          email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          paymentMethod: data.paymentMethod,
          paymentTid: isWallet(data.paymentMethod) ? data.paymentTid : undefined,
          items: lineItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
          subtotal,
          shipping,
          total,
        });
      } catch (emailErr) {
        console.error("[order] email send failed (order still saved):", emailErr);
      }
    });

    return { ok: true, orderNumber, total };
  } catch (err) {
    // Cart/stock problems are safe to show to the customer verbatim.
    if (err instanceof OrderValidationError) {
      return { ok: false, error: err.message };
    }
    // Anything else is an unexpected server/database error. Log the real
    // cause for us, show the customer a clear (non-fake) failure — never a
    // fake success that silently loses the order.
    console.error("[order] failed to create order:", err);
    return {
      ok: false,
      error: "Sorry, we couldn't place your order right now. Please try again in a moment.",
    };
  }
}
