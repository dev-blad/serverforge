"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSession } from "next-auth/react";
import { submitReview, type ActionState } from "@/app/actions/product";

export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const { status } = useSession();
  const [state, action, pending] = useActionState<ActionState, FormData>(submitReview, null);
  const [open, setOpen] = useState(false);
  if (status !== "authenticated")
    return (
      <p className="text-sm">
        <Link href={`/account/login?callbackUrl=/products/${slug}%23reviews`} className="font-semibold text-brand-700 underline">
          Sign in
        </Link>{" "}
        to write a review.
      </p>
    );
  if (state?.ok) return <p role="status" className="rounded-lg bg-brand-50 p-4 text-sm text-brand-800">{state.message}</p>;
  if (!open)
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        Write a review
      </button>
    );
  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="label">Your rating</legend>
        <div className="flex gap-3">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="flex items-center gap-1 text-sm">
              <input type="radio" name="rating" value={n} required defaultChecked={n === 5} className="accent-brand-900" /> {n}★
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="rv-title" className="label">Headline</label>
        <input id="rv-title" name="title" required minLength={3} maxLength={80} className="input" />
      </div>
      <div>
        <label htmlFor="rv-body" className="label">Review</label>
        <textarea id="rv-body" name="body" required minLength={10} maxLength={2000} rows={4} className="input" />
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-sale">{state.message}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
