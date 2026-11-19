import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminOrder } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ShipmentPanel } from "@/components/admin/shipment-panel";
import { OrderFlowPanel } from "@/components/admin/order-flow-panel";
import { PaymentPanel } from "@/components/admin/payment-panel";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { shippingBlockedReason, type OrderStatus } from "@/lib/order-status";
import { courierLabel, trackingUrl } from "@/lib/couriers";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Order details" };

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  await requireAdmin(); // layouts don't re-run on client navigation
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  // When each step was reached: the order's own columns, plus the timeline for
  // Confirmed / Packed (events are newest first, so the last match is the first time).
  const stamps: Partial<Record<OrderStatus, string | null>> = {
    PENDING: order.createdAt,
    SHIPPED: order.shippedAt,
    DELIVERED: order.deliveredAt,
    CANCELLED: order.cancelledAt,
  };
  for (const e of order.events) {
    if (e.type === "STATUS" && (e.to === "CONFIRMED" || e.to === "PROCESSING")) stamps[e.to] = e.createdAt;
  }
  const blockedReason = shippingBlockedReason(order);

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">
        ← Back to orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold text-ink">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        <Link
          href={`/admin/invoice/${order.id}`}
          className="ml-auto rounded-lg border border-[var(--line-strong)] px-4 py-2 text-sm font-medium text-ink transition hover:border-gold hover:text-gold-deep"
        >
          Print invoice / packing slip
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Placed {new Date(order.createdAt).toLocaleString("en-PK")}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Items + totals */}
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3 text-ink">{i.name}</td>
                    <td className="px-4 py-3 text-muted">{formatPrice(i.price)}</td>
                    <td className="px-4 py-3 text-muted">{i.quantity}</td>
                    <td className="px-4 py-3 text-right text-ink">
                      {formatPrice(i.price * i.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1.5 border-t border-[var(--line)] px-4 py-4 text-sm">
              <Line label="Subtotal" value={formatPrice(order.subtotal)} />
              <Line label="Shipping" value={order.shipping === 0 ? "Free" : formatPrice(order.shipping)} />
              <div className="flex justify-between border-t border-[var(--line)] pt-2 font-medium text-ink">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="rounded-xl border border-[var(--line)] bg-surface p-5 text-sm">
            <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Customer</h2>
            <dl className="space-y-1.5">
              <Info label="Name" value={order.customerName} />
              <Info label="Email" value={order.email} />
              <Info label="Phone" value={order.phone} />
              <Info label="Address" value={`${order.address}, ${order.city}${order.postalCode ? ` ${order.postalCode}` : ""}`} />
              {order.notes && <Info label="Notes" value={order.notes} />}
            </dl>
          </div>

          <OrderTimeline events={order.events} placedAt={order.createdAt} />
        </div>

        {/* Status controls */}
        <aside className="space-y-5">

          <OrderFlowPanel
            key={order.status}
            id={order.id}
            status={order.status}
            stamps={stamps}
            cancelReason={order.cancelReason}
            blockedReason={blockedReason}
          />

          <PaymentPanel
            id={order.id}
            method={order.paymentMethod}
            paymentStatus={order.paymentStatus}
            status={order.status}
            total={order.total}
            tid={order.paymentTid}
          />
          {order.status !== "CANCELLED" && (order.trackingNumber || order.status !== "DELIVERED") && (
            <ShipmentPanel
              id={order.id}
              booked={!!order.trackingNumber}
              courierName={order.courier ? courierLabel(order.courier) : undefined}
              trackingNumber={order.trackingNumber}
              trackUrl={order.courier && order.trackingNumber ? trackingUrl(order.courier, order.trackingNumber) : undefined}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
