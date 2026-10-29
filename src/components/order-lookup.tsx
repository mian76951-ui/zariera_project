"use client";

import { useActionState } from "react";
import { lookupOrderAction, type LookupState } from "@/app/(store)/account/orders/actions";
import { StatusBadge } from "@/components/status-badge";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/order-status";

const initial: LookupState = { status: "idle" };

const inputCls =
  "w-full rounded-md border border-[var(--line-strong)] bg-cream-soft px-4 py-3 text-sm outline-none focus:border-gold";

export function OrderLookup({ defaultOrder = "" }: { defaultOrder?: string }) {
  const [state, formAction, pending] = useActionState(lookupOrderAction, initial);

  return (
    <>
      <form action={formAction} className="mx-auto mt-10 max-w-md space-y-4">
        <input
          name="order"
          defaultValue={state.values?.order ?? defaultOrder}
          required
          placeholder="Order number (e.g. ZR-XXXXXX-XXXXXXXX)"
          className={inputCls}
        />
        <input name="email" type="email" required placeholder="Email used at checkout" defaultValue={state.values?.email} className={inputCls} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-maroon px-8 py-3 text-sm font-medium uppercase tracking-[0.12em] text-light transition hover:bg-maroon-2 disabled:opacity-60"
        >
          {pending ? "Looking up…" : "Track Order"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="mt-10 rounded-md bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          {state.message}
        </p>
      )}

      {state.status === "found" && (
        <div className="mt-10 rounded-xl border border-[var(--line)] bg-cream-soft p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-serif text-xl font-semibold text-ink">{state.order.orderNumber}</p>
              <p className="text-sm text-muted">
                Placed {new Date(state.order.createdAt).toLocaleDateString("en-PK")}
              </p>
            </div>
            <StatusBadge status={state.order.status} />
          </div>

          <ul className="mt-5 space-y-2 border-y border-[var(--line)] py-4 text-sm">
            {state.order.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span className="text-ink">
                  {i.name} <span className="text-muted">× {i.quantity}</span>
                </span>
                <span className="text-ink">{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-between text-sm">
            <span className="text-muted">
              Payment: {PAYMENT_METHOD_LABEL[state.order.paymentMethod] ?? state.order.paymentMethod} ·{" "}
              {state.order.paymentStatus.charAt(0) + state.order.paymentStatus.slice(1).toLowerCase()}
            </span>
            <span className="font-medium text-ink">{formatPrice(state.order.total)}</span>
          </div>

          {state.order.trackingNumber && state.order.courierName && (
            <div className="mt-4 rounded-lg border border-gold/40 bg-gold/5 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold-deep">Shipment</p>
              <p className="mt-1.5 text-sm text-ink">
                {state.order.courierName} · Tracking{" "}
                <span className="font-medium">{state.order.trackingNumber}</span>
              </p>
              {state.order.trackUrl && (
                <a
                  href={state.order.trackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-gold-deep underline underline-offset-4 hover:text-gold"
                >
                  Track your parcel →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
