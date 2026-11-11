import Link from "next/link";
import { Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { store } from "@/lib/config";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping-rates";
import { formatPrice } from "@/lib/money";
import { MegaMenu } from "./mega-menu";
import { MobileNav } from "./mobile-nav";
import { SearchBox } from "./search-box";
import { HeaderActions } from "./header-actions";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`} aria-label={`${store.name} home`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#0d3b2e" />
        <ellipse cx="14" cy="13" rx="8" ry="9" fill="none" stroke="#d9f99d" strokeWidth="2.5" />
        <path d="M18.5 19.5 L24 26" stroke="#d9f99d" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="9" r="3" fill="#a3e635" />
      </svg>
      <span className="text-lg leading-none">
        Courtline<span className="text-brand-500">.</span>
      </span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      <div className="bg-brand-900 text-xs text-white">
        <div className="container-page flex h-8 items-center justify-center gap-6 sm:justify-between">
          <p className="flex items-center gap-1.5">
            <Truck className="size-3.5 text-lime-accent" aria-hidden /> Free UK delivery over {formatPrice(FREE_SHIPPING_THRESHOLD)}
          </p>
          <p className="hidden items-center gap-1.5 sm:flex">
            <RotateCcw className="size-3.5 text-lime-accent" aria-hidden /> 30-day returns
          </p>
          <p className="hidden items-center gap-1.5 md:flex">
            <ShieldCheck className="size-3.5 text-lime-accent" aria-hidden /> Order by 2pm for same-day dispatch
          </p>
        </div>
      </div>
      <div className="border-b border-line">
        <div className="container-page flex h-16 items-center gap-3">
          <MobileNav />
          <Logo />
          <div className="ml-4 flex-1">
            <MegaMenu />
          </div>
          <SearchBox className="hidden w-72 md:block xl:w-80" />
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
