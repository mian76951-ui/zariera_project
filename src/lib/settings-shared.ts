// Store settings shape + pure helpers. Client-safe (no server imports) so the
// checkout form, footer, chat etc. can use the values passed down to them.

export type StoreSettings = {
  contact: {
    email: string;
    /** Display format, e.g. "+92 300 1234567" */
    phone: string;
    /** International digits only, e.g. "923001234567" */
    whatsapp: string;
    city: string;
    hours: string;
  };
  social: {
    instagram: string;
    facebook: string;
    tiktok: string;
  };
  shipping: {
    flatFee: number;
    freeThreshold: number;
    deliveryTime: string;
  };
  /** Lines shown in the scrolling announcement bar */
  announcements: string[];
  inventory: {
    lowStockThreshold: number;
  };
  notifications: {
    /** Where new-order / contact alerts go (falls back to ADMIN_NOTIFY_EMAIL / SMTP_USER) */
    orderEmail: string;
  };
};

export function whatsappUrl(s: StoreSettings): string {
  return s.contact.whatsapp ? `https://wa.me/${s.contact.whatsapp}` : "";
}

export function phoneHref(s: StoreSettings): string {
  return s.contact.phone ? `tel:${s.contact.phone.replace(/[^0-9+]/g, "")}` : "";
}

export function shippingFor(subtotal: number, s: StoreSettings["shipping"]): number {
  return subtotal >= s.freeThreshold ? 0 : s.flatFee;
}
