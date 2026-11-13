import Link from "next/link";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, actions, className = "" }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PlaceholderBadge() {
  return <span className="badge bg-amber-100 text-amber-900" title="Demo placeholder product — swap for real stock">Placeholder</span>;
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-2 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function FilterTabs({ items, current }: { items: { label: string; href: string; key: string; count?: number }[]; current: string }) {
  return (
    <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-1">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === current ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i.key === current ? "bg-brand-900 text-white" : "bg-white ring-1 ring-line hover:ring-brand-500"}`}>
          {i.label}
          {i.count !== undefined && <span className="ml-1 opacity-70">{i.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
