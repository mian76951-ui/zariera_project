import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { formatPrice, discountPercent } from "@/lib/format";
import { ProductGallery } from "@/components/product-gallery";
import { getStoreSettings } from "@/lib/settings";
import { ProductCard } from "@/components/product-card";
import { DealPanel } from "@/components/ui/sale-badge";
import { AddToCart } from "@/components/cart/add-to-cart";
import { JsonLd } from "@/components/json-ld";

import { siteUrl } from "@/lib/site";
import { AccordionItem } from "@/components/ui/accordion-item";
import { toCartLine } from "@/lib/cart";

// Product pages are cached and served instantly; a product / stock change
// refreshes them (catalog tag + revalidatePath in the admin actions).
export const revalidate = 300;
export function generateStaticParams() {
  return []; // build nothing up front — each page is cached on its first visit
}

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found" };
  const description = product.description ?? `${product.name} — ZARIERA stainless steel jewelry.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: `${product.name} · ZARIERA`,
      description,
      type: "website",
      url: `${siteUrl}/product/${product.slug}`,
      images: product.images.length ? product.images : undefined,
    },
  };
}

function isGoldTone(material?: string | null): boolean {
  return /gold/i.test(material ?? "");
}

function finishOf(material?: string | null): string {
  if (!material) return "Polished stainless steel";
  if (/two-tone/i.test(material)) return "Two-tone silver & gold";
  if (/gold-plated|gold plated/i.test(material)) return "Gold-plated";
  return material;
}

function stoneOf(text: string): string | null {
  if (/cubic zirconia|pavé|pave|crystal/i.test(text)) return "Cubic zirconia";
  if (/onyx/i.test(text)) return "Black onyx";
  if (/mother-of-pearl|pearl/i.test(text)) return "Mother-of-pearl";
  return null;
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const settings = await getStoreSettings();
  const DELIVERY_TIME = settings.shipping.deliveryTime;
  const off = discountPercent(product.price, product.compareAtPrice);
  const related = await getRelatedProducts(product);
  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= settings.inventory.lowStockThreshold;

  const desc = product.description ?? "";
  const sentences = desc.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  const lead = sentences.slice(0, 2).join(" ");
  const finish = finishOf(product.material);
  const stone = stoneOf(desc);

  // Admin-entered per-product specs ("Label: Value" per line) take priority.
  const customSpecs: [string, string][] = (product.specs ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const idx = l.indexOf(":");
      return (idx === -1 ? ["Detail", l] : [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]) as [string, string];
    });
  const hasCustom = customSpecs.length > 0;

  // Compact highlights shown up top (Amazon-style "Top highlights")
  const derivedHighlights: [string, string][] = [
    ["Material", product.material || "Stainless steel"],
    ["Finish", finish],
    ["Quality", "Rust-free & hypoallergenic"],
    ["Category", product.category.name],
  ];
  const highlights = hasCustom ? customSpecs.slice(0, 4) : derivedHighlights;

  // Fuller specification table (inside "Product details")
  const specs: [string, string][] = hasCustom
    ? customSpecs
    : [
        ["Material", product.material || "Stainless steel"],
        ["Base metal", "Surgical-grade stainless steel"],
        ["Finish", finish],
        ...(stone ? ([["Stone", stone]] as [string, string][]) : []),
        ["Skin-friendly", "Hypoallergenic"],
        ["Care", "Keep away from water & perfume"],
        ["Category", product.category.name],
      ];

  const aboutBullets = [
    ...sentences,
    "Rust-free, hypoallergenic and gentle on sensitive skin.",
    isGoldTone(product.material)
      ? "Gold-plated over stainless steel — made to keep its shine with simple care."
      : "Solid stainless steel — made to keep its shine with simple care.",
  ];

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    category: product.category.name,
    ...(product.material ? { material: product.material } : {}),
    ...(product.images.length ? { image: product.images } : {}),
    brand: { "@type": "Brand", name: "ZARIERA" },
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: product.price,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${siteUrl}/product/${product.slug}`,
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-10">
      <JsonLd data={productJsonLd} />
      {/* Breadcrumb */}
      <nav className="text-sm text-muted">
        <Link href="/shop" className="hover:text-gold-deep">Shop</Link>
        <span className="mx-2">/</span>
        <Link href={`/shop/${product.category.slug}`} className="hover:text-gold-deep">
          {product.category.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        {/* Gallery */}
        <div className="md:sticky md:top-24 md:self-start">
          <ProductGallery images={product.images} name={product.name} slug={product.slug} />
        </div>

        {/* Details */}
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted">{product.category.name}</p>
            {product.featured && (
              <span className="rounded-full bg-maroon px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-gold">
                Featured
              </span>
            )}
          </div>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">{product.name}</h1>


          {off && product.compareAtPrice ? (
            <DealPanel price={product.price} compareAt={product.compareAtPrice} percent={off} />
          ) : (
            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <span className="font-serif text-3xl font-semibold text-ink">{formatPrice(product.price)}</span>
            </div>
          )}

          {lead && <p className="mt-4 leading-relaxed text-ink/80">{lead}</p>}

          {/* Top highlights */}
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-[var(--line)] bg-surface/60 p-5">
            {highlights.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-muted">{k}</dt>
                <dd className="mt-0.5 text-sm text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {/* Availability */}
          <p className="mt-4 text-sm">
            <span className={inStock ? "font-medium text-green-700" : "font-medium text-red-700"}>
              {inStock ? "In stock" : "Sold out"}
            </span>
            {lowStock && <span className="text-amber-700"> · only {product.stock} left</span>}
          </p>

          {/* Actions */}
          <div className="mt-5">
            <AddToCart
              product={toCartLine(product)}
            />
          </div>

          {/* Delivery & assurance */}
          <div className="mt-6 space-y-2.5 rounded-xl border border-[var(--line)] p-4 text-sm">
            <Assure icon="truck">Delivery in <b className="font-medium text-ink">{DELIVERY_TIME}</b> nationwide</Assure>
            <Assure icon="cash">Cash on Delivery available</Assure>
            <Assure icon="return">Easy <b className="font-medium text-ink">7-day returns</b></Assure>
            <Assure icon="shield">Secure checkout · rust-free &amp; hypoallergenic</Assure>
          </div>
        </div>
      </div>

      {/* ---------- Detailed sections (Amazon-style) ---------- */}
      <section className="mt-14 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink">Product details</h2>
          <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            <Accordion title="Highlights & specifications" open>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-[var(--line)]/60 pb-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Accordion>

            <Accordion title="About this item">
              <ul className="space-y-2.5">
                {aboutBullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Accordion>

            <Accordion title="Size & fit">
              <p>
                Designed for a comfortable everyday fit. Bracelets &amp; bangles come with an adjustable
                clasp or standard sizing; rings follow standard sizes. Exact measurements for this piece
                are shown on the photos — <Link href="/contact" className="text-gold-deep underline">message us</Link> if you need help choosing a size.
              </p>
            </Accordion>

            <Accordion title="Care & cleaning">
              <ul className="space-y-2 [&>li]:flex [&>li]:gap-2.5">
                <li><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" /> Keep away from water, perfume, lotion and hand sanitiser.</li>
                <li><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" /> Wipe gently with a soft, dry cloth after wear.</li>
                <li><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" /> Store in a dry pouch or box, away from direct sunlight.</li>
                <li><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" /> Remove before showering, swimming or workouts.</li>
              </ul>
            </Accordion>

            <Accordion title="Shipping & returns">
              <p>
                We ship nationwide via Leopards / TCS with <b className="font-medium text-ink">Cash on Delivery</b>{" "}
                available. Orders are dispatched within 1–2 days and typically arrive in {DELIVERY_TIME}.
                Not happy? Return unused items in original condition within <b className="font-medium text-ink">7 days</b>.
              </p>
            </Accordion>
          </div>
        </div>

        {/* Sticky assurance rail on desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-[var(--line)] bg-surface p-6 shadow-[0_20px_50px_-40px_rgba(38,8,16,0.5)]">
            <p className="font-serif text-xl font-semibold text-ink">Why ZARIERA</p>
            <ul className="mt-4 space-y-3 text-sm text-ink/80">
              <li className="flex gap-2.5"><Dot /> Premium stainless steel — rust-free &amp; made to last</li>
              <li className="flex gap-2.5"><Dot /> Skin-friendly &amp; hypoallergenic</li>
              <li className="flex gap-2.5"><Dot /> Cash on Delivery, nationwide</li>
              <li className="flex gap-2.5"><Dot /> Complimentary care guidance with every order</li>
            </ul>
          </div>
        </aside>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-2xl font-semibold text-ink">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Accordion({
  title,
  open,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      title={title}
      group="product-details"
      defaultOpen={open}
      summaryClassName="py-4 font-serif text-lg font-semibold text-ink"
      icon={
        <svg
          className="shrink-0 text-muted transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=open]:rotate-180"
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    >
      <div className="pb-5 text-sm leading-relaxed text-ink/80">{children}</div>
    </AccordionItem>
  );
}

function Dot() {
  return <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" />;
}

function Assure({ icon, children }: { icon: "truck" | "cash" | "return" | "shield"; children: React.ReactNode }) {
  const paths: Record<string, React.ReactNode> = {
    truck: (<><path d="M3 7h10v8H3z" /><path d="M13 10h4l3 3v2h-7z" /><circle cx="7" cy="17.5" r="1.4" /><circle cx="17.5" cy="17.5" r="1.4" /></>),
    cash: (<><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.3" /><path d="M6 9.5v5M18 9.5v5" /></>),
    return: (<><path d="M4 9a8 8 0 1 1-1 4" /><path d="M4 5v4h4" strokeLinecap="round" strokeLinejoin="round" /></>),
    shield: (<><path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></>),
  };
  return (
    <div className="flex items-center gap-3 text-muted">
      <svg className="shrink-0 text-gold-deep" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {paths[icon]}
      </svg>
      <span className="text-ink/80">{children}</span>
    </div>
  );
}
