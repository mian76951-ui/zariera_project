"use client";

import { useActionState, useEffect } from "react";
import type { StatusState } from "@/app/admin/(dashboard)/orders/actions";
import { useToast } from "@/components/ui/toast";
import { statusLabel } from "@/lib/order-status";

type Action = (prev: StatusState, formData: FormData) => Promise<StatusState>;

const select =
  "w-full rounded-md border border-[var(--line-strong)] bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-gold";
const saveBtn =
  "rounded-md bg-maroon px-4 py-2 text-sm font-medium text-light transition hover:bg-maroon-2 disabled:opacity-60";

/** Toast "Saved" when a server action succeeds, or its error when it fails. */
export function useToastOn(state: StatusState, success: string) {
  const toast = useToast();
  useEffect(() => {
    if (state.ok) toast.success(success, { title: "Saved" });
    else if (state.error) toast.error(state.error);
  }, [state, toast, success]);
}

export const primaryBtn =
  "w-full rounded-lg bg-maroon px-4 py-2.5 text-sm font-medium text-light transition hover:bg-maroon-2 disabled:opacity-60";

// Small client wrapper so status/payment updates give a toast on save.
export function StatusUpdateForm({
  action,
  name,
  defaultValue,
  options,
  successMessage,
}: {
  action: Action;
  name: string;
  defaultValue: string;
  options: readonly string[];
  successMessage: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  useToastOn(state, successMessage);

  return (
    <form action={formAction} className="flex gap-2">
      <select key={defaultValue} name={name} defaultValue={defaultValue} className={select} disabled={options.length <= 1}>
        {options.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>
      <button disabled={pending || options.length <= 1} className={saveBtn} title={options.length <= 1 ? "This status is final" : undefined}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
