import { getAdminOrders } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import { DbBanner } from "@/components/admin/db-banner";
import { OrdersTable } from "@/components/admin/orders-table";
import { requireAdmin } from "@/lib/admin";
import { needsPaymentCheck } from "@/lib/order-status";

export const metadata = { title: "Orders" };

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin(); // layouts don't re-run on client navigation
  const sp = await searchParams;
  const { dbConnected, orders } = await getAdminOrders();

  const revenue = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((s, o) => s + o.total, 0);
  const pending = orders.filter((o) => o.status === "PENDING").length;
  const toVerify = orders.filter(needsPaymentCheck).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Orders</h1>
          <p className="mt-1 text-sm text-muted">Track, review and update customer orders.</p>
        </div>
        {orders.length > 0 && (
          // Plain link (not next/link): it downloads a file.
          <a
            href="/api/admin/orders/export"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line-strong)] px-4 py-2 text-sm font-medium text-ink transition hover:border-gold hover:text-gold-deep"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            Export to Excel (CSV)
          </a>
        )}
      </div>

      <div className="mt-6">
        {!dbConnected && <DbBanner />}

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-surface py-16 text-center">
            <p className="font-serif text-xl text-ink">No orders yet</p>
            <p className="mt-1 text-sm text-muted">
              {dbConnected
                ? "Orders placed in the store will appear here."
                : "Connect the database to see real orders."}
            </p>
          </div>
        ) : (
          <>
            {/* Quick stats */}
            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat label="Total orders" value={String(orders.length)} />
              <MiniStat label="Pending" value={String(pending)} accent />
              <MiniStat label="Verify payment" value={String(toVerify)} accent={toVerify > 0} />
              <MiniStat label="Revenue" value={formatPrice(revenue)} />
            </div>

            <OrdersTable orders={orders} initialTab={sp.tab === "verify" ? "VERIFY" : "ALL"} />
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-surface p-4 shadow-[0_10px_30px_-24px_rgba(38,8,16,0.4)]">
      <p className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={`mt-1.5 font-serif text-2xl font-bold ${accent ? "text-gold-deep" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
