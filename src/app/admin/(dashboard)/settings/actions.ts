"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, refreshAdminSession } from "@/lib/admin";
import { hashPassword, verifyPassword } from "@/lib/password";
import { saveStoreSettings, type StoreSettings } from "@/lib/settings";
import { dbErrorKind } from "@/lib/db-errors";

export type SettingsState = { ok?: boolean; error?: string; values?: Record<string, string> };

const ADMIN_MIN_PASSWORD = 10;

// Store-wide settings may only be changed by an ADMIN (not STAFF).
async function requireOwner() {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") throw new Error("Only an admin can change store settings.");
  return session;
}

function form(fd: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "").trim()]));
}

async function save<K extends keyof StoreSettings>(section: K, value: StoreSettings[K]): Promise<SettingsState> {
  try {
    await saveStoreSettings(section, value);
  } catch (err) {
    console.error("[settings] save failed:", err);
    return { error: "Could not save — database unavailable." };
  }
  // Header, footer, chat, shipping and every page read these settings.
  revalidatePath("/", "layout");
  return { ok: true };
}

const url = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Links must start with https://");

// ---------- Contact ----------
export async function saveContactSettings(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    await requireOwner();
  } catch (e) {
    unstable_rethrow(e); // a signed-out redirect must reach the browser
    return { error: (e as Error).message };
  }
  const values = form(fd, ["email", "phone", "whatsapp", "city", "hours"]);
  const parsed = z
    .object({
      email: z.string().refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email"),
      phone: z.string().max(30),
      whatsapp: z
        .string()
        .transform((v) => v.replace(/[^0-9]/g, ""))
        .refine((v) => v === "" || (v.length >= 10 && v.length <= 15), "WhatsApp: international format, e.g. 923001234567"),
      city: z.string().max(120),
      hours: z.string().max(120),
    })
    .safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  return { ...(await save("contact", parsed.data)), values };
}

// ---------- Social ----------
export async function saveSocialSettings(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    await requireOwner();
  } catch (e) {
    unstable_rethrow(e); // a signed-out redirect must reach the browser
    return { error: (e as Error).message };
  }
  const values = form(fd, ["instagram", "facebook", "tiktok"]);
  const parsed = z.object({ instagram: url, facebook: url, tiktok: url }).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  return { ...(await save("social", parsed.data)), values };
}

// ---------- Shipping ----------
export async function saveShippingSettings(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    await requireOwner();
  } catch (e) {
    unstable_rethrow(e); // a signed-out redirect must reach the browser
    return { error: (e as Error).message };
  }
  const values = form(fd, ["flatFee", "freeThreshold", "deliveryTime"]);
  const parsed = z
    .object({
      flatFee: z.coerce.number().int("Whole rupees only").min(0, "Can't be negative").max(100000),
      freeThreshold: z.coerce.number().int("Whole rupees only").min(0, "Can't be negative").max(10_000_000),
      deliveryTime: z.string().min(2, "Enter the delivery time, e.g. 3–5 working days").max(60),
    })
    .safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  return { ...(await save("shipping", parsed.data)), values };
}

// ---------- Announcement bar ----------
export async function saveAnnouncementSettings(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    await requireOwner();
  } catch (e) {
    unstable_rethrow(e); // a signed-out redirect must reach the browser
    return { error: (e as Error).message };
  }
  const raw = String(fd.get("announcements") ?? "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 10) return { error: "Keep it to 10 lines or fewer.", values: { announcements: raw } };
  if (lines.some((l) => l.length > 120)) return { error: "Each line must be 120 characters or fewer.", values: { announcements: raw } };
  return { ...(await save("announcements", lines)), values: { announcements: raw } };
}

// ---------- Inventory + notifications ----------
export async function saveAlertSettings(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    await requireOwner();
  } catch (e) {
    unstable_rethrow(e); // a signed-out redirect must reach the browser
    return { error: (e as Error).message };
  }
  const values = form(fd, ["lowStockThreshold", "orderEmail"]);
  const parsed = z
    .object({
      lowStockThreshold: z.coerce.number().int().min(0).max(1000),
      orderEmail: z.string().refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email"),
    })
    .safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  const inv = await save("inventory", { lowStockThreshold: parsed.data.lowStockThreshold });
  if (inv.error) return { ...inv, values };
  return { ...(await save("notifications", { orderEmail: parsed.data.orderEmail })), values };
}

// ---------- My account: change password ----------
export async function changePassword(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const session = await requireAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (next.length < ADMIN_MIN_PASSWORD) return { error: `New password must be at least ${ADMIN_MIN_PASSWORD} characters.` };
  if (next !== confirm) return { error: "The new passwords don't match." };
  try {
    const user = await prisma.user.findUnique({ where: { email: session.email } });
    if (!user || !verifyPassword(current, user.passwordHash)) return { error: "Current password is incorrect." };
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
    await refreshAdminSession(session.email); // other devices are signed out
  } catch {
    return { error: "Could not update — database unavailable." };
  }
  return { ok: true };
}

// ---------- Team ----------
export async function addTeamMember(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    await requireOwner();
  } catch (e) {
    unstable_rethrow(e); // a signed-out redirect must reach the browser
    return { error: (e as Error).message };
  }
  const values = form(fd, ["name", "email", "role"]);
  const password = String(fd.get("password") ?? "");
  const parsed = z
    .object({
      name: z.string().max(120),
      email: z.string().email("Enter a valid email").max(200),
      role: z.enum(["ADMIN", "STAFF"]),
    })
    .safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  if (password.length < ADMIN_MIN_PASSWORD)
    return { error: `Password must be at least ${ADMIN_MIN_PASSWORD} characters.`, values };
  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name || null,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        passwordHash: hashPassword(password),
      },
    });
  } catch (err) {
    if (dbErrorKind(err) === "duplicate") return { error: "A team member with that email already exists.", values };
    return { error: "Could not add — database unavailable.", values };
  }
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function removeTeamMember(id: string): Promise<void> {
  const session = await requireOwner();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.email === session.email) return; // can't remove yourself
  if (user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return; // never remove the last admin
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/settings");
}
