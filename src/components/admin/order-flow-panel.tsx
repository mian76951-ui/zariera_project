"use client";

import { useActionState, useEffect, useState } from "react";
import {
  cancelOrderAction,
  reopenOrderAction,
  updateOrderStatus,
  type StatusState,
} from "@/app/admin/(dashboard)/orders/actions";
import { useToast } from "@/components/ui/toast";
import {
  ACTION_LABEL,
  CANCEL_REASONS,
  ORDER_STEPS,
  nextActions,
  statusLabel,
  type OrderStatus,
} from "@/lib/order-status";

const primaryBtn =
  "w-full rounded-lg bg-maroon px-4 py-2.5 text-sm font-medium text-light transition hover:bg-maroon-2 disabled:opacity-60";
const ghostBtn =
  "rounded-lg border border-[var(--line-strong)] px-3 py-2 text-sm text-ink transition hover:border-gold hover:text-gold-deep disabled:opacity-60";
const fieldCls =
  "w-full rounded-md border border-[var(--line-strong)] bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-gold";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

function useToastOn(state: StatusState, success: string) {
  const toast = useToast();
  useEffect(() => {
    if (state.ok) toast.success(success, { title: "Saved" });
    else if (state.error) toast.error(state.error);
  }, [state, toast, success]);
}

/** Step-based order controls: stepper, next-step button, cancel and reopen. */
export function OrderFlowPanel({
  id,
  status,
  stamps,
  cancelReason,
  blockedReason,
}: {
  id: string;
  status: OrderStatus;
  /** When each step was reached (ISO), if known. */
  stamps: Partial<Record<OrderStatus, string | null>>;
  cancelReason: string | null;
  /** Why shipping is blocked (e.g. unpaid online order), shown under the button. */
  blockedReason: string | null;
}) {
  const [moveState, moveAction, moving] = useActionState(updateOrderStatus.bind(null, id), {});
  const [cancelState, cancelAction, cancelling] = useActionState(cancelOrderAction.bind(null, id), {});
  const [reopenState, reopenAction, reopening] = useActionState(reopenOrderAction.bind(null, id), {});
  const [askCancel, setAskCancel] = useState(false);
  const [askReopen, setAskReopen] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  useToastOn(moveState, "Order updated");
  useToastOn(cancelState, "Order cancelled — stock returned");
  useToastOn(reopenState, "Order reopened — back to Pending");

  // The page renders this with key={status}, so the open dialogs reset after a move.

  const cancelled = status === "CANCELLED";
  const delivered = status === "DELIVERED";
  const { primary, skips } = nextActions(status);
  const currentIdx = ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number]);
  const shipStep = (s: OrderStatus) => s === "SHIPPED" || s === "DELIVERED";

  return (
    <div className="rounded-xl border border-[var(--line)] bg-surface p-5">
      <h2 className="mb-4 font-serif text-lg font-semibold text-ink">Order progress</h2>

      {/* Stepper */}
      <ol className={`space-y-0 ${cancelled ? "opacity-50" : ""}`}>
        {ORDER_STEPS.map((step, i) => {
          const done = !cancelled && currentIdx >= i;
          const current = !cancelled && currentIdx === i;
          const stamp = done ? when(stamps[step] ?? null) : null;
          return (
            <li key={step} className="relative flex gap-3 pb-4 last:pb-0">
              {i < ORDER_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-[9px] top-5 h-[calc(100%-12px)] w-0.5 ${done && currentIdx > i ? "bg-gold" : "bg-[var(--line-strong)]"}`}
                />
              )}
              <span
                className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? "bg-gold text-maroon" : "border-2 border-[var(--line-strong)] bg-surface text-muted"
                } ${current && !delivered ? "ring-4 ring-gold/25" : ""}`}
              >
                {done && (!current || delivered) ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-sm ${current ? "font-semibold text-ink" : done ? "text-ink" : "text-muted"}`}>
                  {step === "PENDING" ? "Placed" : statusLabel(step)}
                </p>
                {stamp && <p className="text-xs text-muted">{stamp}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Final states */}
      {delivered && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          ✓ Order complete — delivered {when(stamps.DELIVERED ?? null) ?? ""}.
        </p>
      )}

      {cancelled && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
          <p className="font-medium">Cancelled {when(stamps.CANCELLED ?? null) ?? ""}</p>
          {cancelReason && <p className="mt-0.5">Reason: {cancelReason}</p>}
          <p className="mt-0.5 text-xs text-red-700/80">Items were returned to stock.</p>
          {!askReopen ? (
            <button type="button" onClick={() => setAskReopen(true)} className={`${ghostBtn} mt-3 w-full bg-surface`}>
              Reopen order
            </button>
          ) : (
            <form action={reopenAction} className="mt-3 rounded-md bg-surface p-3 text-ink">
              <p className="text-sm">Reopen this order? It goes back to <b>Pending</b> and its items are taken out of stock again.</p>
              <div className="mt-3 flex gap-2">
                <button disabled={reopening} className={`${primaryBtn} flex-1`}>
                  {reopening ? "Reopening…" : "Yes, reopen"}
                </button>
                <button type="button" onClick={() => setAskReopen(false)} className={ghostBtn}>
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Next step */}
      {!cancelled && primary && (
        <div className="mt-5 space-y-2">
          <form action={moveAction}>
            <input type="hidden" name="status" value={primary} />
            <button
              disabled={moving || (shipStep(primary) && !!blockedReason)}
              className={primaryBtn}
            >
              {moving ? "Saving…" : ACTION_LABEL[primary] ?? statusLabel(primary)}
            </button>
          </form>
          {blockedReason && shipStep(primary) && <p className="text-xs text-amber-700">{blockedReason}</p>}
          {skips.length > 0 && (
            <form action={moveAction} className="flex items-center gap-2">
              <select name="status" className={fieldCls} defaultValue="" aria-label="Skip ahead to">
                <option value="" disabled>
                  Skip ahead to…
                </option>
                {skips.map((s) => (
                  <option key={s} value={s} disabled={shipStep(s) && !!blockedReason}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
              <button disabled={moving} className={ghostBtn}>
                Go
              </button>
            </form>
          )}
        </div>
      )}

      {/* Cancel */}
      {!cancelled && !delivered && (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          {!askCancel ? (
            <button type="button" onClick={() => setAskCancel(true)} className="text-sm font-medium text-red-700 hover:underline">
              Cancel order
            </button>
          ) : (
            <form action={cancelAction} className="space-y-2 rounded-md border border-red-200 bg-red-50/60 p-3">
              <label htmlFor="cancel-reason" className="block text-sm font-medium text-ink">
                Why is this order being cancelled?
              </label>
              <select
                id="cancel-reason"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={fieldCls}
              >
                {CANCEL_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
                <option value="Other">Other…</option>
              </select>
              {reason === "Other" && (
                <input name="otherReason" required maxLength={200} placeholder="Type the reason" className={fieldCls} />
              )}
              <p className="text-xs text-muted">The items go back into stock. You can reopen the order later.</p>
              <div className="flex gap-2">
                <button
                  disabled={cancelling}
                  className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:opacity-60"
                >
                  {cancelling ? "Cancelling…" : "Cancel order"}
                </button>
                <button type="button" onClick={() => setAskCancel(false)} className={ghostBtn}>
                  Keep order
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
