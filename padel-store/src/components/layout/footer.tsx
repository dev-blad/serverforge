import Link from "next/link";
import { store } from "@/lib/config";
import { Logo } from "./header";
import { NewsletterForm } from "./newsletter-form";
import { CookieSettingsLink } from "./cookie-banner";

const COLS = [
  { title: "Shop", links: [["Padel rackets", "/c/rackets"], ["Padel balls", "/c/balls"], ["New in", "/c/new"], ["Sale", "/c/sale"], ["Gift cards", "/gift-cards"], ["Racket finder", "/racket-finder"]] },
  { title: "Help", links: [["Help centre & FAQs", "/help"], ["Track my order", "/track"], ["Start a return", "/returns"], ["Delivery information", "/policies/shipping"], ["Contact us", "/contact"]] },
  { title: "Community", links: [["Find a game", "/find-a-game"], ["Racket guide", "/help#racket-guide"], ["My account", "/account"]] },
  { title: "Legal", links: [["Terms & conditions", "/policies/terms"], ["Privacy policy", "/policies/privacy"], ["Cookie policy", "/policies/cookies"], ["Returns & refunds", "/policies/returns"], ["Accessibility", "/policies/accessibility"]] },
];

export function Footer() {
  return (
    <footer className="mt-16 bg-brand-950 text-white">
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="[&_a]:text-white">
            <Logo />
          </div>
          <p className="mt-3 max-w-sm text-sm text-white/70">{store.tagline}. Independent UK padel specialist — real people, real advice.</p>
          <h2 className="mt-6 text-sm font-bold">Join the club</h2>
          <div className="mt-2 max-w-md">
            <NewsletterForm dark />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h2 className="text-sm font-bold text-lime-accent">{c.title}</h2>
              <ul className="mt-3 space-y-2">
                {c.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href!} className="text-sm text-white/75 hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
                {c.title === "Legal" && (
                  <li>
                    <CookieSettingsLink className="text-sm text-white/75 hover:text-white" />
                  </li>
                )}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {store.companyName}. Registered in England & Wales no. {store.companyNumber}. VAT no. {store.vatNumber}. {store.address}
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Accepted payment methods">
            {["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay", "Link"].map((m) => (
              <li key={m} className="rounded border border-white/20 px-2 py-0.5 text-[11px] text-white/80">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
