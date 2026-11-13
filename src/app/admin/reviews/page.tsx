import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { moderateReview } from "@/app/actions/admin-misc";
import { FilterTabs, PageHeader } from "@/components/admin/ui";
import { Stars } from "@/components/ui/stars";
import type { ReviewStatus } from "@prisma/client";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status: ReviewStatus = sp.status === "APPROVED" || sp.status === "REJECTED" ? sp.status : "PENDING";
  const reviews = await db.review.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 100, include: { product: { select: { name: true, slug: true } } } });
  return (
    <div>
      <PageHeader title="Reviews" description="New reviews are held for moderation before appearing on the site." />
      <FilterTabs current={status} items={(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => ({ key: s, label: s.toLowerCase(), href: `/admin/reviews?status=${s}` }))} />
      {reviews.length === 0 && <p className="card p-6 text-sm text-muted">Nothing here.</p>}
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Stars rating={r.rating} /> <strong>{r.title}</strong>
              <span className="text-xs text-muted">on <Link href={`/products/${r.product.slug}`} className="underline">{r.product.name}</Link> · {r.authorName} · {formatDate(r.createdAt)} {r.verified && "· verified buyer"}</span>
            </div>
            <p className="mt-2 text-sm">{r.body}</p>
            <div className="mt-3 flex gap-2">
              {r.status !== "APPROVED" && <form action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="APPROVED" /><button className="btn-primary btn-sm">Approve</button></form>}
              {r.status !== "REJECTED" && <form action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="REJECTED" /><button className="btn-outline btn-sm">Reject</button></form>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
