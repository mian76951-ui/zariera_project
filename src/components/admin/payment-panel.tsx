"use client";

import { useActionState } from "react";
import { updatePaymentStatus } from "@/app/admin/(dashboard)/orders/actions";
import { StatusUpdateForm, primaryBtn, useToastOn } from "@/components/admin/status-update-form";
import { StatusBadge } from "@/components/status-badge";
import { formatPrice } from "@/lib/format";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_TRANSITIONS,
  isWallet,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";

/** One-click payment change (e.g. "Mark as paid") with a toast. */
function QuickPayment({ id, to, label, tone = "ghost" }: { id: string; to: PaymentStatus; label: string; tone?: "ghost" | "primary" }) {
  const [state, action, pending] = useActionState(updatePaymentStatus.bind(null, id), {});
  useToastOn(state, "Payment updated");
  return (
    <form action={action}>
      <input type="hidden" name="paymentStatus" value={to} />
      <button
        disabled={pending}
        className={
          tone === "primary"
            ? primaryBtn
            : "text-xs font-medium text-gold-deep underline-offset-2 hover:underline disabled:opacity-60"
        }
      >
        {pending ? "Saving…" : label}
      </button>
    </form>
  );
}

export function PaymentPanel({
  id,
  method,
  paymentStatus,
  status,
  total,
  tid,
}: {
  id: string;
  method: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  total: number;
  tid: string | null;
}) {
  const label = PAYMENT_METHOD_LABEL[method] ?? method;
  const cancelled = status === "CANCELLED";
  const paid = paymentStatus === "PAID";

  return (
    <div className="rounded-xl border border-[var(--line)] bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold text-ink">Payment</h2>
        <StatusBadge status={paymentStatus} />
      </div>
      <p className="text-sm text-muted">
        Method: <span className="text-ink">{label}</span>
      </p>

      {method === "COD" ? (
        <div className="mt-3 text-sm">
          {paid ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-800">
              ✓ {formatPrice(total)} collected{status === "DELIVERED" ? " on delivery" : ""}.
            </p>
          ) : cancelled ? (
            <p className="rounded-lg border border-[var(--line)] bg-cream-soft px-3 py-2.5 text-muted">Not collected — order cancelled.</p>
          ) : (
            <>
              <p className="rounded-lg border border-gold/40 bg-gold/5 px-3 py-2.5 text-ink">
                Collect <b>{formatPrice(total)}</b> on delivery. Payment is marked paid automatically when you mark the
                order delivered.
              </p>
              <div className="mt-2 text-right">
                <QuickPayment id={id} to="PAID" label="Already received? Mark as paid" />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          {isWallet(method) && (
            <div className="rounded-lg border border-gold/40 bg-gold/5 px-3 py-2.5">
              <p className="text-xs uppercase tracking-[0.1em] text-muted">Transaction ID (TID)</p>
              <p className="mt-0.5 font-mono font-semibold tracking-wider text-ink">{tid ?? "—"}</p>
              {!paid && !cancelled && (
                <p className="mt-1 text-xs text-muted">
                  Check this TID in the {label} account for {formatPrice(total)}. If it&apos;s there, mark it paid — the
                  order is confirmed automatically.
                </p>
              )}
            </div>
          )}
          {isWallet(method) && paymentStatus === "PENDING" && !cancelled && (
            <QuickPayment id={id} to="PAID" label="TID verified — mark as paid" tone="primary" />
          )}
          {cancelled && paid && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
              <p className="font-medium">Refund due</p>
              <p className="text-xs">This order was cancelled after {formatPrice(total)} was paid. Refund the customer, then mark it refunded.</p>
              <div className="mt-2">
                <QuickPayment id={id} to="REFUNDED" label="Mark refunded" />
              </div>
            </div>
          )}
          {PAYMENT_TRANSITIONS[paymentStatus].length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-muted">Change payment status</p>
              <StatusUpdateForm
                action={updatePaymentStatus.bind(null, id)}
                name="paymentStatus"
                defaultValue={paymentStatus}
                options={[paymentStatus, ...PAYMENT_TRANSITIONS[paymentStatus]]}
                successMessage="Payment status updated"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
