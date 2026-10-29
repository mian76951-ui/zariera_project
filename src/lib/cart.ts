import type { CartItem } from "@/components/cart/cart-provider";
import type { ProductView } from "./types";

// Plain module (not "use client") so server pages and client buttons share it.
/** The cart line for a product — everything but the quantity. */
export function toCartLine(product: ProductView): Omit<CartItem, "quantity"> {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    image: product.images[0],
    material: product.material,
    stock: product.stock,
  };
}
