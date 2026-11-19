// Plain constants (safe to import anywhere — not a "use server" module).
export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Allowed order-status moves: forward only (a step may be skipped), cancel
// before delivery, DELIVERED is final. CANCELLED → PENDING is the "Reopen"
// path only (reopenOrder takes the stock out again).
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CONFIRMED", "PROCESSING", "SHIPPED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: ["PENDING"],
};

/** The happy path, in order (for the admin stepper). */
export const ORDER_STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/** Display names. PROCESSING is stored as-is but shown as "Packed". */
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.charAt(0) + s.slice(1).toLowerCase();

/** Button text for moving an order to a status. */
export const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirm order",
  PROCESSING: "Mark packed",
  SHIPPED: "Mark shipped",
  DELIVERED: "Mark delivered",
};

/** Online (paid in advance) methods must be PAID before an order ships. */
export const needsPaymentBeforeShipping = (method: string) => method !== "COD";

/** Why an order can't be marked shipped yet, or null if it can. */
export function shippingBlockedReason(o: { paymentMethod: string; paymentStatus: string }): string | null {
  return needsPaymentBeforeShipping(o.paymentMethod) && o.paymentStatus !== "PAID"
    ? "This order hasn't been paid yet. Mark the payment as paid first."
    : null;
}

/**
 * The forward moves to offer for an order: `primary` is the next step,
 * `skips` are later steps it can jump to. Cancel / Reopen are handled apart.
 */
export function nextActions(status: OrderStatus): { primary: OrderStatus | null; skips: OrderStatus[] } {
  const forward = ORDER_TRANSITIONS[status].filter((s) => s !== "CANCELLED" && s !== "PENDING");
  return { primary: forward[0] ?? null, skips: forward.slice(1) };
}

export const CANCEL_REASONS = [
  "Customer request",
  "Out of stock",
  "Fake order",
  "Unreachable on phone",
  "Payment not received",
] as const;

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ["PAID", "FAILED"],
  FAILED: ["PENDING", "PAID"],
  PAID: ["REFUNDED"],
  REFUNDED: [],
};

export function canMoveOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canMovePayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: "Cash on Delivery",
  PAYFAST: "Card (PayFast)",
  SAFEPAY: "Card / Wallet (Safepay)",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
};

// Easypaisa / JazzCash: the shopper sends money to the store's account and
// types the Transaction ID (TID); an admin checks it and marks the order Paid.
export const WALLET_METHODS = ["EASYPAISA", "JAZZCASH"] as const;
export type WalletMethod = (typeof WALLET_METHODS)[number];
export function isWallet(method: string | null | undefined): method is WalletMethod {
  return (WALLET_METHODS as readonly string[]).includes(method ?? "");
}
/** Easypaisa / JazzCash order whose TID an admin still has to check. */
export function needsPaymentCheck(o: { paymentMethod: string; paymentStatus: string; status: string }): boolean {
  return isWallet(o.paymentMethod) && o.paymentStatus === "PENDING" && o.status !== "CANCELLED";
}
/** Gateway methods are confirmed by PayFast / Safepay callbacks, never by hand. */
export function isGateway(method: string | null | undefined): boolean {
  return method === "PAYFAST" || method === "SAFEPAY";
}
/** TIDs are 10–12 digits today; allow a little slack (letters, 8–20 chars). */
export const TID_RE = /^[A-Za-z0-9]{8,20}$/;
/** One message for a missing / malformed TID, shown by checkout and the server alike. */
export function tidError(tid: string | undefined, method: string): string | null {
  if (!tid) return `Enter the Transaction ID (TID) from your ${PAYMENT_METHOD_LABEL[method] ?? "payment"} SMS`;
  if (!TID_RE.test(tid)) return "A TID is 8–20 letters or digits, e.g. 01234567890";
  return null;
}
export function normalizeTid(v: unknown): string {
  return String(v ?? "").replace(/[\s-]/g, "").toUpperCase();
}
/** Settings key for each wallet method. */
export const WALLET_SETTING_KEY = { EASYPAISA: "easypaisa", JAZZCASH: "jazzcash" } as const;
