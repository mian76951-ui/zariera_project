"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { slugify } from "@/lib/slug";
import { refreshStorefront } from "@/lib/cache-tags";
import { dbErrorKind } from "@/lib/db-errors";

export type ProductFormState = { error?: string; values?: Record<string, string> };

// Echoed back on errors: React 19 resets the form after the action, so without
// this the admin would lose everything they typed.
const FIELDS = ["name", "slug", "description", "price", "compareAtPrice", "stock", "sku", "material", "specs", "categoryId", "featured", "active"];
function keep(fd: FormData): Record<string, string> {
  return Object.fromEntries(FIELDS.map((k) => [k, String(fd.get(k) ?? "")]));
}

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative("Price must be 0 or more"),
  compareAtPrice: z.coerce.number().nonnegative().optional(),
  sku: z.string().optional(),
  stock: z.coerce.number().int().min(0),
  material: z.string().optional(),
  specs: z.string().optional(),
  categoryId: z.string().min(1, "Choose a category"),
  images: z.string().optional(),
  featured: z.boolean(),
  active: z.boolean(),
}).refine((d) => !d.active || (d.images ?? "").split(/[\n,]/).some((u) => u.trim()), {
  // A live piece without a photo shows as a blank tile in the shop.
  message: "Add at least one photo — or untick “Active” to save it as a hidden draft.",
  path: ["images"],
});

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    price: formData.get("price"),
    compareAtPrice: formData.get("compareAtPrice") || undefined,
    sku: formData.get("sku"),
    stock: formData.get("stock"),
    material: formData.get("material"),
    specs: formData.get("specs"),
    categoryId: formData.get("categoryId"),
    images: formData.get("images"),
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  });
}

function toData(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    slug: d.slug ? slugify(d.slug) : slugify(d.name),
    description: d.description || null,
    price: d.price,
    compareAtPrice: d.compareAtPrice ?? null,
    sku: d.sku || null,
    stock: d.stock,
    material: d.material || null,
    specs: d.specs?.trim() || null,
    categoryId: d.categoryId,
    images: (d.images ?? "")
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    featured: d.featured,
    active: d.active,
  };
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: keep(formData) };

  try {
    await prisma.product.create({ data: toData(parsed.data) });
  } catch (err) {
    return { error: dbError(err), values: keep(formData) };
  }
  refreshStorefront();
  redirect("/admin/products?flash=product-created");
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: keep(formData) };

  try {
    await prisma.product.update({ where: { id }, data: toData(parsed.data) });
  } catch (err) {
    return { error: dbError(err), values: keep(formData) };
  }
  refreshStorefront();
  redirect("/admin/products?flash=product-updated");
}

export async function deleteProduct(id: string): Promise<void> {
  await requireAdmin();
  let flash = "product-deleted";
  try {
    await prisma.product.delete({ where: { id } });
  } catch (err) {
    // In use = the product appears in past orders (kept for history).
    flash = dbErrorKind(err) === "in-use" ? "product-in-use" : "delete-failed";
  }
  refreshStorefront();
  redirect(`/admin/products?flash=${flash}`);
}

function dbError(err: unknown): string {
  const kind = dbErrorKind(err);
  if (kind === "unavailable") return "Database not connected. Connect DATABASE_URL to save products.";
  if (kind === "duplicate") return "A product with that slug or SKU already exists.";
  return "Could not save the product. Please try again.";
}
