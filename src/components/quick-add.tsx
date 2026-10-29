"use client";

import { useState } from "react";
import { useCart } from "./cart/cart-provider";
import { useToast } from "@/components/ui/toast";
import type { ProductView } from "@/lib/types";
import { toCartLine } from "@/lib/cart";

// Compact "Add to cart" button used on product cards.
export function QuickAdd({ product }: { product: ProductView }) {
  const { add } = useCart();
  const toast = useToast();
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;

  if (soldOut) {
    return (
      <span className="mt-3 block w-full cursor-not-allowed rounded-full border border-[var(--line)] py-2 text-center text-xs uppercase tracking-[0.12em] text-muted">
        Sold out
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        add(toCartLine(product), 1);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
        toast.success(`${product.name} added to your cart`, { title: "Added to cart" });
      }}
      className="mt-3 block w-full rounded-full border border-maroon bg-transparent py-2 text-center text-xs font-medium uppercase tracking-[0.12em] text-maroon transition hover:bg-maroon hover:text-light dark:border-gold-deep/50 dark:text-gold-deep"
    >
      {added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
