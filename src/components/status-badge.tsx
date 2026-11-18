import { statusLabel } from "@/lib/order-status";

const STYLES: Record<string, { dot: string; cls: string }> = {
  PENDING: { dot: "bg-amber-500", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  CONFIRMED: { dot: "bg-blue-500", cls: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  PROCESSING: { dot: "bg-indigo-500", cls: "bg-indigo-50 text-indigo-700 ring-indigo-600/20" },
  SHIPPED: { dot: "bg-purple-500", cls: "bg-purple-50 text-purple-700 ring-purple-600/20" },
  DELIVERED: { dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  CANCELLED: { dot: "bg-red-500", cls: "bg-red-50 text-red-700 ring-red-600/20" },
  PAID: { dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  FAILED: { dot: "bg-red-500", cls: "bg-red-50 text-red-700 ring-red-600/20" },
  REFUNDED: { dot: "bg-gray-400", cls: "bg-gray-100 text-gray-600 ring-gray-500/20" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { dot: "bg-gray-400", cls: "bg-gray-100 text-gray-600 ring-gray-500/20" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {statusLabel(status)}
    </span>
  );
}
