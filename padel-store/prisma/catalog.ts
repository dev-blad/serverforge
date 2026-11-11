/**
 * Demo catalogue. Brands are fictional. Products in categories other than
 * rackets & balls are PLACEHOLDERS (isPlaceholder) — flagged in admin only.
 */
import type { ImageKind, Palette } from "../scripts/images";

export const BRANDS = [
  { slug: "kestrel", name: "Kestrel", description: "Spanish-designed performance rackets built around carbon power." },
  { slug: "solara", name: "Solara", description: "Lightweight, forgiving kit with a focus on control and comfort." },
  { slug: "vantis", name: "Vantis", description: "Hybrid designs for all-court players who want a bit of everything." },
  { slug: "northcourt", name: "Northcourt", description: "British-founded brand engineering kit for the UK indoor game." },
  { slug: "ondo", name: "Ondo", description: "Club-favourite rackets and accessories with great value." },
  { slug: "brava", name: "Brava", description: "Stylish, performance-led kit designed with women players in mind." },
  { slug: "courtline", name: "Courtline Essentials", description: "Our own-label essentials — tested by our team, priced fairly." },
];

export const CATEGORIES = [
  { slug: "rackets", name: "Padel Rackets", description: "Round, teardrop and diamond rackets for every level — from first-timers to tournament players.", isPlaceholder: false, sortOrder: 1 },
  { slug: "balls", name: "Padel Balls", description: "Tour-grade pressurised balls, value cartons and pressureless training buckets.", isPlaceholder: false, sortOrder: 2 },
  { slug: "shoes", name: "Padel Shoes", description: "Herringbone and clay-pattern soles built for grip on sand-filled artificial grass.", isPlaceholder: true, sortOrder: 3 },
  { slug: "bags", name: "Bags", description: "Thermo racket bags, backpacks and holdalls to carry your kit to court.", isPlaceholder: true, sortOrder: 4 },
  { slug: "grips-overgrips", name: "Grips & Overgrips", description: "Fresh overgrips for tack, sweat control and comfort.", isPlaceholder: true, sortOrder: 5 },
  { slug: "clothing", name: "Clothing", description: "Breathable, quick-dry tees, shorts, skorts and layers.", isPlaceholder: true, sortOrder: 6 },
  { slug: "accessories", name: "Accessories", description: "Wristbands, caps, ball pressurisers, bottles and more.", isPlaceholder: true, sortOrder: 7 },
  { slug: "protectors", name: "Protectors", description: "Frame protectors to guard your racket against wall and floor scrapes.", isPlaceholder: true, sortOrder: 8 },
];

export interface SeedVariant {
  name: string;
  sku: string;
  price?: number;
  stock: number;
}

export interface SeedProduct {
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  shortDescription: string;
  description: string;
  specs: { label: string; value: string }[];
  weightGrams?: number;
  shape?: string;
  skillLevel?: string;
  balance?: string;
  shippingWeight: number;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
  variants: SeedVariant[];
  image: ImageKind;
  palette: Palette;
  daysOld: number;
}

const racketSpecs = (o: { shape: string; weight: string; balance: string; core: string; face: string; feel: string; level: string; style: string; thickness?: string }) => [
  { label: "Shape", value: o.shape },
  { label: "Weight", value: o.weight },
  { label: "Balance", value: o.balance },
  { label: "Core", value: o.core },
  { label: "Face", value: o.face },
  { label: "Frame", value: "100% tubular carbon" },
  { label: "Feel", value: o.feel },
  { label: "Thickness", value: o.thickness ?? "38 mm" },
  { label: "Length", value: "45.5 cm" },
  { label: "Player level", value: o.level },
  { label: "Play style", value: o.style },
];

function racket(
  slug: string,
  name: string,
  brand: string,
  opts: {
    price: number;
    compareAtPrice?: number;
    shape: "Round" | "Teardrop" | "Diamond";
    weight: number;
    balance: "Low" | "Medium" | "High";
    level: "Beginner" | "Intermediate" | "Advanced" | "Junior";
    core: string;
    face: string;
    feel: string;
    style: string;
    short: string;
    long: string;
    palette: Palette;
    stock: number;
    flags?: Partial<Pick<SeedProduct, "isFeatured" | "isBestSeller" | "isNew">>;
    colours?: string[];
    daysOld?: number;
  },
): SeedProduct {
  const skuBase = slug.toUpperCase().replace(/-/g, "").slice(0, 20);
  const colours = opts.colours ?? ["Standard"];
  return {
    slug,
    name,
    brand,
    category: "rackets",
    price: opts.price,
    compareAtPrice: opts.compareAtPrice,
    shortDescription: opts.short,
    description: opts.long,
    specs: racketSpecs({
      shape: opts.shape,
      weight: `${opts.weight - 5}–${opts.weight + 5} g`,
      balance: opts.balance,
      core: opts.core,
      face: opts.face,
      feel: opts.feel,
      level: opts.level,
      style: opts.style,
    }),
    weightGrams: opts.weight,
    shape: opts.shape,
    skillLevel: opts.level,
    balance: opts.balance,
    shippingWeight: 900,
    ...opts.flags,
    variants: colours.map((c, i) => ({
      name: c,
      sku: `RK-${skuBase}-${i + 1}`,
      stock: i === 0 ? opts.stock : Math.max(0, Math.round(opts.stock / 2) - 1),
    })),
    image: { type: "racket", shape: opts.shape.toLowerCase() as "round" | "teardrop" | "diamond", brand: BRANDS.find((b) => b.slug === brand)!.name.split(" ")[0]! },
    palette: opts.palette,
    daysOld: opts.daysOld ?? 120,
  };
}

export const PRODUCTS: SeedProduct[] = [
  // ─────────────── Rackets (real stock) ───────────────
  racket("kestrel-apex-carbon", "Kestrel Apex Carbon 18K", "kestrel", {
    price: 21999, compareAtPrice: 24999, shape: "Diamond", weight: 365, balance: "High", level: "Advanced",
    core: "EVA Hard", face: "18K carbon", feel: "Firm", style: "Power / attacking",
    short: "Explosive diamond-shaped power racket for aggressive players who finish points at the net.",
    long: "The Apex Carbon is built for players who live for the smash. An 18K carbon face over a hard EVA core delivers a crisp, powerful response, while the high balance adds extra mass to the head for vibora and por tres finishes.\n\nA rough 3D-textured face bites the ball for heavy spin, and the reinforced carbon throat keeps the frame stable on off-centre hits. Recommended for advanced players with solid technique.",
    palette: { primary: "#111827", secondary: "#f97316", accent: "#facc15" }, stock: 14,
    flags: { isFeatured: true, isBestSeller: true }, colours: ["Black / Orange", "Black / Lime"], daysOld: 200,
  }),
  racket("kestrel-glide-control", "Kestrel Glide Control", "kestrel", {
    price: 14999, shape: "Round", weight: 355, balance: "Low", level: "Intermediate",
    core: "EVA Soft", face: "12K carbon", feel: "Soft", style: "Control / defensive",
    short: "Round, low-balance control racket with a generous sweet spot and a plush, soft feel.",
    long: "Glide Control rewards patient, tactical players. The round head and low balance make it quick in the hands for blocks and volleys, while the soft EVA core cushions vibrations and gives easy depth on lobs.\n\nA 12K carbon face adds durability and a touch more pop than fibreglass. Ideal for improving intermediates and anyone with elbow concerns.",
    palette: { primary: "#0e7490", secondary: "#e5e7eb", accent: "#67e8f9" }, stock: 22, daysOld: 160,
  }),
  racket("solara-vortex-pro", "Solara Vortex Pro", "solara", {
    price: 25999, shape: "Diamond", weight: 370, balance: "High", level: "Advanced",
    core: "Multi-layer EVA", face: "18K carbon + aluminised glass", feel: "Medium-firm", style: "Power",
    short: "Tour-level diamond racket with a multi-layer core for power that doesn't sacrifice feel.",
    long: "Vortex Pro is Solara's flagship for 2026. A dual-density EVA core pairs a responsive outer layer with a firm inner layer, so you get feel on touch shots and real power when you swing through.\n\nThe diamond head and high balance suit attacking players, and the anti-vibration throat system keeps things comfortable over long matches.",
    palette: { primary: "#7c2d12", secondary: "#fde68a", accent: "#fb923c" }, stock: 6,
    flags: { isNew: true, isFeatured: true }, daysOld: 12,
  }),
  racket("solara-breeze-lite", "Solara Breeze Lite", "solara", {
    price: 7999, shape: "Round", weight: 345, balance: "Low", level: "Beginner",
    core: "EVA Soft", face: "Fibreglass", feel: "Soft", style: "Control",
    short: "Light, forgiving beginner racket — the easiest way to start playing padel.",
    long: "If you're new to padel, start here. Breeze Lite is light, comfortable and incredibly forgiving thanks to a big round sweet spot and soft fibreglass face.\n\nIt's easy to manoeuvre at the net and gives you plenty of depth from the back without big swings. Great value for new players, juniors moving up, and club loan sets.",
    palette: { primary: "#0369a1", secondary: "#f8fafc", accent: "#bae6fd" }, stock: 38,
    flags: { isBestSeller: true }, colours: ["Ocean Blue", "Coral Pink"], daysOld: 300,
  }),
  racket("vantis-hybrid-teardrop", "Vantis Hybrid Teardrop", "vantis", {
    price: 16999, compareAtPrice: 18999, shape: "Teardrop", weight: 360, balance: "Medium", level: "Intermediate",
    core: "EVA Medium", face: "12K carbon", feel: "Medium", style: "All-round",
    short: "Balanced teardrop for all-court players — power when you need it, control when you don't.",
    long: "The Hybrid Teardrop is our team's favourite all-rounder. Its medium balance sits between control and power, so it's as comfortable defending from the back glass as it is finishing at the net.\n\nA medium-density EVA core gives a predictable response, and the sand-textured 12K carbon face generates excellent spin.",
    palette: { primary: "#14532d", secondary: "#d9f99d", accent: "#84cc16" }, stock: 17,
    flags: { isFeatured: true }, daysOld: 90,
  }),
  racket("vantis-rookie", "Vantis Rookie", "vantis", {
    price: 5999, shape: "Round", weight: 340, balance: "Low", level: "Beginner",
    core: "Foam", face: "Fibreglass", feel: "Very soft", style: "Control",
    short: "Durable entry-level racket with a soft foam core — perfect for your first season.",
    long: "Rookie is built to take the knocks of learning. A soft foam core and fibreglass face make it very easy to play with, and the round shape gives a big sweet spot.\n\nA great choice for casual players, school programmes and anyone wanting a second racket for guests.",
    palette: { primary: "#4c1d95", secondary: "#e9d5ff", accent: "#c084fc" }, stock: 3, daysOld: 400,
  }),
  racket("northcourt-atlas-12k", "Northcourt Atlas 12K", "northcourt", {
    price: 19999, shape: "Teardrop", weight: 362, balance: "Medium", level: "Advanced",
    core: "EVA Pro", face: "12K carbon", feel: "Medium", style: "All-round / attacking",
    short: "Precise teardrop designed for the faster pace of UK indoor courts.",
    long: "Atlas 12K was developed with UK coaches for quick indoor surfaces. A slightly thinner 37 mm profile speeds up the racket through the air for fast exchanges, while the 12K carbon face offers a clean, precise feel.\n\nThe medium balance gives enough head weight for smashes without slowing you down at the net.",
    palette: { primary: "#1e3a8a", secondary: "#f1f5f9", accent: "#38bdf8" }, stock: 9,
    flags: { isNew: true }, daysOld: 20,
  }),
  racket("northcourt-coastal-junior", "Northcourt Coastal Junior", "northcourt", {
    price: 4499, shape: "Round", weight: 300, balance: "Low", level: "Junior",
    core: "Foam", face: "Fibreglass", feel: "Soft", style: "Control",
    short: "Lightweight junior racket for ages 8–13, with a shorter handle and soft feel.",
    long: "Coastal Junior is sized for younger players with a lighter 300 g build and a slightly shorter handle. The soft foam core is forgiving on mis-hits and easy on growing arms.\n\nBright, fun design and a tough frame make it perfect for junior academies.",
    palette: { primary: "#be123c", secondary: "#fef3c7", accent: "#fcd34d" }, stock: 12, daysOld: 220,
  }),
  racket("ondo-fusion-control", "Ondo Fusion Control", "ondo", {
    price: 12999, shape: "Round", weight: 358, balance: "Low", level: "Intermediate",
    core: "EVA Soft", face: "3K carbon", feel: "Soft", style: "Control",
    short: "Best-selling round control racket — comfortable, consistent and great value.",
    long: "Fusion Control is a club favourite for a reason. Round head, low balance and a soft EVA core give it a big, consistent sweet spot and loads of comfort.\n\nThe 3K carbon face adds a little bite and longevity over fibreglass, making it an ideal step up from a first racket.",
    palette: { primary: "#065f46", secondary: "#ecfccb", accent: "#34d399" }, stock: 26,
    flags: { isBestSeller: true }, daysOld: 250,
  }),
  racket("ondo-strike-power", "Ondo Strike Power", "ondo", {
    price: 20999, shape: "Diamond", weight: 368, balance: "High", level: "Advanced",
    core: "EVA Hard", face: "12K carbon", feel: "Firm", style: "Power",
    short: "Head-heavy diamond with a hard core for maximum smash power.",
    long: "Strike Power is built to end points. A high balance and hard EVA core deliver a firm, explosive response, and the diamond head concentrates mass where it counts for overheads.\n\nBest for strong, experienced players with good technique.",
    palette: { primary: "#18181b", secondary: "#ef4444", accent: "#fca5a5" }, stock: 0, daysOld: 140,
  }),
  racket("brava-tempo", "Brava Tempo", "brava", {
    price: 13999, shape: "Teardrop", weight: 350, balance: "Medium", level: "Intermediate",
    core: "EVA Soft", face: "12K carbon", feel: "Medium-soft", style: "All-round",
    short: "Lighter teardrop with a soft core — fast hands at the net and easy power from the back.",
    long: "Tempo combines a lighter 350 g build with a teardrop head, giving quick reactions at the net and easy depth on groundstrokes. The soft EVA core is comfortable for long sessions.\n\nDesigned with women players in mind, loved by anyone who wants a quick, comfortable all-rounder.",
    palette: { primary: "#9d174d", secondary: "#fce7f3", accent: "#f9a8d4" }, stock: 11,
    flags: { isNew: true, isFeatured: true }, daysOld: 8,
  }),
  racket("courtline-starter-set", "Courtline Starter Set (2 rackets + 3 balls)", "courtline", {
    price: 8999, compareAtPrice: 10999, shape: "Round", weight: 350, balance: "Low", level: "Beginner",
    core: "EVA Soft", face: "Fibreglass", feel: "Soft", style: "Control",
    short: "Everything two players need to get on court: two rackets, a tube of balls and a carry bag.",
    long: "Our Starter Set is the easiest way to try padel. You get two forgiving round rackets, a tube of three Courtline Tour balls and a padded carry bag.\n\nPerfect for couples, friends or a family getting into the sport.",
    palette: { primary: "#0d3b2e", secondary: "#d9f99d", accent: "#a3e635" }, stock: 19,
    flags: { isBestSeller: true }, daysOld: 180,
  }),

  // ─────────────── Balls (real stock) ───────────────
  {
    slug: "courtline-tour-ball", name: "Courtline Tour Ball", brand: "courtline", category: "balls", price: 649,
    shortDescription: "Pressurised tournament ball with consistent bounce and long-lasting felt.",
    description: "Our own Tour Ball uses premium pressurised cores and a dense woven felt for consistent speed and bounce session after session. Approved for club and league play.\n\nBuy by the tube, carton or box — the more you buy, the less you pay per tube.",
    specs: [{ label: "Type", value: "Pressurised" }, { label: "Speed", value: "Medium" }, { label: "Balls per tube", value: "3" }, { label: "Surface", value: "All surfaces" }, { label: "Felt", value: "Premium woven" }],
    shippingWeight: 250, isFeatured: true, isBestSeller: true,
    variants: [
      { name: "1 tube (3 balls)", sku: "BL-CLTOUR-1", stock: 240 },
      { name: "Carton — 4 tubes", sku: "BL-CLTOUR-4", price: 2299, stock: 60 },
      { name: "Box — 24 tubes", sku: "BL-CLTOUR-24", price: 11999, stock: 12 },
    ],
    image: { type: "balls", brand: "Courtline", pack: "tube" }, palette: { primary: "#0d3b2e", secondary: "#a3e635", accent: "#16a34a" }, daysOld: 300,
  },
  {
    slug: "kestrel-pro-speed-balls", name: "Kestrel Pro Speed Balls", brand: "kestrel", category: "balls", price: 699,
    shortDescription: "Fast, lively ball favoured by attacking players and competitive leagues.",
    description: "Pro Speed balls play fast and lively — great for indoor courts and attacking styles. High-pressure cores keep their bounce longer than standard balls.",
    specs: [{ label: "Type", value: "Pressurised" }, { label: "Speed", value: "Fast" }, { label: "Balls per tube", value: "3" }, { label: "Surface", value: "Indoor / outdoor" }],
    shippingWeight: 250, isBestSeller: true,
    variants: [
      { name: "1 tube (3 balls)", sku: "BL-KSPEED-1", stock: 180 },
      { name: "3 tubes", sku: "BL-KSPEED-3", price: 1899, stock: 50 },
      { name: "Box — 24 tubes", sku: "BL-KSPEED-24", price: 12999, stock: 8 },
    ],
    image: { type: "balls", brand: "Kestrel", pack: "tube" }, palette: { primary: "#111827", secondary: "#f97316", accent: "#ea580c" }, daysOld: 200,
  },
  {
    slug: "solara-control-balls", name: "Solara Control Balls", brand: "solara", category: "balls", price: 599,
    shortDescription: "Slightly slower ball for longer rallies and better control.",
    description: "Control balls are a touch slower than tour balls, giving you more time on the ball — ideal for outdoor courts in summer and for longer, tactical rallies.",
    specs: [{ label: "Type", value: "Pressurised" }, { label: "Speed", value: "Slow-medium" }, { label: "Balls per tube", value: "3" }, { label: "Surface", value: "Outdoor" }],
    shippingWeight: 250,
    variants: [
      { name: "1 tube (3 balls)", sku: "BL-SCTRL-1", stock: 120 },
      { name: "Carton — 4 tubes", sku: "BL-SCTRL-4", price: 2199, stock: 30 },
    ],
    image: { type: "balls", brand: "Solara", pack: "tube" }, palette: { primary: "#0369a1", secondary: "#fde68a", accent: "#0ea5e9" }, daysOld: 150,
  },
  {
    slug: "northcourt-premium-gold", name: "Northcourt Premium Gold", brand: "northcourt", category: "balls", price: 749,
    shortDescription: "Premium championship ball with extra-durable felt — our longest-lasting tube.",
    description: "Premium Gold is Northcourt's championship ball, with an extra-durable felt that resists fluffing on abrasive courts. Consistent, medium-fast pace.",
    specs: [{ label: "Type", value: "Pressurised" }, { label: "Speed", value: "Medium-fast" }, { label: "Balls per tube", value: "3" }, { label: "Felt", value: "Extra-durable" }],
    shippingWeight: 250, isNew: true,
    variants: [
      { name: "1 tube (3 balls)", sku: "BL-NCGOLD-1", stock: 90 },
      { name: "Box — 24 tubes", sku: "BL-NCGOLD-24", price: 15999, stock: 4 },
    ],
    image: { type: "balls", brand: "Northcourt", pack: "box" }, palette: { primary: "#78350f", secondary: "#fde047", accent: "#ca8a04" }, daysOld: 25,
  },
  {
    slug: "vantis-pressureless-training", name: "Vantis Pressureless Training Balls", brand: "vantis", category: "balls", price: 1699,
    shortDescription: "Pressureless balls that never go flat — ideal for coaching and ball machines.",
    description: "Pressureless balls keep a consistent bounce for months, making them ideal for coaching sessions, ball machines and practice. Slightly heavier feel than pressurised balls.",
    specs: [{ label: "Type", value: "Pressureless" }, { label: "Speed", value: "Medium" }, { label: "Lifespan", value: "Months of regular use" }],
    shippingWeight: 900,
    variants: [
      { name: "Bag of 12", sku: "BL-VPLESS-12", stock: 40 },
      { name: "Bucket of 60", sku: "BL-VPLESS-60", price: 7999, stock: 6 },
    ],
    image: { type: "balls", brand: "Vantis", pack: "bucket" }, palette: { primary: "#14532d", secondary: "#d9f99d", accent: "#65a30d" }, daysOld: 160,
  },
  {
    slug: "ondo-club-balls", name: "Ondo Club Balls", brand: "ondo", category: "balls", price: 549,
    shortDescription: "Great-value everyday ball for social games and club nights.",
    description: "Reliable, great-value balls for social play. Medium pace, decent durability, and a price that makes it easy to open a fresh tube every match.",
    specs: [{ label: "Type", value: "Pressurised" }, { label: "Speed", value: "Medium" }, { label: "Balls per tube", value: "3" }],
    shippingWeight: 250,
    variants: [
      { name: "1 tube (3 balls)", sku: "BL-ONDOCLUB-1", stock: 150 },
      { name: "Carton — 4 tubes", sku: "BL-ONDOCLUB-4", price: 1999, stock: 0 },
    ],
    image: { type: "balls", brand: "Ondo", pack: "tube" }, palette: { primary: "#065f46", secondary: "#fef08a", accent: "#10b981" }, daysOld: 260,
  },

  // ─────────────── PLACEHOLDERS ───────────────
  ...placeholder("shoes", [
    ["kestrel-grip-clay-mens", "Kestrel Grip Clay Men's Padel Shoe", "kestrel", 8999, { type: "shoe", brand: "Kestrel" }, { primary: "#111827", secondary: "#9ca3af", accent: "#f97316" }, ["UK 7", "UK 8", "UK 9", "UK 10", "UK 11", "UK 12"], "Full herringbone outsole for grip on sand-dressed courts, with a cushioned midsole and reinforced toe drag area."],
    ["solara-court-pro-womens", "Solara Court Pro Women's Padel Shoe", "solara", 8499, { type: "shoe", brand: "Solara" }, { primary: "#f8fafc", secondary: "#e2e8f0", accent: "#0ea5e9" }, ["UK 4", "UK 5", "UK 6", "UK 7", "UK 8"], "Lightweight women's shoe with a breathable mesh upper and lateral support for quick changes of direction."],
    ["vantis-all-court-shoe", "Vantis All-Court Shoe", "vantis", 6999, { type: "shoe", brand: "Vantis" }, { primary: "#14532d", secondary: "#bbf7d0", accent: "#a3e635" }, ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"], "Versatile omni-court outsole that works on padel, tennis and indoor surfaces."],
    ["brava-junior-shoe", "Brava Junior Padel Shoe", "brava", 4499, { type: "shoe", brand: "Brava" }, { primary: "#9d174d", secondary: "#fbcfe8", accent: "#fde047" }, ["UK 1", "UK 2", "UK 3", "UK 4", "UK 5"], "Durable junior shoe with an easy hook-and-loop strap and non-marking sole."],
  ]),
  ...placeholder("bags", [
    ["kestrel-tour-thermo-bag", "Kestrel Tour Thermo Racket Bag", "kestrel", 6999, { type: "bag", brand: "Kestrel", style: "thermo" }, { primary: "#111827", secondary: "#f97316", accent: "#facc15" }, ["One size"], "Thermal-lined compartments hold up to 4 rackets plus a separate shoe and wet-kit pocket."],
    ["solara-court-backpack", "Solara Court Backpack", "solara", 4999, { type: "bag", brand: "Solara", style: "backpack" }, { primary: "#0369a1", secondary: "#e0f2fe", accent: "#38bdf8" }, ["One size"], "Racket backpack with dedicated racket sleeve, laptop pocket and ventilated shoe compartment."],
    ["northcourt-club-holdall", "Northcourt Club Holdall", "northcourt", 5499, { type: "bag", brand: "Northcourt", style: "holdall" }, { primary: "#1e3a8a", secondary: "#93c5fd", accent: "#facc15" }, ["One size"], "Spacious holdall for kit, towels and two rackets — ideal for tournaments and travel."],
    ["ondo-team-thermo-bag", "Ondo Team Thermo Bag", "ondo", 5999, { type: "bag", brand: "Ondo", style: "thermo" }, { primary: "#065f46", secondary: "#a7f3d0", accent: "#fde047" }, ["One size"], "Team-sized thermo bag with padded straps and an insulated racket compartment."],
  ]),
  ...placeholder("grips-overgrips", [
    ["courtline-tack-overgrip-3", "Courtline Tack Overgrip (3 pack)", "courtline", 599, { type: "grip", brand: "Courtline" }, { primary: "#f8fafc", secondary: "#0d3b2e", accent: "#a3e635" }, ["White", "Black", "Lime"], "Tacky, comfortable overgrip with excellent sweat absorption. 3 per pack."],
    ["kestrel-dry-overgrip-10", "Kestrel Dry Overgrip (10 pack)", "kestrel", 1499, { type: "grip", brand: "Kestrel" }, { primary: "#111827", secondary: "#f97316", accent: "#fb923c" }, ["Black"], "Dry-feel overgrip for players with sweaty hands. Value 10 pack."],
    ["vantis-replacement-grip", "Vantis Replacement Grip", "vantis", 899, { type: "grip", brand: "Vantis" }, { primary: "#14532d", secondary: "#d9f99d", accent: "#84cc16" }, ["Black"], "Cushioned base grip to restore comfort to an older racket."],
    ["solara-perforated-overgrip", "Solara Perforated Overgrip (3 pack)", "solara", 699, { type: "grip", brand: "Solara" }, { primary: "#0ea5e9", secondary: "#0369a1", accent: "#e0f2fe" }, ["Blue", "White"], "Perforated design for breathability and extra cushioning."],
  ]),
  ...placeholder("clothing", [
    ["courtline-performance-tee", "Courtline Performance Tee", "courtline", 2499, { type: "tee", brand: "Courtline" }, { primary: "#0d3b2e", secondary: "#d9f99d", accent: "#a3e635" }, ["XS", "S", "M", "L", "XL", "XXL"], "Lightweight recycled-poly tee with quick-dry finish and flatlock seams."],
    ["brava-court-skort", "Brava Court Skort", "brava", 3499, { type: "skort", brand: "Brava" }, { primary: "#9d174d", secondary: "#fbcfe8", accent: "#f9a8d4" }, ["XS", "S", "M", "L", "XL"], "Pleated skort with built-in shorts and a ball pocket."],
    ["ondo-match-shorts", "Ondo Match Shorts", "ondo", 2999, { type: "shorts", brand: "Ondo" }, { primary: "#1f2937", secondary: "#a7f3d0", accent: "#10b981" }, ["S", "M", "L", "XL", "XXL"], "Stretch match shorts with deep ball pockets and a 7\" inseam."],
    ["northcourt-club-hoodie", "Northcourt Club Hoodie", "northcourt", 4999, { type: "hoodie", brand: "Northcourt" }, { primary: "#1e3a8a", secondary: "#bfdbfe", accent: "#facc15" }, ["S", "M", "L", "XL", "XXL"], "Midweight brushed-back hoodie for warm-ups and post-match."],
  ]),
  ...placeholder("accessories", [
    ["courtline-wristbands-2", "Courtline Wristbands (2 pack)", "courtline", 799, { type: "wristband", brand: "Courtline" }, { primary: "#0d3b2e", secondary: "#a3e635", accent: "#a3e635" }, ["One size"], "Absorbent terry wristbands to keep your grip dry."],
    ["courtline-tech-cap", "Courtline Tech Cap", "courtline", 1999, { type: "cap", brand: "Courtline" }, { primary: "#f8fafc", secondary: "#0d3b2e", accent: "#a3e635" }, ["One size"], "Lightweight, breathable cap with adjustable strap."],
    ["vantis-ball-pressuriser", "Vantis Ball Pressuriser", "vantis", 2999, { type: "pressuriser", brand: "Vantis" }, { primary: "#14532d", secondary: "#1f2937", accent: "#a3e635" }, ["Holds 4 balls"], "Keeps opened balls at match pressure for weeks longer."],
    ["solara-insulated-bottle", "Solara Insulated Bottle 750ml", "solara", 2299, { type: "bottle", brand: "Solara" }, { primary: "#0369a1", secondary: "#0c4a6e", accent: "#bae6fd" }, ["750 ml"], "Double-walled stainless bottle keeps drinks cold for 24 hours."],
  ]),
  ...placeholder("protectors", [
    ["courtline-frame-protector-tape", "Courtline Clear Frame Protector Tape", "courtline", 699, { type: "protector", brand: "Courtline" }, { primary: "#94a3b8", secondary: "#0d3b2e", accent: "#a3e635" }, ["Clear"], "Transparent adhesive tape that guards your frame against scrapes."],
    ["kestrel-protector-shield", "Kestrel Protector Shield", "kestrel", 999, { type: "protector", brand: "Kestrel" }, { primary: "#f97316", secondary: "#111827", accent: "#facc15" }, ["Black", "Orange"], "Thicker, textured protector for players who scrape the floor a lot."],
    ["solara-invisible-protector", "Solara Invisible Protector", "solara", 799, { type: "protector", brand: "Solara" }, { primary: "#bae6fd", secondary: "#0369a1", accent: "#0ea5e9" }, ["Clear"], "Ultra-thin protector that adds less than 2 g to your racket."],
  ]),
];

function placeholder(
  category: string,
  rows: [string, string, string, number, ImageKind, Palette, string[], string][],
): SeedProduct[] {
  return rows.map(([slug, name, brand, price, image, palette, variants, blurb], idx) => ({
    slug,
    name,
    brand,
    category,
    price,
    shortDescription: blurb,
    description: `${blurb}\n\nThis product is part of our upcoming range — specifications may change before launch.`,
    specs: [
      { label: "Category", value: CATEGORIES.find((c) => c.slug === category)!.name },
      { label: "Options", value: variants.join(", ") },
      { label: "Care", value: category === "clothing" ? "Machine wash 30°C" : "Wipe clean" },
    ],
    shippingWeight: category === "shoes" ? 1200 : category === "bags" ? 1500 : category === "clothing" ? 300 : 150,
    isNew: idx === 0,
    variants: variants.map((v, i) => ({
      name: v,
      sku: `PH-${slug.toUpperCase().replace(/-/g, "").slice(0, 20)}-${i + 1}`,
      stock: 8 + ((i * 7 + idx * 3) % 20),
    })),
    image,
    palette,
    daysOld: 30 + idx * 15,
  }));
}

export const VENUES = [
  { name: "Northern Quarter Padel (demo)", city: "Manchester", region: "North West", lat: 53.4839, lng: -2.2365, courts: 6, indoor: true },
  { name: "Salford Quays Padel Club (demo)", city: "Salford", region: "North West", lat: 53.4713, lng: -2.2934, courts: 4, indoor: true },
  { name: "Thames Riverside Padel (demo)", city: "London", region: "London", lat: 51.5033, lng: -0.0196, courts: 8, indoor: true },
  { name: "West London Padel Centre (demo)", city: "London", region: "London", lat: 51.5136, lng: -0.2256, courts: 5, indoor: false },
  { name: "Brixton Padel Rooftop (demo)", city: "London", region: "London", lat: 51.4613, lng: -0.1156, courts: 3, indoor: false },
  { name: "Leeds Dock Padel (demo)", city: "Leeds", region: "Yorkshire", lat: 53.7915, lng: -1.5323, courts: 4, indoor: true },
  { name: "Sheffield Steel Padel (demo)", city: "Sheffield", region: "Yorkshire", lat: 53.3811, lng: -1.4701, courts: 3, indoor: true },
  { name: "Birmingham Jewellery Quarter Padel (demo)", city: "Birmingham", region: "West Midlands", lat: 52.4889, lng: -1.9112, courts: 5, indoor: true },
  { name: "Bristol Harbourside Padel (demo)", city: "Bristol", region: "South West", lat: 51.4492, lng: -2.5977, courts: 4, indoor: false },
  { name: "Edinburgh Leith Padel (demo)", city: "Edinburgh", region: "Scotland", lat: 55.9756, lng: -3.1728, courts: 4, indoor: true },
  { name: "Glasgow Clyde Padel (demo)", city: "Glasgow", region: "Scotland", lat: 55.8584, lng: -4.2894, courts: 6, indoor: true },
  { name: "Cardiff Bay Padel (demo)", city: "Cardiff", region: "Wales", lat: 51.4637, lng: -3.1636, courts: 3, indoor: true },
  { name: "Newcastle Quayside Padel (demo)", city: "Newcastle", region: "North East", lat: 54.9695, lng: -1.6006, courts: 4, indoor: true },
  { name: "Brighton Seafront Padel (demo)", city: "Brighton", region: "South East", lat: 50.8204, lng: -0.1453, courts: 3, indoor: false },
  { name: "Nottingham Lace Market Padel (demo)", city: "Nottingham", region: "East Midlands", lat: 52.9519, lng: -1.1437, courts: 4, indoor: true },
  { name: "Liverpool Docks Padel (demo)", city: "Liverpool", region: "North West", lat: 53.3997, lng: -2.9925, courts: 5, indoor: true },
];
