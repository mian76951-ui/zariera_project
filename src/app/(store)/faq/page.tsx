import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/brand/emblem";
import { getStoreSettings } from "@/lib/settings";
import { walletReady, type StoreSettings } from "@/lib/settings-shared";
import { payfastConfigured, safepayConfigured } from "@/lib/payments";
import { PAYMENT_METHOD_LABEL, WALLET_METHODS, WALLET_SETTING_KEY } from "@/lib/order-status";
import { AccordionItem } from "@/components/ui/accordion-item";

export const metadata: Metadata = {
  alternates: { canonical: "/faq" },
  title: "FAQ",
  description: "Answers to common questions about ordering, payment, shipping and returns at ZARIERA.",
};

// Only mention payment options that are actually switched on right now.
function paymentAnswers(s: StoreSettings): { order: string; methods: string } {
  const browse = "Browse the collection, add pieces to your bag, and check out.";
  const cod = "Cash on Delivery (COD) across Pakistan";
  if (payfastConfigured() || safepayConfigured()) {
    return {
      order: `${browse} You can pay Cash on Delivery, or pay securely online by card, Easypaisa or JazzCash.`,
      methods: `${cod}, and secure online payment by card, Easypaisa or JazzCash at checkout.`,
    };
  }
  const wallets = WALLET_METHODS.filter((m) => walletReady(s.payments[WALLET_SETTING_KEY[m]]))
    .map((m) => PAYMENT_METHOD_LABEL[m])
    .join(" or ");
  if (wallets) {
    return {
      order: `${browse} You can pay Cash on Delivery, or pay in advance with ${wallets}.`,
      methods: `${cod}, and ${wallets}: send the amount to our account at checkout and enter the Transaction ID (TID). We confirm your order once the payment is verified.`,
    };
  }
  return {
    order: `${browse} You pay Cash on Delivery — no advance needed.`,
    methods: `${cod}. Online payment options will appear at checkout when available.`,
  };
}

const faqs = (DELIVERY_TIME: string, pay: { order: string; methods: string }) => [
  {
    q: "How do I place an order?",
    a: pay.order,
  },
  {
    q: "What payment methods do you accept?",
    a: pay.methods,
  },
  {
    q: "How long does delivery take?",
    a: `Orders are typically delivered within ${DELIVERY_TIME} nationwide. Our team may call to confirm delivery details.`,
  },
  {
    q: "Can I track my order?",
    a: "Yes — use the Order Status page and enter your order number and email to see the latest status.",
  },
  {
    q: "What is your returns policy?",
    a: "Unworn items in original condition can be returned within 7 days of delivery. Custom pieces are non-returnable unless faulty. See Shipping & Returns for details.",
  },
  {
    q: "Do you make custom jewelry?",
    a: "Yes. Visit the Custom page to start a custom design — tell us your idea and we'll create it in stainless steel.",
  },
  {
    q: "What is your jewelry made of?",
    a: "Premium stainless steel — many pieces gold-plated or rose-gold plated. It is rust-free, hypoallergenic (skin-friendly) and won't tarnish or fade with everyday wear. Material details are listed on each product page.",
  },
];

export default async function FaqPage() {
  const settings = await getStoreSettings();
  const FAQS = faqs(settings.shipping.deliveryTime, paymentAnswers(settings));
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <div className="text-center">
        <Emblem size={40} className="mx-auto text-gold-deep" />
        <span className="eyebrow mt-3 block">Help</span>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">
          Frequently Asked Questions
        </h1>
      </div>

      <div className="mt-12 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {FAQS.map((item) => (
          <AccordionItem
            key={item.q}
            title={item.q}
            group="faq"
            className="py-4"
            summaryClassName="font-serif text-lg text-ink"
            icon={
              <span
                aria-hidden="true"
                className="shrink-0 text-xl leading-none text-gold-deep transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=open]:rotate-45"
              >
                +
              </span>
            }
          >
            <p className="pt-3 text-sm leading-relaxed text-ink/80">{item.a}</p>
          </AccordionItem>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        Still have a question?{" "}
        <Link href="/contact" className="text-gold-deep hover:underline">
          Contact us
        </Link>
        .
      </p>
    </div>
  );
}
