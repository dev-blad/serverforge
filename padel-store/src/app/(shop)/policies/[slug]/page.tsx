import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { POLICIES } from "@/content/policies";
import { Breadcrumbs } from "@/components/listing/breadcrumbs";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = POLICIES.find((x) => x.slug === slug);
  return p ? { title: p.title, description: p.description, alternates: { canonical: `/policies/${slug}` } } : {};
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const policy = POLICIES.find((p) => p.slug === slug);
  if (!policy) notFound();
  return (
    <div className="container-page grid gap-10 py-8 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Policies" className="order-last lg:order-first">
        <ul className="space-y-1 text-sm">
          {POLICIES.map((p) => (
            <li key={p.slug}>
              <Link href={`/policies/${p.slug}`} aria-current={p.slug === slug ? "page" : undefined} className={`block rounded-lg px-3 py-2 ${p.slug === slug ? "bg-brand-900 text-white" : "hover:bg-canvas"}`}>{p.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="max-w-3xl">
        <Breadcrumbs items={[{ name: policy.title }]} />
        <h1 className="mt-4 text-3xl font-extrabold">{policy.title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {policy.updated}</p>
        <div role="note" className="mt-5 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <p><strong>Template — needs professional review.</strong> This document is a starting point for a UK online retailer and must be checked by a qualified solicitor / data-protection adviser before the shop goes live. Highlighted items need your real details.</p>
        </div>
        <div className="prose-legal mt-6">{policy.body}</div>
      </article>
    </div>
  );
}
