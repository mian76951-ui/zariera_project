import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Emblem } from "@/components/brand/emblem";
import { logoutAction, startEmailVerification } from "../auth-actions";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  itemCount: number;
};

async function getMyOrders(customerId: string): Promise<OrderRow[]> {
  try {
    const rows = await prisma.order.findMany({
      // Only orders linked to this account. Guest orders placed under the same
      // email are NOT listed: email ownership isn't verified at sign-up, so
      // matching by email would expose a stranger's orders. Guests track their
      // orders with order number + email on /account/orders.
      where: { customerId },
      include: { items: { select: { quantity: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total),
      createdAt: o.createdAt.toISOString(),
      itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    }));
  } catch {
    return [];
  }
}

export default async function AccountPage() {
  const session = await requireCustomer();
  const [orders, verified] = await Promise.all([
    getMyOrders(session.id),
    prisma.customer
      .findUnique({ where: { id: session.id }, select: { emailVerifiedAt: true } })
      .then((c) => Boolean(c?.emailVerifiedAt))
      .catch(() => true), // DB hiccup: don't nag
  ]);
  const firstName = session.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Emblem size={38} className="text-gold-deep" />
          <div>
            <h1 className="font-serif text-3xl font-bold text-ink">Hello, {firstName}</h1>
            <p className="text-sm text-muted">Welcome to your account</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button className="rounded-full border border-[var(--line-strong)] px-5 py-2 text-sm text-ink transition hover:border-gold hover:text-gold-deep">
            Sign out
          </button>
        </form>
      </div>

      {!verified && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gold/50 bg-gold/10 px-5 py-4">
          <div>
            <p className="font-medium text-ink">Please verify your email</p>
            <p className="text-sm text-muted">
              We&apos;ll send a 6-digit code to {session.email} to confirm it&apos;s yours.
            </p>
          </div>
          <form action={startEmailVerification}>
            <button className="rounded-full bg-maroon px-5 py-2.5 text-sm font-medium text-light transition hover:bg-maroon-2">
              Verify email
            </button>
          </form>
        </div>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Profile */}
        <aside className="h-fit rounded-xl border border-[var(--line)] bg-cream-soft p-6">
          <h2 className="eyebrow mb-3">Profile</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted">Name</dt>
              <dd className="text-ink">{session.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="break-all text-ink">
                {session.email}
                {verified && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    ✓ Verified
                  </span>
                )}
              </dd>
            </div>
          </dl>
          <Link
            href="/shop"
            className="mt-5 block rounded-full bg-maroon px-5 py-2.5 text-center text-sm font-medium text-light transition hover:bg-maroon-2"
          >
            Continue shopping
          </Link>
        </aside>

        {/* Orders */}
        <section>
          <h2 className="font-serif text-2xl font-semibold text-ink">Order history</h2>

          {orders.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-cream-soft py-14 text-center">
              <p className="font-serif text-lg text-ink">No orders yet</p>
              <p className="mt-1 text-sm text-muted">
                When you place an order, it will appear here.
              </p>
              <Link
                href="/shop"
                className="mt-5 inline-block text-sm font-medium text-gold-deep hover:underline"
              >
                Start shopping →
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-cream-soft p-5"
                >
                  <div>
                    <p className="font-medium text-ink">{o.orderNumber}</p>
                    <p className="text-sm text-muted">
                      {formatDate(o.createdAt)}{" "}
                      · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={o.status} />
                    <span className="font-medium text-ink">{formatPrice(o.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-6 text-sm text-muted">
            Placed an order as a guest?{" "}
            <Link href="/account/orders" className="text-gold-deep hover:underline">
              Track it by order number
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
