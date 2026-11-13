"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { useState, useTransition } from "react";

export interface Facet {
  key: string;
  label: string;
  options: { value: string; label: string; count: number }[];
}

function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    mut(p);
    p.delete("page");
    start(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };
  return { params, set, pending };
}

function FacetGroups({ facets }: { facets: Facet[] }) {
  const { params, set } = useFilterNav();
  const selected = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const toggle = (key: string, value: string) =>
    set((p) => {
      const cur = selected(key);
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-brand-900"
          checked={params.get("inStock") === "1"}
          onChange={(e) => set((p) => (e.target.checked ? p.set("inStock", "1") : p.delete("inStock")))}
        />
        In stock only
      </label>
      {facets.map((f) => (
        <fieldset key={f.key}>
          <legend className="mb-2 text-sm font-bold">{f.label}</legend>
          <ul className="space-y-1.5">
            {f.options.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-brand-900" checked={selected(f.key).includes(o.value)} onChange={() => toggle(f.key, o.value)} />
                  <span className="flex-1">{o.label}</span>
                  <span className="text-xs text-muted">{o.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

export function FilterSidebar({ facets }: { facets: Facet[] }) {
  return (
    <aside aria-label="Filters" className="hidden lg:block">
      <FacetGroups facets={facets} />
    </aside>
  );
}

export function ActiveFilters({ facets }: { facets: Facet[] }) {
  const { params, set } = useFilterNav();
  const chips: { key: string; value: string; label: string }[] = [];
  for (const f of facets) {
    for (const v of (params.get(f.key) ?? "").split(",").filter(Boolean)) {
      chips.push({ key: f.key, value: v, label: f.options.find((o) => o.value === v)?.label ?? v });
    }
  }
  if (params.get("inStock") === "1") chips.push({ key: "inStock", value: "1", label: "In stock" });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={`${c.key}-${c.value}`}
          type="button"
          onClick={() =>
            set((p) => {
              const rest = (p.get(c.key) ?? "").split(",").filter((v) => v && v !== c.value);
              if (rest.length && c.key !== "inStock") p.set(c.key, rest.join(","));
              else p.delete(c.key);
            })
          }
          className="inline-flex items-center gap-1 rounded-full bg-canvas px-3 py-1 text-xs font-semibold ring-1 ring-line hover:ring-brand-500"
          aria-label={`Remove filter ${c.label}`}
        >
          {c.label} <X className="size-3" aria-hidden />
        </button>
      ))}
      <button type="button" className="text-xs font-semibold text-brand-700 underline" onClick={() => set((p) => [...p.keys()].filter((k) => k !== "sort" && k !== "q").forEach((k) => p.delete(k)))}>
        Clear all
      </button>
    </div>
  );
}

export function SortSelect({ sorts, current }: { sorts: { value: string; label: string }[]; current: string }) {
  const { set, pending } = useFilterNav();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm text-muted">
        Sort
      </label>
      <select id="sort" className="input w-auto py-2" value={current} aria-busy={pending} onChange={(e) => set((p) => p.set("sort", e.target.value))}>
        {sorts.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function MobileFilters({ facets, total }: { facets: Facet[]; total: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button type="button" className="btn-outline btn-sm" onClick={() => setOpen(true)} aria-expanded={open}>
        <SlidersHorizontal className="size-4" aria-hidden /> Filter
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Filters" className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-white">
            <div className="flex items-center justify-between border-b border-line p-4">
              <span className="font-bold">Filters</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="grid size-9 place-items-center">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FacetGroups facets={facets} />
            </div>
            <div className="border-t border-line p-4">
              <button type="button" className="btn-primary w-full" onClick={() => setOpen(false)}>
                Show {total} products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
