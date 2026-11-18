"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import type { StoreSettings } from "@/lib/settings-shared";
import {
  saveContactSettings,
  saveSocialSettings,
  saveShippingSettings,
  savePaymentSettings,
  saveAnnouncementSettings,
  saveAlertSettings,
  changePassword,
  addTeamMember,
  type SettingsState,
} from "@/app/admin/(dashboard)/settings/actions";

type Action = (prev: SettingsState, fd: FormData) => Promise<SettingsState>;

const input =
  "w-full rounded-lg border border-[var(--line-strong)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-[rgba(195,154,78,0.2)] disabled:opacity-60";
const labelCls = "mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-muted";
const saveBtn =
  "rounded-lg bg-maroon px-5 py-2.5 text-sm font-medium text-light transition hover:bg-maroon-2 disabled:opacity-60";

/** One settings card: a form wired to a server action with toast feedback. */
function Card({
  id,
  title,
  description,
  action,
  success,
  disabled,
  resetOnSuccess,
  children,
}: {
  id: string;
  title: string;
  description: string;
  action: Action;
  success: string;
  disabled?: boolean;
  resetOnSuccess?: boolean;
  children: (state: SettingsState) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success(success, { title: "Saved" });
      if (resetOnSuccess) formRef.current?.reset();
    } else if (state.error) toast.error(state.error);
  }, [state, toast, success, resetOnSuccess]);

  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-surface p-5 shadow-[0_10px_30px_-22px_rgba(38,8,16,0.4)] sm:p-6">
      <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <fieldset disabled={disabled || pending} className="space-y-4">
          {children(state)}
        </fieldset>
        {state.error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {!disabled && (
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className={saveBtn}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function Field({
  name,
  label,
  hint,
  defaultValue,
  type = "text",
  placeholder,
  required,
  autoComplete,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | number;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const id = `set-${name}`;
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={input}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StoreSettingsForms({ settings, canEdit }: { settings: StoreSettings; canEdit: boolean }) {
  const v = (state: SettingsState, key: string, fallback: string | number) => state.values?.[key] ?? fallback;
  const lock = !canEdit;

  return (
    <>
      <Card
        id="contact"
        title="Store contact"
        description="Shown in the footer, contact page and support chat. Leave a field empty to hide it."
        action={saveContactSettings}
        success="Contact details updated"
        disabled={lock}
      >
        {(s) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="email" label="Email" type="email" defaultValue={v(s, "email", settings.contact.email)} placeholder="hello@zariera.com" />
            <Field name="phone" label="Phone" defaultValue={v(s, "phone", settings.contact.phone)} placeholder="+92 300 1234567" />
            <Field
              name="whatsapp"
              label="WhatsApp number"
              defaultValue={v(s, "whatsapp", settings.contact.whatsapp)}
              placeholder="923001234567"
              hint="International format, digits only. Enables the WhatsApp icon + chat button."
            />
            <Field name="city" label="City / address" defaultValue={v(s, "city", settings.contact.city)} placeholder="Lahore, Pakistan" />
            <div className="sm:col-span-2">
              <Field name="hours" label="Opening hours" defaultValue={v(s, "hours", settings.contact.hours)} placeholder="Mon–Sat, 11am – 8pm" />
            </div>
          </div>
        )}
      </Card>

      <Card
        id="social"
        title="Social links"
        description="Footer icons and the home-page “Follow us” button. Use the full https:// link; empty = hidden."
        action={saveSocialSettings}
        success="Social links updated"
        disabled={lock}
      >
        {(s) => (
          <div className="grid gap-4">
            <Field name="instagram" label="Instagram" defaultValue={v(s, "instagram", settings.social.instagram)} placeholder="https://www.instagram.com/…" />
            <Field name="facebook" label="Facebook" defaultValue={v(s, "facebook", settings.social.facebook)} placeholder="https://www.facebook.com/…" />
            <Field name="tiktok" label="TikTok" defaultValue={v(s, "tiktok", settings.social.tiktok)} placeholder="https://www.tiktok.com/@…" />
          </div>
        )}
      </Card>

      <Card
        id="shipping"
        title="Shipping & delivery"
        description="Used at checkout (the order total is calculated with these) and on the shipping, FAQ and product pages."
        action={saveShippingSettings}
        success="Shipping settings updated"
        disabled={lock}
      >
        {(s) => (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="flatFee" label="Shipping fee (Rs)" type="number" defaultValue={v(s, "flatFee", settings.shipping.flatFee)} required />
            <Field
              name="freeThreshold"
              label="Free shipping over (Rs)"
              type="number"
              defaultValue={v(s, "freeThreshold", settings.shipping.freeThreshold)}
              required
              hint="Set 0 for free shipping on every order."
            />
            <Field name="deliveryTime" label="Delivery time" defaultValue={v(s, "deliveryTime", settings.shipping.deliveryTime)} required />
          </div>
        )}
      </Card>

      <Card
        id="payments"
        title="Easypaisa & JazzCash"
        description="Shoppers send the order amount to this account and type the Transaction ID (TID) at checkout. Check the TID in your wallet app, then mark the order Paid. A method shows at checkout only when it is switched on."
        action={savePaymentSettings}
        success="Payment methods updated"
        disabled={lock}
      >
        {(s) => (
          <div className="grid gap-5 sm:grid-cols-2">
            {(["easypaisa", "jazzcash"] as const).map((key) => {
              const w = settings.payments[key];
              const enabled = s.values ? s.values[`${key}Enabled`] === "on" : w.enabled;
              return (
                <div key={key} className="space-y-3 rounded-xl border border-[var(--line)] p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="font-medium text-ink">{key === "easypaisa" ? "Easypaisa" : "JazzCash"}</span>
                    <span className="flex items-center gap-2 text-sm text-muted">
                      Show at checkout
                      <input
                        type="checkbox"
                        name={`${key}Enabled`}
                        defaultChecked={enabled}
                        className="h-4 w-4 accent-[var(--color-gold-deep)]"
                      />
                    </span>
                  </label>
                  <Field
                    name={`${key}Title`}
                    label="Account title"
                    defaultValue={v(s, `${key}Title`, w.accountTitle)}
                    placeholder="ZARIERA / owner's name"
                  />
                  <Field
                    name={`${key}Number`}
                    label="Mobile account number"
                    defaultValue={v(s, `${key}Number`, w.number)}
                    placeholder="03001234567"
                    hint="11 digits, starting with 03."
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        id="announcements"
        title="Announcement bar"
        description="The scrolling strip at the top of the store. One message per line (max 10). {freeThreshold} and {flatFee} insert the current amounts. Empty = bar hidden."
        action={saveAnnouncementSettings}
        success="Announcement bar updated"
        disabled={lock}
      >
        {(s) => (
          <div>
            <label htmlFor="set-announcements" className={labelCls}>
              Messages
            </label>
            <textarea
              id="set-announcements"
              name="announcements"
              rows={6}
              defaultValue={v(s, "announcements", settings.announcements.join("\n")) as string}
              className={input}
            />
          </div>
        )}
      </Card>

      <Card
        id="alerts"
        title="Inventory & notifications"
        description="When products count as “low stock”, and where new-order / contact-form emails go (needs SMTP)."
        action={saveAlertSettings}
        success="Alert settings updated"
        disabled={lock}
      >
        {(s) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="lowStockThreshold"
              label="Low-stock alert at"
              type="number"
              defaultValue={v(s, "lowStockThreshold", settings.inventory.lowStockThreshold)}
              hint="Products with this many or fewer left are flagged."
              required
            />
            <Field
              name="orderEmail"
              label="Send order alerts to"
              type="email"
              defaultValue={v(s, "orderEmail", settings.notifications.orderEmail)}
              placeholder="owner@example.com"
            />
          </div>
        )}
      </Card>
    </>
  );
}

export function PasswordForm() {
  return (
    <Card
      id="account"
      title="My account"
      description="Change the password you use to sign in to this dashboard."
      action={changePassword}
      success="Password changed"
      resetOnSuccess
    >
      {() => (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="current" label="Current password" type="password" required autoComplete="current-password" />
          <Field name="next" label="New password" type="password" required autoComplete="new-password" hint="At least 10 characters." />
          <Field name="confirm" label="Repeat new password" type="password" required autoComplete="new-password" />
        </div>
      )}
    </Card>
  );
}

export function AddTeamMemberForm() {
  return (
    <Card
      id="team-add"
      title="Add team member"
      description="Staff can manage orders, products and categories. Only admins can change settings and the team."
      action={addTeamMember}
      success="Team member added"
      resetOnSuccess
    >
      {(s) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Name" defaultValue={s.ok ? "" : s.values?.name} />
          <Field name="email" label="Email" type="email" required defaultValue={s.ok ? "" : s.values?.email} />
          <Field name="password" label="Temporary password" type="password" required autoComplete="new-password" hint="At least 10 characters — they can change it in My account." />
          <div>
            <label htmlFor="set-role" className={labelCls}>
              Role
            </label>
            <select key={s.ok ? "reset" : s.values?.role ?? "STAFF"} id="set-role" name="role" defaultValue={s.ok ? "STAFF" : s.values?.role ?? "STAFF"} className={input}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
      )}
    </Card>
  );
}
