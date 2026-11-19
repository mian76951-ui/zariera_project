import { prisma } from "./prisma";
import { getStoreSettings } from "./settings";
import { ORDER_STATUSES } from "./order-status";
import { PAYMENT_METHOD_LABEL, WALLET_METHODS } from "./order-status";

export type AdminStats = {
  dbConnected: boolean;
  products: number;
  orders: number;
  pendingOrders: number;
  revenue: number;
  customers: number;
  lowStock: number;
  monthOrders: number;
  monthRevenue: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [products, orders, pendingOrders, revenueAgg, customers, lowStock, monthOrders, monthRevAgg] =
      await Promise.all([
        prisma.product.count(),
        prisma.order.count(),
        prisma.order.count({ where: { status: "PENDING" } }),
        prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: "CANCELLED" } } }),
        prisma.customer.count(),
        prisma.product.count({ where: { stock: { lte: (await getStoreSettings()).inventory.lowStockThreshold } } }),
        prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { status: { not: "CANCELLED" }, createdAt: { gte: monthStart } },
        }),
      ]);
    return {
      dbConnected: true,
      products,
      orders,
      pendingOrders,
      revenue: Number(revenueAgg._sum.total ?? 0),
      customers,
      lowStock,
      monthOrders,
      monthRevenue: Number(monthRevAgg._sum.total ?? 0),
    };
  } catch {
    return {
      dbConnected: false, products: 0, orders: 0, pendingOrders: 0, revenue: 0,
      customers: 0, lowStock: 0, monthOrders: 0, monthRevenue: 0,
    };
  }
}

export type AdminCustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orders: number;
  spent: number;
  createdAt: string;
};

export async function getAdminCustomers(): Promise<{
  dbConnected: boolean;
  customers: AdminCustomerRow[];
}> {
  try {
    const rows = await prisma.customer.findMany({
      include: { orders: { select: { total: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
    return {
      dbConnected: true,
      customers: rows.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        orders: c.orders.length,
        spent: c.orders
          .filter((o) => o.status !== "CANCELLED")
          .reduce((s, o) => s + Number(o.total), 0),
        createdAt: c.createdAt.toISOString(),
      })),
    };
  } catch {
    return { dbConnected: false, customers: [] };
  }
}

export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  products: number;
};

export async function getAdminCategories(): Promise<{
  dbConnected: boolean;
  categories: AdminCategoryRow[];
}> {
  try {
    const rows = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });
    return {
      dbConnected: true,
      categories: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        products: c._count.products,
      })),
    };
  } catch {
    return { dbConnected: false, categories: [] };
  }
}

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  featured: boolean;
  active: boolean;
  category: string;
};

export async function getAdminProducts(): Promise<{
  dbConnected: boolean;
  products: AdminProduct[];
}> {
  try {
    const rows = await prisma.product.findMany({
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return {
      dbConnected: true,
      products: rows.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        stock: p.stock,
        featured: p.featured,
        active: p.active,
        category: p.category.name,
      })),
    };
  } catch {
    return { dbConnected: false, products: [] };
  }
}

export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  sku: string | null;
  stock: number;
  material: string | null;
  specs: string | null;
  images: string[];
  featured: boolean;
  active: boolean;
  categoryId: string;
};

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  try {
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice),
      sku: p.sku,
      stock: p.stock,
      material: p.material,
      specs: p.specs,
      images: p.images,
      featured: p.featured,
      active: p.active,
      categoryId: p.categoryId,
    };
  } catch {
    return null;
  }
}

export async function getCategoriesForSelect(): Promise<{ id: string; name: string }[]> {
  try {
    return await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  itemCount: number;
};

/** Easypaisa / JazzCash orders whose TID still has to be checked (same rule as `needsPaymentCheck`). */
export async function countOrdersToVerify(): Promise<number> {
  try {
    return await prisma.order.count({
      where: { paymentMethod: { in: [...WALLET_METHODS] }, paymentStatus: "PENDING", status: { not: "CANCELLED" } },
    });
  } catch {
    return 0;
  }
}

/** Newest orders first. Pass `take` when only the latest few are needed (dashboard). */
export async function getAdminOrders(take?: number): Promise<{
  dbConnected: boolean;
  orders: AdminOrderRow[];
}> {
  try {
    const rows = await prisma.order.findMany({
      include: { items: { select: { quantity: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return {
      dbConnected: true,
      orders: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        total: Number(o.total),
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
      })),
    };
  } catch {
    return { dbConnected: false, orders: [] };
  }
}

export async function getAdminOrder(id: string) {
  try {
    const o = await prisma.order.findUnique({
      where: { id },
      include: { items: true, events: { orderBy: { createdAt: "desc" } } },
    });
    if (!o) return null;
    return {
      ...o,
      subtotal: Number(o.subtotal),
      shipping: Number(o.shipping),
      total: Number(o.total),
      createdAt: o.createdAt.toISOString(),
      shippedAt: o.shippedAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      cancelledAt: o.cancelledAt?.toISOString() ?? null,
      events: o.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      items: o.items.map((i) => ({ ...i, price: Number(i.price) })),
    };
  } catch {
    return null;
  }
}

/* ─────────────────────────  Sales analytics  ───────────────────────── */

export type SalesPoint = { label: string; revenue: number; orders: number };
export type SalesRange = {
  points: SalesPoint[];
  totalRevenue: number;
  totalOrders: number;
  avgOrder: number;
  changePct: number | null; // vs the immediately-preceding window of equal length
  peak: number;
};
export type SalesInsights = {
  dbConnected: boolean;
  day: SalesRange;
  month: SalesRange;
  year: SalesRange;
};

type Row = { t: Date; v: number };

function summarize(
  points: SalesPoint[],
  total: number,
  count: number,
  prevTotal: number
): SalesRange {
  const peak = points.reduce((m, p) => Math.max(m, p.revenue), 0);
  let changePct: number | null;
  if (prevTotal > 0) changePct = Math.round(((total - prevTotal) / prevTotal) * 100);
  else changePct = total > 0 ? 100 : null;
  return {
    points,
    totalRevenue: total,
    totalOrders: count,
    avgOrder: count > 0 ? Math.round(total / count) : 0,
    changePct,
    peak,
  };
}

function sumBetween(rows: Row[], start: Date, end: Date): number {
  let s = 0;
  for (const r of rows) if (r.t >= start && r.t < end) s += r.v;
  return s;
}

function buildDay(rows: Row[]): SalesRange {
  const N = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const points: SalesPoint[] = [];
  let total = 0;
  let count = 0;
  for (let i = N - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    let rev = 0;
    let ord = 0;
    for (const r of rows)
      if (r.t >= day && r.t < next) {
        rev += r.v;
        ord++;
      }
    points.push({
      label: day.toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
      revenue: rev,
      orders: ord,
    });
    total += rev;
    count += ord;
  }
  const prevStart = new Date(today);
  prevStart.setDate(today.getDate() - 2 * N + 1);
  const curStart = new Date(today);
  curStart.setDate(today.getDate() - N + 1);
  return summarize(points, total, count, sumBetween(rows, prevStart, curStart));
}

function buildMonth(rows: Row[]): SalesRange {
  const N = 12;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  const points: SalesPoint[] = [];
  let total = 0;
  let count = 0;
  for (let i = N - 1; i >= 0; i--) {
    const m = new Date(base);
    m.setMonth(base.getMonth() - i);
    const next = new Date(m);
    next.setMonth(m.getMonth() + 1);
    let rev = 0;
    let ord = 0;
    for (const r of rows)
      if (r.t >= m && r.t < next) {
        rev += r.v;
        ord++;
      }
    points.push({
      label: m.toLocaleDateString("en-PK", { month: "short" }),
      revenue: rev,
      orders: ord,
    });
    total += rev;
    count += ord;
  }
  const prevStart = new Date(base);
  prevStart.setMonth(base.getMonth() - 2 * N + 1);
  const curStart = new Date(base);
  curStart.setMonth(base.getMonth() - N + 1);
  return summarize(points, total, count, sumBetween(rows, prevStart, curStart));
}

function buildYear(rows: Row[]): SalesRange {
  const N = 5;
  const nowY = new Date().getFullYear();
  const points: SalesPoint[] = [];
  let total = 0;
  let count = 0;
  for (let i = N - 1; i >= 0; i--) {
    const y = nowY - i;
    const start = new Date(y, 0, 1);
    const next = new Date(y + 1, 0, 1);
    let rev = 0;
    let ord = 0;
    for (const r of rows)
      if (r.t >= start && r.t < next) {
        rev += r.v;
        ord++;
      }
    points.push({ label: String(y), revenue: rev, orders: ord });
    total += rev;
    count += ord;
  }
  const prevStart = new Date(nowY - 2 * N + 1, 0, 1);
  const curStart = new Date(nowY - N + 1, 0, 1);
  return summarize(points, total, count, sumBetween(rows, prevStart, curStart));
}

export type DailyPoint = { time: string; revenue: number; orders: number };

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Continuous daily series (zero-filled) for the Amazon/Keepa-style zoomable chart.
export async function getSalesDaily(
  days = 365
): Promise<{ dbConnected: boolean; points: DailyPoint[] }> {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const orders = await prisma.order.findMany({
      where: { status: { not: "CANCELLED" }, createdAt: { gte: start } },
      select: { createdAt: true, total: true },
    });
    const map = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const key = ymd(o.createdAt);
      const cur = map.get(key) || { revenue: 0, orders: 0 };
      cur.revenue += Number(o.total);
      cur.orders += 1;
      map.set(key, cur);
    }
    const points: DailyPoint[] = [];
    const d = new Date(start);
    for (let i = 0; i < days; i++) {
      const key = ymd(d);
      const v = map.get(key) || { revenue: 0, orders: 0 };
      points.push({ time: key, revenue: v.revenue, orders: v.orders });
      d.setDate(d.getDate() + 1);
    }
    return { dbConnected: true, points };
  } catch {
    return { dbConnected: false, points: [] };
  }
}

export type StorePerformance = {
  dbConnected: boolean;
  fulfillmentPct: number;
  delivered: number;
  totalOrders: number;
  paymentPct: number;
  paid: number;
  stockPct: number;
  inStock: number;
  totalProducts: number;
};

export async function getStorePerformance(): Promise<StorePerformance> {
  try {
    const [totalOrders, delivered, paid, totalProducts, inStock] = await Promise.all([
      prisma.order.count({ where: { status: { not: "CANCELLED" } } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.order.count({ where: { paymentStatus: "PAID", status: { not: "CANCELLED" } } }),
      prisma.product.count(),
      prisma.product.count({ where: { stock: { gt: 0 } } }),
    ]);
    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
    return {
      dbConnected: true,
      fulfillmentPct: pct(delivered, totalOrders),
      delivered,
      totalOrders,
      paymentPct: pct(paid, totalOrders),
      paid,
      stockPct: pct(inStock, totalProducts),
      inStock,
      totalProducts,
    };
  } catch {
    return {
      dbConnected: false,
      fulfillmentPct: 0, delivered: 0, totalOrders: 0,
      paymentPct: 0, paid: 0,
      stockPct: 0, inStock: 0, totalProducts: 0,
    };
  }
}

export async function getSalesInsights(): Promise<SalesInsights> {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { createdAt: true, total: true },
    });
    const rows: Row[] = orders.map((o) => ({ t: o.createdAt, v: Number(o.total) }));
    return {
      dbConnected: true,
      day: buildDay(rows),
      month: buildMonth(rows),
      year: buildYear(rows),
    };
  } catch {
    const empty: SalesRange = {
      points: [],
      totalRevenue: 0,
      totalOrders: 0,
      avgOrder: 0,
      changePct: null,
      peak: 0,
    };
    return { dbConnected: false, day: empty, month: empty, year: empty };
  }
}

/* ─────────────────────  Dashboard breakdowns  ───────────────────── */

export type TopProduct = {
  productId: string;
  name: string;
  slug: string | null;
  image: string | null;
  units: number;
  revenue: number;
};
export type CategorySales = { name: string; revenue: number; share: number };

export async function getSalesBreakdown(): Promise<{
  dbConnected: boolean;
  topProducts: TopProduct[];
  categories: CategorySales[];
}> {
  try {
    const items = await prisma.orderItem.findMany({
      where: { order: { status: { not: "CANCELLED" } } },
      select: {
        productId: true,
        name: true,
        price: true,
        quantity: true,
        product: { select: { slug: true, images: true, category: { select: { name: true } } } },
      },
    });
    const prodMap = new Map<string, TopProduct>();
    const catMap = new Map<string, number>();
    let totalRev = 0;
    for (const it of items) {
      const rev = Number(it.price) * it.quantity;
      totalRev += rev;
      const cur =
        prodMap.get(it.productId) ??
        {
          productId: it.productId,
          name: it.name,
          slug: it.product?.slug ?? null,
          image: it.product?.images?.[0] ?? null,
          units: 0,
          revenue: 0,
        };
      cur.units += it.quantity;
      cur.revenue += rev;
      prodMap.set(it.productId, cur);
      const cat = it.product?.category?.name ?? "Other";
      catMap.set(cat, (catMap.get(cat) ?? 0) + rev);
    }
    const topProducts = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const categories = [...catMap.entries()]
      .map(([name, revenue]) => ({
        name,
        revenue,
        share: totalRev > 0 ? Math.round((revenue / totalRev) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
    return { dbConnected: true, topProducts, categories };
  } catch {
    return { dbConnected: false, topProducts: [], categories: [] };
  }
}

export type StatusCount = { status: string; count: number };

export async function getOrderStatusBreakdown(): Promise<{
  dbConnected: boolean;
  counts: StatusCount[];
  total: number;
}> {
  try {
    const grouped = await prisma.order.groupBy({ by: ["status"], _count: { status: true } });
    const map = new Map(grouped.map((g) => [g.status as string, g._count.status]));
    const counts = ORDER_STATUSES.map((s) => ({ status: s, count: map.get(s) ?? 0 }));
    const total = counts.reduce((n, c) => n + c.count, 0);
    return { dbConnected: true, counts, total };
  } catch {
    return { dbConnected: false, counts: [], total: 0 };
  }
}

export type PaymentSlice = {
  method: string;
  label: string;
  orders: number;
  revenue: number;
  share: number;
};

export async function getPaymentBreakdown(): Promise<{
  dbConnected: boolean;
  methods: PaymentSlice[];
  total: number;
}> {
  try {
    const grouped = await prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: true,
    });
    const totalRev = grouped.reduce((s, g) => s + Number(g._sum.total ?? 0), 0);
    const methods = grouped
      .map((g) => {
        const revenue = Number(g._sum.total ?? 0);
        return {
          method: g.paymentMethod as string,
          label: PAYMENT_METHOD_LABEL[g.paymentMethod] ?? g.paymentMethod,
          orders: g._count,
          revenue,
          share: totalRev > 0 ? Math.round((revenue / totalRev) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
    return { dbConnected: true, methods, total: totalRev };
  } catch {
    return { dbConnected: false, methods: [], total: 0 };
  }
}

export async function getRecentCustomers(limit = 5): Promise<{
  dbConnected: boolean;
  customers: AdminCustomerRow[];
}> {
  try {
    const rows = await prisma.customer.findMany({
      include: { orders: { select: { total: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      dbConnected: true,
      customers: rows.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        orders: c.orders.length,
        spent: c.orders
          .filter((o) => o.status !== "CANCELLED")
          .reduce((s, o) => s + Number(o.total), 0),
        createdAt: c.createdAt.toISOString(),
      })),
    };
  } catch {
    return { dbConnected: false, customers: [] };
  }
}
