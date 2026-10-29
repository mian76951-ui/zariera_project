"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import type { AdminOrderRow } from "@/lib/admin-data";

const TABS = ["ALL", "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
type Tab = (typeof TABS)[number];

export function OrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab !== "ALL" && o.status !== tab) return false;
      if (query && !(`${o.orderNumber} ${o.customerName}`.toLowerCase().includes(query))) return false;
      return true;
    });
  }, [orders, tab, q]);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-surface shadow-[0_10px_30px_-22px_rgba(38,8,16,0.4)]">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order # or customer…"
            className="w-full rounded-lg border border-[var(--line-strong)] bg-cream-soft py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-gold"
          />
        </div>
        <p className="text-xs text-muted">
          {filtered.length} of {orders.length} order{orders.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--line)] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const active = tab === t;
          const n = counts[t] ?? 0;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active ? "bg-maroon text-light" : "text-muted hover:bg-cream-soft hover:text-ink"
              }`}
            >
              {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
              <span className={`rounded-full px-1.5 text-[0.62rem] ${active ? "bg-light/20 text-light" : "bg-cream-soft text-muted"}`}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="font-serif text-lg text-ink">No matching orders</p>
          <p className="mt-1 text-sm text-muted">Try a different search or status filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[0.68rem] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/admin/orders/${o.id}`)}
                    className="cursor-pointer border-b border-[var(--line)] transition-colors last:border-0 hover:bg-cream-soft"
                  >
                    <td className="px-4 py-3">
                      <span className="block whitespace-nowrap font-medium text-gold-deep">{o.orderNumber}</span>
                      <span className="mt-0.5 block text-xs text-muted">{o.itemCount} item{o.itemCount === 1 ? "" : "s"}</span>
                    </td>
                    <td className="px-4 py-3 text-ink">{o.customerName}</td>
                    <td className="px-4 py-3">
                      <span className="mr-2 text-xs font-medium text-ink">{o.paymentMethod}</span>
                      <StatusBadge status={o.paymentStatus} />
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right font-medium text-ink [font-variant-numeric:tabular-nums]">{formatPrice(o.total)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-[var(--line)] md:hidden">
            {filtered.map((o) => (
              <button
                key={o.id}
                onClick={() => router.push(`/admin/orders/${o.id}`)}
                className="flex w-full flex-col gap-2 p-4 text-left transition hover:bg-cream-soft"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gold-deep">{o.orderNumber}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink">{o.customerName}</span>
                  <span className="font-semibold text-ink [font-variant-numeric:tabular-nums]">{formatPrice(o.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>{o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {o.paymentMethod}</span>
                  <span>{formatDate(o.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
