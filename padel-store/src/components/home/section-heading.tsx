import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({ title, href, linkLabel = "View all", eyebrow, id }: { title: string; href?: string; linkLabel?: string; eyebrow?: string; id?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold tracking-widest text-brand-600 uppercase">{eyebrow}</p>}
        <h2 id={id} className="text-2xl font-extrabold sm:text-3xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          {linkLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
