import type { Metadata } from "next";
import Link from "next/link";
import { getFeaturedProducts, getProducts, getCategories } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { HeroSlider } from "@/components/hero-slider";
import { PromoSlider } from "@/components/promo-slider";
import { CategoryArt } from "@/components/category-art";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { Testimonials } from "@/components/testimonials";
import { Newsletter } from "@/components/newsletter";
import { Reveal } from "@/components/reveal";
import { JsonLd } from "@/components/json-ld";

import { siteUrl } from "@/lib/site";
import { getStoreSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/format";
import { InstagramIcon } from "@/components/icons";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ZARIERA",
  url: siteUrl,
  slogan: "Every Jewel Tells a Story",
  description:
    "Premium stainless steel and artificial jewelry — elegant, gold-plated, rust-free and hypoallergenic.",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ZARIERA",
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const trustBadges = (freeThreshold: number) => [
  { title: "Rust-free & hypoallergenic", body: "Premium stainless steel, gentle on skin." },
  { title: "Cash on Delivery", body: "Pay at your doorstep, nationwide." },
  { title: "Free shipping", body: `On orders over ${formatPrice(freeThreshold)}.` },
  { title: "Won't tarnish", body: "Keeps its shine wear after wear." },
];

export const revalidate = 300;

export default async function HomePage() {
  const settings = await getStoreSettings();
  const TRUST = trustBadges(settings.shipping.freeThreshold);
  const CONTACT = settings.social;
  const [featured, newest, categories] = await Promise.all([
    getFeaturedProducts(8),
    getProducts({ sort: "newest" }),
    getCategories(),
  ]);
  const topCategories = categories.slice(0, 4);

  // Product count + a representative image per category (to build premium
  // category cards, and mark empty categories "Coming soon").
  const countBySlug: Record<string, number> = {};
  const imageBySlug: Record<string, string> = {};
  for (const p of newest) {
    countBySlug[p.category.slug] = (countBySlug[p.category.slug] ?? 0) + 1;
    if (!imageBySlug[p.category.slug] && p.images.length > 0) {
      imageBySlug[p.category.slug] = p.images[0];
    }
  }

  // Real product images for the Instagram-style grid.
  const instaProducts = newest.filter((p) => p.images.length > 0).slice(0, 6);

  return (
    <>
      <JsonLd data={orgJsonLd} />
      <JsonLd data={websiteJsonLd} />

      {/* Hero slideshow */}
      <HeroSlider />

      {/* Trust badges */}
      <section className="border-y border-[var(--line)] bg-cream-soft/50 px-5 py-11">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-9 lg:grid-cols-4">
          {TRUST.map((t, i) => (
            <div
              key={t.title}
              className={`flex flex-col items-center px-2 text-center sm:px-6 ${
                i > 0 ? "lg:border-l lg:border-[var(--line)]" : ""
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(169,126,48,0.4)] bg-[radial-gradient(circle,rgba(214,178,104,0.16),transparent_70%)] text-gold-deep">
                <TrustIcon i={i} />
              </span>
              <p className="mt-3.5 font-serif text-lg font-semibold text-ink">{t.title}</p>
              <p className="mt-1 text-sm leading-snug text-muted">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Shop by category */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <div className="text-center">
            <span className="eyebrow">Collections</span>
            <h2 className="mt-3 font-serif text-4xl font-bold sm:text-5xl">Shop by category</h2>
          </div>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {topCategories.map((c, idx) => {
            const count = countBySlug[c.slug] ?? 0;
            const comingSoon = count === 0;
            const img = imageBySlug[c.slug];
            const cardCls =
              "group relative block aspect-[4/5] overflow-hidden rounded-2xl border border-[var(--line)] transition-all duration-500 hover:-translate-y-1 hover:border-gold hover:shadow-[0_28px_55px_-28px_rgba(38,8,16,0.6)]";

            const body =
              comingSoon || !img ? (
                // Coming soon / no photo yet → elegant maroon card
                <div
                  className="relative flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
                  style={{ background: "linear-gradient(160deg, #3d1019, #2a0b12)" }}
                >
                  <div className="pointer-events-none absolute inset-3 rounded-xl border border-[rgba(230,205,139,0.22)]" />
                  <CategoryArt slug={c.slug} className="h-20 w-20 text-gold transition duration-500 group-hover:scale-105" />
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-light">{c.name}</h3>
                    {comingSoon ? (
                      <span className="mt-2 inline-block rounded-full border border-[rgba(230,205,139,0.4)] px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-gold-hi">
                        Coming soon
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-gold-hi">Shop now →</span>
                    )}
                  </div>
                </div>
              ) : (
                // Real product photo as the category cover
                <>
                  <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110">
                    <ProductImage src={img} alt={c.name} seed={c.slug} />
                  </div>
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgba(38,8,16,0) 35%, rgba(38,8,16,0.55) 68%, rgba(38,8,16,0.86) 100%)" }}
                  />
                  <div className="pointer-events-none absolute inset-3 rounded-xl border border-[rgba(255,255,255,0.14)]" />
                  <div className="relative flex h-full flex-col items-center justify-end p-5 text-center">
                    <h3 className="font-serif text-2xl font-semibold text-light drop-shadow-sm">{c.name}</h3>
                    <span className="mt-1 text-xs uppercase tracking-[0.2em] text-gold-hi">Shop now →</span>
                  </div>
                </>
              );

            return (
              <Reveal key={c.slug} delay={(idx % 4) * 80}>
                {comingSoon ? (
                  <div className={cardCls}>{body}</div>
                ) : (
                  <Link href={`/shop/${c.slug}`} className={cardCls}>
                    {body}
                  </Link>
                )}
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* New arrivals (sorted by newest — there's no sales ranking yet) */}
      <section className="bg-cream-soft px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="flex items-end justify-between">
              <div>
                <span className="eyebrow">Just in</span>
                <h2 className="mt-3 font-serif text-4xl font-bold sm:text-5xl">New arrivals</h2>
              </div>
              <Link href="/shop" className="text-sm font-medium text-gold-deep hover:text-gold">
                View all →
              </Link>
            </div>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {newest.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Promo band — cross-fading editorial slider */}
      <PromoSlider />

      {/* Featured carousel */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <div className="flex items-end justify-between">
            <div>
              <span className="eyebrow">Curated</span>
              <h2 className="mt-3 font-serif text-4xl font-bold sm:text-5xl">Featured pieces</h2>
            </div>
            <Link href="/shop" className="text-sm font-medium text-gold-deep hover:text-gold">
              View all →
            </Link>
          </div>
        </Reveal>
        <div className="mt-10">
          <FeaturedCarousel products={featured} />
        </div>
      </section>

      {/* Brand story */}
      <section className="bg-cream px-5 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/story-model.webp"
                alt="A model wearing ZARIERA gold-plated stainless steel jewelry"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-3 border border-[rgba(230,205,139,0.6)]" />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div>
              <span className="eyebrow">Our story</span>
              <h2 className="mt-3 font-serif text-4xl font-bold text-ink sm:text-5xl">
                Craft, care &amp; a little sparkle
              </h2>
              <p className="mt-5 leading-relaxed text-ink/80">
                ZARIERA creates premium stainless steel and artificial jewelry — elegant,
                affordable and made to last. Our pieces are crafted in premium stainless steel
                with gold- and silver-tone finishes, so they stay rust-free and skin-friendly.
              </p>
              <p className="mt-4 leading-relaxed text-ink/80">
                We believe every jewel tells a story — of confidence, of everyday moments, of the
                people we treasure. Beautiful designs, without the fine-jewelry price tag.
              </p>
              <Link
                href="/about"
                className="mt-7 inline-block rounded-full border border-[var(--line-strong)] px-8 py-3 text-sm font-medium uppercase tracking-[0.12em] text-ink transition hover:border-gold hover:text-gold-deep"
              >
                Discover ZARIERA
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Instagram / lookbook */}
      <section className="relative overflow-hidden bg-cream-soft px-5 py-24">
        {/* gold hairline + soft glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(169,126,48,0.4)] to-transparent" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[60rem] -translate-x-1/2"
          style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(214,178,104,0.16), transparent 70%)" }}
        />

        <div className="relative mx-auto max-w-6xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-cream px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-gold-deep">
            <InstagramIcon size={15} />
            Lookbook
          </span>
          <h2 className="mt-4 font-serif text-4xl font-bold text-ink sm:text-5xl">Follow our journey</h2>
          <p className="mt-3 text-muted">
            Real pieces, real sparkle — tag us with{" "}
            <span className="font-medium text-gold-deep">#EveryJewelTellsAStory</span>
          </p>

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {instaProducts.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                aria-label={p.name}
                className="group relative block aspect-square overflow-hidden rounded-xl ring-1 ring-[var(--line)] transition-all duration-500 hover:-translate-y-1 hover:ring-2 hover:ring-gold hover:shadow-[0_24px_48px_-24px_rgba(38,8,16,0.55)]"
              >
                <div className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-110">
                  <ProductImage src={p.images[0]} alt={p.name} seed={p.slug} />
                </div>
                {/* darkening gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-wine-deep/85 via-wine-deep/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                {/* product name reveal */}
                <span className="absolute inset-x-0 bottom-0 translate-y-2 px-3 pb-3 text-left text-[0.72rem] font-medium leading-tight text-light opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  {p.name}
                </span>
                {/* Instagram glyph */}
                <span className="absolute right-2.5 top-2.5 text-gold-hi opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <InstagramIcon size={18} />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {CONTACT.instagram && (
              <a
                href={CONTACT.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-maroon px-8 py-3.5 text-sm font-medium uppercase tracking-[0.12em] text-light shadow-[0_14px_34px_-14px_rgba(91,26,43,0.7)] transition hover:bg-maroon-2"
              >
                <InstagramIcon size={18} />
                Follow us on Instagram
              </a>
            )}
            <Link
              href="/shop"
              className="rounded-full border border-[var(--line-strong)] px-8 py-3.5 text-sm font-medium uppercase tracking-[0.12em] text-ink transition hover:border-gold hover:text-gold-deep"
            >
              Shop the Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <Newsletter />
    </>
  );
}

function TrustIcon({ i }: { i: number }) {
  const p = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  // 0 Rust-free/skin-safe · 1 Cash on Delivery · 2 Free shipping · 3 Won't tarnish
  if (i === 0)
    return (
      <svg {...p}>
        <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  if (i === 1)
    return (
      <svg {...p}>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.4" />
        <path d="M6 9.5v5M18 9.5v5" />
      </svg>
    );
  if (i === 2)
    return (
      <svg {...p}>
        <path d="M3 7h10v8H3z" />
        <path d="M13 10h4l3 3v2h-7z" />
        <circle cx="7" cy="17.5" r="1.5" />
        <circle cx="17.5" cy="17.5" r="1.5" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M12 3l1.7 5L19 9.8l-5.3 1.7L12 17l-1.7-5.5L5 9.8 10.3 8z" />
      <path d="M18.5 4l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9L16 6.5l1.9-.6z" />
    </svg>
  );
}

