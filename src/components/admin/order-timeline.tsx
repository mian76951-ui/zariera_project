import { statusLabel } from "@/lib/order-status";

type Event = {
  id: string;
  type: string;
  from: string | null;
  to: string | null;
  note: string | null;
  actor: string;
  createdAt: string;
};

function describe(e: Event): string {
  switch (e.type) {
    case "PLACED":
      return "Order placed";
    case "STATUS":
      return `Status: ${statusLabel(e.from ?? "")} → ${statusLabel(e.to ?? "")}`;
    case "PAYMENT":
      return `Payment: ${statusLabel(e.from ?? "")} → ${statusLabel(e.to ?? "")}`;
    case "CANCELLED":
      return "Order cancelled · stock returned";
    case "REOPENED":
      return "Order reopened · stock taken again";
    case "SHIPMENT_BOOKED":
      return "Shipment booked";
    default:
      return e.type;
  }
}

const DOT: Record<string, string> = {
  CANCELLED: "bg-red-500",
  REOPENED: "bg-amber-500",
  PAYMENT: "bg-emerald-500",
  SHIPMENT_BOOKED: "bg-purple-500",
};

/** Newest-first history of an order: who did what, and when. */
export function OrderTimeline({ events, placedAt }: { events: Event[]; placedAt: string }) {
  // Orders placed before the timeline existed have no events yet.
  const rows = events.length
    ? events
    : [{ id: "placed", type: "PLACED", from: null, to: null, note: null, actor: "customer", createdAt: placedAt }];
  return (
    <div className="rounded-xl border border-[var(--line)] bg-surface p-5 text-sm">
      <h2 className="mb-3 font-serif text-lg font-semibold text-ink">History</h2>
      <ol className="space-y-3">
        {rows.map((e) => (
          <li key={e.id} className="flex gap-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[e.type] ?? "bg-gold"}`} />
            <div className="min-w-0">
              <p className="text-ink">{describe(e)}</p>
              {e.note && <p className="text-muted">{e.note}</p>}
              <p className="text-xs text-muted">
                {new Date(e.createdAt).toLocaleString("en-PK")} · {e.actor === "customer" ? "Customer" : e.actor === "system" ? "System" : e.actor}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
