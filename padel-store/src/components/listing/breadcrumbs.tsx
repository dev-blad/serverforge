import Link from "next/link";
import { absoluteUrl } from "@/lib/utils";

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  const all = [{ name: "Home", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.href ? absoluteUrl(c.href) : undefined })),
  };
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-1">
        {all.map((c, i) => (
          <li key={c.name} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {c.href && i < all.length - 1 ? (
              <Link href={c.href} className="inline-flex min-h-6 items-center hover:text-ink hover:underline">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
