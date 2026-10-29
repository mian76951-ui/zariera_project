import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { DbBanner } from "@/components/admin/db-banner";
import { toggleMessageHandled } from "./actions";
import { splitReferencePhotos } from "@/lib/custom-request";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Messages" };

export const dynamic = "force-dynamic";

async function load() {
  try {
    const [messages, subscribers, subscriberCount] = await Promise.all([
      prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.subscriber.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.subscriber.count(),
    ]);
    return { dbConnected: true, messages, subscribers, subscriberCount };
  } catch {
    return { dbConnected: false, messages: [], subscribers: [], subscriberCount: 0 };
  }
}

// Custom-design requests may end with reference photos — show them as thumbnails.
function MessageBody({ message }: { message: string }) {
  const { text, photos } = splitReferencePhotos(message);
  return (
    <>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink/85">{text}</p>
      {photos.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-gold-deep">
            Reference photos ({photos.length}) — click to open full size
          </p>
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-24 w-24 overflow-hidden rounded-lg border border-[var(--line-strong)] transition hover:border-gold"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- customer upload, any size */}
                <img src={src} alt={`Reference photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default async function AdminMessagesPage() {
  await requireAdmin();
  const { dbConnected, messages, subscribers, subscriberCount } = await load();
  const open = messages.filter((m) => !m.handled).length;

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-ink">Messages</h1>
      <p className="mt-1 text-sm text-muted">
        Contact-form messages ({open} open) and newsletter / “notify me” sign-ups.
      </p>

      <div className="mt-6 space-y-8">
        {!dbConnected && <DbBanner />}

        <section className="rounded-2xl border border-[var(--line)] bg-surface shadow-[0_10px_30px_-22px_rgba(38,8,16,0.4)]">
          <h2 className="border-b border-[var(--line)] px-5 py-4 font-serif text-xl font-semibold text-ink">Inbox</h2>
          {messages.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted">No messages yet.</p>
          ) : (
            <ul>
              {messages.map((m) => (
                <li key={m.id} className={`border-b border-[var(--line)] px-5 py-4 last:border-0 ${m.handled ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {m.subject || "Message"}{" "}
                        {m.topic && (
                          <span className="ml-1 rounded-full bg-gold/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-gold-deep">
                            {m.topic}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        {m.name} ·{" "}
                        <a href={`mailto:${m.email}`} className="hover:text-gold-deep">
                          {m.email}
                        </a>
                        {m.phone ? ` · ${m.phone}` : ""} · {formatDate(m.createdAt, { time: true })}
                      </p>
                    </div>
                    <form action={toggleMessageHandled.bind(null, m.id, !m.handled)}>
                      <button className="rounded-md border border-[var(--line-strong)] px-3 py-1.5 text-xs text-ink transition hover:border-gold hover:text-gold-deep">
                        {m.handled ? "Reopen" : "Mark handled"}
                      </button>
                    </form>
                  </div>
                  <MessageBody message={m.message} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-surface shadow-[0_10px_30px_-22px_rgba(38,8,16,0.4)]">
          <h2 className="border-b border-[var(--line)] px-5 py-4 font-serif text-xl font-semibold text-ink">
            Subscribers <span className="text-sm font-normal text-muted">({subscriberCount})</span>
          </h2>
          {subscribers.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted">No sign-ups yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-[0.68rem] uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-5 py-2.5 text-ink">{s.email}</td>
                      <td className="px-5 py-2.5 text-muted">{s.source ?? "—"}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-muted">{formatDate(s.createdAt, { time: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
