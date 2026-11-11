export interface NavPanel {
  label: string;
  href: string;
  columns: { title: string; links: { label: string; href: string }[] }[];
  promo?: { title: string; text: string; href: string; cta: string };
}

export const NAV: NavPanel[] = [
  {
    label: "Rackets",
    href: "/c/rackets",
    columns: [
      { title: "By shape", links: [
        { label: "Round (control)", href: "/c/rackets?shape=Round" },
        { label: "Teardrop (all-round)", href: "/c/rackets?shape=Teardrop" },
        { label: "Diamond (power)", href: "/c/rackets?shape=Diamond" },
      ] },
      { title: "By level", links: [
        { label: "Beginner", href: "/c/rackets?level=Beginner" },
        { label: "Intermediate", href: "/c/rackets?level=Intermediate" },
        { label: "Advanced", href: "/c/rackets?level=Advanced" },
        { label: "Junior", href: "/c/rackets?level=Junior" },
      ] },
      { title: "Popular", links: [
        { label: "All rackets", href: "/c/rackets" },
        { label: "Best sellers", href: "/c/rackets?sort=best-selling" },
        { label: "Under £100", href: "/c/rackets?price=25-75,75-150&sort=price-asc" },
        { label: "Racket sale", href: "/c/sale" },
      ] },
    ],
    promo: { title: "Not sure which racket?", text: "Answer 4 quick questions and we'll match you to the right racket.", href: "/racket-finder", cta: "Try the racket finder" },
  },
  {
    label: "Balls",
    href: "/c/balls",
    columns: [
      { title: "Padel balls", links: [
        { label: "All balls", href: "/c/balls" },
        { label: "Tour & match balls", href: "/c/balls?sort=best-selling" },
        { label: "Training balls", href: "/products/vantis-pressureless-training" },
        { label: "Cartons & boxes", href: "/c/balls?sort=price-desc" },
      ] },
    ],
    promo: { title: "Buy in bulk & save", text: "Boxes of 24 tubes from under £5 a tube.", href: "/products/courtline-tour-ball", cta: "Shop Tour Ball" },
  },
  {
    label: "Kit",
    href: "/c/all",
    columns: [
      { title: "Footwear & bags", links: [
        { label: "Padel shoes", href: "/c/shoes" },
        { label: "Racket bags", href: "/c/bags" },
      ] },
      { title: "Clothing", links: [{ label: "All clothing", href: "/c/clothing" }] },
      { title: "Accessories", links: [
        { label: "Grips & overgrips", href: "/c/grips-overgrips" },
        { label: "Protectors", href: "/c/protectors" },
        { label: "Accessories", href: "/c/accessories" },
        { label: "Gift cards", href: "/gift-cards" },
      ] },
    ],
  },
];
