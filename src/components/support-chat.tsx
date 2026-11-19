"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { type StoreSettings, whatsappUrl } from "@/lib/settings-shared";


const LINK_RE = /(https?:\/\/[^\s)]+|(?<![\w/])\/(?:product|shop|account|custom|contact|shipping|care|faq|about|cart|checkout|search|login|register)[a-z0-9\-/?=&%.]*)/gi;

function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const raw = m[0].replace(/[.,;:!?]+$/, "");
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const cls = "font-medium text-gold-deep underline underline-offset-2 break-all hover:text-gold";
    out.push(
      raw.startsWith("/") ? (
        <Link key={start} href={raw} className={cls}>
          {raw}
        </Link>
      ) : (
        <a key={start} href={raw} target="_blank" rel="noopener noreferrer" className={cls}>
          {raw.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      )
    );
    last = start + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const STORAGE_KEY = "zariera-chat-v1";

type Faq = { id: string; label: string; answer: string; keywords: string[] };

function buildFaqs(st: StoreSettings): Faq[] {
  const { deliveryTime, flatFee, freeThreshold } = st.shipping;
  return [
  {
    id: "shipping",
    label: "🚚 Shipping & delivery",
    keywords: ["shipping", "delivery", "courier", "days", "how long", "kitne din", "kab aayega", "leopard", "tcs"],
    answer: `We deliver across Pakistan. Orders arrive in ${deliveryTime} via Leopards / TCS. Shipping is a flat ${formatPrice(
      flatFee
    )} — and FREE on orders over ${formatPrice(freeThreshold)}.`,
  },
  {
    id: "payment",
    label: "💵 Payment & COD",
    keywords: ["payment", "cod", "cash on delivery", "cash", "card", "pay", "online", "paisa", "advance"],
    answer:
      "You can pay with Cash on Delivery (COD) nationwide — no advance needed. Any online options (card, Easypaisa, JazzCash) that are available are shown at checkout.",
  },
  {
    id: "returns",
    label: "🔄 Returns & exchange",
    keywords: ["return", "exchange", "refund", "wapas", "change", "size change"],
    answer:
      "Not happy or need a different size? We offer easy 7-day exchange/return on unused items in original packaging. Message us and we'll arrange it.",
  },
  {
    id: "sizing",
    label: "📏 Sizing & fit",
    keywords: ["size", "sizing", "fit", "ring size", "length", "adjustable", "chota", "bara"],
    answer:
      "Sizes are listed on each product page, and many rings/bracelets are adjustable. Unsure of your size? Tell us your usual size on WhatsApp and we'll guide you.",
  },
  {
    id: "material",
    label: "✨ Material & care",
    keywords: ["material", "gold", "steel", "rust", "care", "tarnish", "allergy", "hypoallergenic", "kaali"],
    answer:
      "Our pieces are premium stainless steel — rust-free and hypoallergenic, with gold- or silver-tone finishes (see each product's material). Tip: wear after perfume, keep dry, and wipe with a soft cloth to keep the shine.",
  },
  {
    id: "track",
    label: "📦 Track my order",
    keywords: ["track", "tracking", "order status", "where", "kahan", "status", "parcel"],
    answer:
      "Track any order on our Order Status page (Help → Order Status) with your order number and email. Once shipped, it shows your courier tracking link.",
  },
];
}

type Msg = { from: "bot" | "user"; text: string };



export function SupportChat({ settings }: { settings: StoreSettings }) {
  const FAQS = buildFaqs(settings);
  const WA = whatsappUrl(settings);
  const HAS_WHATSAPP = Boolean(WA);
  const waLink = (text: string) => `${WA}?text=${encodeURIComponent(text)}`;
  const CONTACT = settings.contact;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const greeting: Msg = {
    from: "bot",
    text: "Hi! 👋 I'm the ZARIERA assistant. Ask me anything — products, prices, delivery, payment, returns or your order. You can write in English or Urdu.",
  };
  const [msgs, setMsgs] = useState<Msg[]>([greeting]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  // Keep the conversation while the shopper browses (this tab only): restored
  // the first time the chat is opened, saved on every change after that.
  const toggleOpen = () => {
    if (!open && !restored.current) {
      restored.current = true;
      try {
        const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
        if (Array.isArray(saved) && saved.length) setMsgs(saved as Msg[]);
      } catch {
        /* ignore */
      }
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* ignore */
    }
  }, [msgs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open, typing]);

  const answer = (faq: Faq) => {
    setMsgs((m) => [
      ...m,
      { from: "user", text: faq.label.replace(/^[^\w]+\s*/, "") },
      { from: "bot", text: faq.answer },
    ]);
  };

  const localAnswer = (q: string): string => {
    const lower = q.toLowerCase();
    let hit: Faq | undefined;
    let bestScore = 0;
    for (const f of FAQS) {
      const score = f.keywords.reduce((n, k) => (lower.includes(k) ? n + 1 : n), 0);
      if (score > bestScore) {
        bestScore = score;
        hit = f;
      }
    }
    return (
      hit?.answer ??
      (HAS_WHATSAPP
        ? "I couldn't reach the assistant just now. Our team will help you personally on WhatsApp — tap the green button below. 💬"
        : "I couldn't reach the assistant just now. Please send us a message from our Contact page and our team will get back to you. 💬")
    );
  };

  const send = async () => {
    const q = input.trim().slice(0, 600);
    if (!q || typing) return;
    setInput("");
    const next: Msg[] = [...msgs, { from: "user", text: q }];
    setMsgs(next);
    setTyping(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-12).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string };
      setMsgs((m) => [...m, { from: "bot", text: data.reply || localAnswer(q) }]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: localAnswer(q) }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* ── Launcher ── */}
      <div className="group/launch fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[70] flex items-center gap-3 sm:bottom-5 sm:right-5">
        {/* hover label (desktop) */}
        {!open && (
          <span className="pointer-events-none hidden translate-x-2 items-center rounded-full border border-[var(--line)] bg-surface px-3.5 py-2 text-sm font-medium text-ink opacity-0 shadow-[0_10px_30px_-12px_rgba(38,8,16,0.4)] transition-all duration-300 group-hover/launch:translate-x-0 group-hover/launch:opacity-100 md:flex">
            Need help? Chat with us
          </span>
        )}
        <button
          onClick={toggleOpen}
          aria-label={open ? "Close chat" : "Chat with us"}
          className={`relative flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14 bg-gradient-to-br from-gold-hi via-gold to-gold-deep text-maroon shadow-[0_16px_40px_-12px_rgba(169,126,48,0.75)] ring-1 ring-[rgba(230,205,139,0.6)] transition-transform duration-300 hover:scale-110 active:scale-95 ${
            open ? "" : "animate-chatpulse"
          }`}
        >
          {open ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="transition-transform duration-300 group-hover/launch:-rotate-6"
            >
              <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Panel ── */}
      {open && (
        <div className="animate-chatin fixed bottom-20 right-4 z-[70] sm:bottom-24 sm:right-5 flex h-[32rem] max-h-[calc(100dvh-7.5rem)] w-[23rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-[rgba(230,205,139,0.35)] bg-surface shadow-[0_40px_90px_-30px_rgba(38,8,16,0.7)]">
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-maroon via-maroon-2 to-wine-deep px-5 pb-5 pt-4 text-light">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{ background: "radial-gradient(120px 80px at 85% 0%, #e6cd8b, transparent 70%)" }}
            />
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(230,205,139,0.16)] text-gold ring-1 ring-[rgba(230,205,139,0.4)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg font-semibold leading-tight">ZARIERA Support</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-light/75">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  Instant answers 24/7 · team replies {CONTACT.hours}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-light/80 transition hover:bg-white/10 hover:text-gold"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          {/* gold hairline */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold to-transparent" />

          {/* Messages (scrolls independently — page stays put) */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-cream-soft px-4 py-4"
          >
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                {m.from === "bot" && (
                  <span className="mr-2 mt-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-maroon to-wine-deep text-[0.6rem] text-gold">
                    Z
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_6px_18px_-10px_rgba(38,8,16,0.35)] ${
                    m.from === "user"
                      ? "rounded-br-md bg-gradient-to-br from-gold-hi to-gold text-maroon"
                      : "rounded-bl-md border border-[var(--line)] bg-surface text-ink"
                  }`}
                >
                  {m.from === "bot" ? (
                    <span className="whitespace-pre-line">
                      {linkify(m.text).map((part, j) => (
                        <Fragment key={j}>{part}</Fragment>
                      ))}
                    </span>
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start" aria-live="polite">
                <span className="mr-2 mt-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-maroon to-wine-deep text-[0.6rem] text-gold">
                  Z
                </span>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[var(--line)] bg-surface px-3.5 py-3">
                  <span className="sr-only">Assistant is typing</span>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-deep"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick replies */}
            <div className="pt-1.5">
              <p className="mb-2 pl-1 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted">
                Popular questions
              </p>
              <div className="flex flex-wrap gap-2">
                {FAQS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => answer(f)}
                    className="rounded-full border border-[var(--line-strong)] bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:text-gold-deep hover:shadow-[0_8px_20px_-10px_rgba(169,126,48,0.6)]"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* WhatsApp CTA (or contact page when no number is configured) */}
          <a
            href={HAS_WHATSAPP ? waLink("Hi ZARIERA! I have a question 😊") : "/contact"}
            target={HAS_WHATSAPP ? "_blank" : undefined}
            rel={HAS_WHATSAPP ? "noopener noreferrer" : undefined}
            className="flex items-center justify-center gap-2 bg-[#25D366] py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm5.9 14.2c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.1.2-3.5-.8-2.9-1.2-4.8-4.2-4.9-4.4-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.3.1.7-.1 1.4z" />
            </svg>
            {HAS_WHATSAPP ? "Chat with us on WhatsApp" : "Contact our team"}
          </a>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-[var(--line)] bg-surface px-3 py-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything… (English / اردو)"
              maxLength={600}
              className="min-w-0 flex-1 rounded-full border border-[var(--line-strong)] bg-cream-soft px-4 py-2.5 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-[rgba(195,154,78,0.22)]"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim() || typing}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-hi to-gold-deep text-maroon shadow-sm transition hover:opacity-90 disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
