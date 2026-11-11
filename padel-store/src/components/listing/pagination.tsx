import Link from "next/link";

export function Pagination({ page, pageCount, basePath, params }: { page: number; pageCount: number; basePath: string; params: Record<string, string | string[] | undefined> }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    return `${basePath}${sp.size ? `?${sp}` : ""}`;
  };
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn-outline btn-sm" rel="prev">
          Previous
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - pages[i - 1]! > 1 && <span className="px-1 text-muted">…</span>}
          <Link href={href(p)} aria-current={p === page ? "page" : undefined} className={`grid size-9 place-items-center rounded-lg text-sm font-semibold ${p === page ? "bg-brand-900 text-white" : "hover:bg-canvas"}`}>
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link href={href(page + 1)} className="btn-outline btn-sm" rel="next">
          Next
        </Link>
      )}
    </nav>
  );
}
