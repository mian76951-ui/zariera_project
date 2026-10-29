import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getAdminOrder } from "@/lib/admin-data";
import { getStoreSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/format";
import { courierLabel } from "@/lib/couriers";
import { PrintButton } from "@/components/admin/print-button";
import { PAYMENT_METHOD_LABEL } from "@/lib/order-status";

export const metadata = { title: "Invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

// Printable invoice + packing slip. Lives outside the dashboard layout so it
// prints on a clean A4 page (sidebar/header not included).
export default async function InvoicePage({ params }: PageProps<"/admin/invoice/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [order, settings] = await Promise.all([getAdminOrder(id), getStoreSettings()]);
  if (!order) notFound();

  const date = new Date(order.createdAt).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const codDue = order.paymentMethod === "COD" && order.paymentStatus !== "PAID" ? order.total : 0;
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const c = settings.contact;

  return (
    <div className="min-h-screen bg-[#f3efe8] py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[800px] items-center justify-between px-4 print:hidden">
        <Link href={`/admin/orders/${order.id}`} className="text-sm text-[#6b5a52] hover:underline">
          ← Back to order
        </Link>
        <PrintButton label="Print invoice" />
      </div>

      <article className="mx-auto max-w-[800px] bg-white p-10 text-[13px] leading-relaxed text-[#2b1c18] shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <header className="flex items-start justify-between border-b-2 border-[#5b1a2b] pb-5">
          <div>
            <p className="font-serif text-3xl font-bold tracking-[0.25em] text-[#5b1a2b]">ZARIERA</p>
            <p className="mt-1 text-xs italic text-[#8a6f63]">Every Jewel Tells a Story</p>
            <p className="mt-3 text-xs text-[#6b5a52]">{[c.city, c.phone, c.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold uppercase tracking-[0.15em]">Invoice</p>
            <p className="mt-1 font-medium">{order.orderNumber}</p>
            <p className="text-xs text-[#6b5a52]">{date}</p>
          </div>
        </header>

        {/* Parties */}
        <section className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a6f63]">Bill / ship to</p>
            <p className="mt-1.5 font-medium">{order.customerName}</p>
            <p>{order.address}</p>
            <p>
              {order.city}
              {order.postalCode ? ` ${order.postalCode}` : ""}
            </p>
            <p>{order.phone}</p>
            <p className="text-[#6b5a52]">{order.email}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a6f63]">Payment</p>
            <p className="mt-1.5 font-medium">{PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</p>
            <p>Status: {order.paymentStatus.charAt(0) + order.paymentStatus.slice(1).toLowerCase()}</p>
            {order.courier && order.trackingNumber && (
              <p className="mt-2">
                {courierLabel(order.courier)} · <span className="font-medium">{order.trackingNumber}</span>
              </p>
            )}
          </div>
        </section>

        {/* Items */}
        <table className="mt-7 w-full border-collapse">
          <thead>
            <tr className="border-b border-[#d9cbbb] text-left text-[11px] uppercase tracking-[0.12em] text-[#8a6f63]">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-center font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Price</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-b border-[#eee4d8]">
                <td className="py-2.5">{i.name}</td>
                <td className="py-2.5 text-center">{i.quantity}</td>
                <td className="py-2.5 text-right">{formatPrice(i.price)}</td>
                <td className="py-2.5 text-right">{formatPrice(i.price * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <section className="ml-auto mt-4 w-64 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[#6b5a52]">Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b5a52]">Shipping</span>
            <span>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</span>
          </div>
          <div className="flex justify-between border-t border-[#2b1c18] pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          {codDue > 0 && (
            <div className="mt-2 rounded border-2 border-[#5b1a2b] px-3 py-2 text-center font-semibold text-[#5b1a2b]">
              Cash to collect: {formatPrice(codDue)}
            </div>
          )}
        </section>

        {order.notes && (
          <p className="mt-6 rounded bg-[#faf6f0] px-3 py-2 text-xs">
            <span className="font-semibold">Customer note:</span> {order.notes}
          </p>
        )}

        <p className="mt-8 text-center text-xs text-[#8a6f63]">
          Thank you for shopping with ZARIERA ✦ Exchanges within 7 days on unused items in original packaging.
        </p>

        {/* Packing slip — cut off and put in / on the parcel */}
        <section className="mt-10 border-t-2 border-dashed border-[#b9a796] pt-6 print:break-inside-avoid">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a6f63]">✂ Packing slip</p>
          <div className="mt-3 grid grid-cols-2 gap-8">
            <div>
              <p className="text-lg font-semibold">{order.customerName}</p>
              <p>{order.address}</p>
              <p>
                {order.city}
                {order.postalCode ? ` ${order.postalCode}` : ""}
              </p>
              <p className="font-medium">{order.phone}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{order.orderNumber}</p>
              <p>
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-base font-semibold">
                {codDue > 0 ? `COD: ${formatPrice(codDue)}` : "PAID — collect nothing"}
              </p>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
