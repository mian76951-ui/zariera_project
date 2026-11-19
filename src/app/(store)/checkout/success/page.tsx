import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ClearCart } from "@/components/cart/clear-cart";
import { PAYMENT_METHOD_LABEL, isGateway, isWallet } from "@/lib/order-status";

export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type OrderSummary = {
  orderNumber: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentTid: string | null;
  status: string;
  productIds: string[];
};

async function findOrder(orderNumber: string): Promise<OrderSummary | null> {
  try {
    const o = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        orderNumber: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        paymentTid: true,
        status: true,
        items: { select: { productId: true } },
      },
    });
    return o
      ? { ...o, total: Number(o.total), productIds: o.items.map((i) => i.productId) }
      : null;
  } catch {
    return null;
  }
}

export default async function SuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const sp = await searchParams;
  const orderNumber = ((Array.isArray(sp.order) ? sp.order[0] : sp.order) ?? "").trim();

  // Everything shown here comes from the database, never from the URL.
  const order = orderNumber ? await findOrder(orderNumber) : null;
  if (!order) redirect("/cart");

  const online = isGateway(order.paymentMethod);
  const wallet = isWallet(order.paymentMethod);
  const walletName = PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod;
  if (online && (order.paymentStatus === "FAILED" || order.status === "CANCELLED")) {
    redirect("/checkout?payment=failed");
  }
  const awaitingPayment = online && order.paymentStatus !== "PAID";
  const walletPending = wallet && order.paymentStatus !== "PAID";

  return (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center">
      <ClearCart productIds={order.productIds} />
      {walletPending ? (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-200">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
      ) : (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-gold-hi to-gold">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#260810" strokeWidth="2.6">
            <path d="M5 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <h1 className="mt-8 font-serif text-4xl font-semibold text-ink">
        {walletPending ? "Payment verification pending" : "Thank you!"}
      </h1>
      <p className="mt-3 text-muted">
        {walletPending
          ? `Your order is on hold. It is not confirmed yet: we'll check Transaction ID ${order.paymentTid ?? ""} in our ${walletName} account and confirm your order by email once the payment is found. If the payment isn't found, the order will be cancelled.`
          : awaitingPayment
          ? "Your order has been received. We're confirming your payment with the provider — you'll get an email as soon as it's confirmed."
          : "Your order has been placed. A confirmation will be sent to your email."}
      </p>

      <div className="mx-auto mt-8 max-w-sm rounded-xl border border-[var(--line)] bg-surface/70 p-6 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Order number</span>
          <span className="font-medium text-ink">{order.orderNumber}</span>
        </div>
        <div className="mt-3 flex justify-between">
          <span className="text-muted">Total</span>
          <span className="font-medium text-ink">{formatPrice(order.total)}</span>
        </div>
        <div className="mt-3 flex justify-between">
          <span className="text-muted">Payment</span>
          <span className="font-medium text-ink">
            {online
              ? order.paymentStatus === "PAID"
                ? "Paid online"
                : "Confirming…"
              : wallet
                ? order.paymentStatus === "PAID"
                  ? `Paid · ${walletName}`
                  : `${walletName} · On hold`
                : "Cash on Delivery"}
          </span>
        </div>
        {wallet && order.paymentTid && (
          <div className="mt-3 flex justify-between">
            <span className="text-muted">Transaction ID</span>
            <span className="font-mono font-medium tracking-wider text-ink">{order.paymentTid}</span>
          </div>
        )}
      </div>

      <div className="mx-auto mt-6 max-w-sm rounded-xl border border-gold/40 bg-gold/5 p-5 text-sm">
        <p className="font-medium text-ink">Saved to your account</p>
        <p className="mt-1 text-muted">Track this order and see all your past ones any time.</p>
        <Link
          href="/account/orders"
          className="mt-3 inline-block rounded-full border border-[var(--line-strong)] px-6 py-2 text-xs font-medium uppercase tracking-[0.12em] text-ink transition hover:border-gold hover:text-gold-deep"
        >
          View my orders
        </Link>
      </div>

      <p className="mx-auto mt-6 max-w-md text-sm text-muted">
        {online || wallet
          ? "Keep your order number handy — you can track it anytime from the Order Status page."
          : "For Cash on Delivery, please keep the amount ready at delivery. Our team will call to confirm your order."}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="inline-block rounded-full bg-gradient-to-r from-gold-hi to-gold px-8 py-3 text-sm font-medium text-maroon transition hover:opacity-90"
        >
          Continue Shopping
        </Link>
        <Link
          href="/account/orders"
          className="inline-block rounded-full border border-[var(--line-strong)] px-8 py-3 text-sm font-medium text-ink transition hover:border-gold hover:text-gold-deep"
        >
          Track Order
        </Link>
      </div>
    </div>
  );
}
