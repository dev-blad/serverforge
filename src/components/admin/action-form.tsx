"use client";

import { useActionState } from "react";
import type { AdminState } from "@/app/actions/admin-orders";

/** Small wrapper so any admin server action shows pending + result state. */
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "",
  buttonClass = "btn-outline btn-sm",
  confirm,
}: {
  action: (prev: AdminState, fd: FormData) => Promise<AdminState>;
  children?: React.ReactNode;
  submitLabel: string;
  className?: string;
  buttonClass?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <button className={buttonClass} disabled={pending}>{pending ? "Working…" : submitLabel}</button>
      {state && <p role="status" className={`mt-1 text-xs ${state.ok ? "text-brand-600" : "text-sale"}`}>{state.message}</p>}
    </form>
  );
}
