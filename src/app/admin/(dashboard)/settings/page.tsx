import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { getStoreSettings } from "@/lib/settings";
import { DbBanner } from "@/components/admin/db-banner";
import { DeleteButton } from "@/components/admin/delete-button";
import { StoreSettingsForms, PasswordForm, AddTeamMemberForm } from "@/components/admin/settings-forms";
import { removeTeamMember } from "./actions";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "contact", label: "Contact" },
  { id: "social", label: "Social" },
  { id: "shipping", label: "Shipping" },
  { id: "payments", label: "Payments" },
  { id: "announcements", label: "Announcement bar" },
  { id: "alerts", label: "Alerts" },
  { id: "account", label: "My account" },
  { id: "team", label: "Team" },
];

async function loadTeam() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return { dbConnected: true, users };
  } catch {
    return { dbConnected: false, users: [] };
  }
}

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const [settings, team] = await Promise.all([getStoreSettings(), loadTeam()]);
  const isOwner = session.role === "ADMIN";
  const adminCount = team.users.filter((u) => u.role === "ADMIN").length;

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Store details, shipping, payments, the announcement bar, your password and your team. Changes go live on
        the store immediately.
      </p>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Settings sections">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-[var(--line-strong)] px-3.5 py-1.5 text-xs font-medium text-ink transition hover:border-gold hover:text-gold-deep"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-6">
        {!team.dbConnected && <DbBanner />}
        {!isOwner && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You&apos;re signed in as <strong>staff</strong> — store settings and the team can only be changed by an
            admin. You can still change your own password below.
          </p>
        )}

        <StoreSettingsForms settings={settings} canEdit={isOwner} />
        <PasswordForm />

        {/* Team */}
        <section
          id="team"
          className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-surface p-5 shadow-[0_10px_30px_-22px_rgba(38,8,16,0.4)] sm:p-6"
        >
          <h2 className="font-serif text-xl font-semibold text-ink">Team</h2>
          <p className="mt-1 text-sm text-muted">People who can sign in to this dashboard.</p>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {team.users.map((u) => {
              const isSelf = u.email === session.email;
              const lastAdmin = u.role === "ADMIN" && adminCount <= 1;
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {u.name || u.email}
                      {isSelf && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.role === "ADMIN" ? "bg-maroon text-gold" : "bg-cream-soft text-ink"
                      }`}
                    >
                      {u.role === "ADMIN" ? "Admin" : "Staff"}
                    </span>
                    {isOwner && !isSelf && !lastAdmin && (
                      <DeleteButton
                        action={removeTeamMember.bind(null, u.id)}
                        label="Remove"
                        confirmText={`Remove ${u.email} from the team? They will no longer be able to sign in.`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {isOwner && <AddTeamMemberForm />}
      </div>
    </div>
  );
}
