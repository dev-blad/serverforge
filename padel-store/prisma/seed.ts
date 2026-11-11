/* eslint-disable no-console */
import { PrismaClient, type OrderStatus, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { BRANDS, CATEGORIES, PRODUCTS, VENUES } from "./catalog";
import { computeTotals } from "../src/lib/pricing";
import { SHIPPING_METHODS } from "../src/lib/shipping-rates";

const db = new PrismaClient();

// Deterministic PRNG so the demo data is stable between runs.
let seed = 20261111;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const daysAgo = (d: number, hour = int(7, 22)) => {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(hour, int(0, 59), int(0, 59), 0);
  return date;
};

const FIRST = ["Oliver", "Amelia", "George", "Isla", "Harry", "Ava", "Jack", "Mia", "Charlie", "Sophia", "Noah", "Grace", "Leo", "Freya", "Alfie", "Emily", "Oscar", "Poppy", "Arthur", "Ella", "Thomas", "Lily", "James", "Evie", "William", "Chloe", "Henry", "Ruby", "Archie", "Priya", "Mohammed", "Aisha", "Callum", "Niamh", "Rhys", "Siobhan"];
const LAST = ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Patel", "Robinson", "Wright", "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Khan", "Hughes", "Murphy", "Campbell", "MacDonald"];
const CITIES = [
  ["Manchester", "M4 1HN"], ["London", "SW11 4NJ"], ["London", "E14 5AB"], ["Leeds", "LS1 4DY"], ["Birmingham", "B3 1JR"], ["Bristol", "BS1 5TY"],
  ["Glasgow", "G1 3SL"], ["Edinburgh", "EH6 6JJ"], ["Cardiff", "CF10 4PA"], ["Liverpool", "L3 4BB"], ["Nottingham", "NG1 1HF"], ["Brighton", "BN1 2FL"],
  ["Sheffield", "S1 2BJ"], ["Newcastle upon Tyne", "NE1 3DY"], ["Reading", "RG1 1DG"], ["Cambridge", "CB2 1TN"], ["Oxford", "OX1 2JD"], ["York", "YO1 7HH"],
] as const;
const STREETS = ["High Street", "Station Road", "Church Lane", "Victoria Road", "Park Avenue", "Mill Lane", "Queens Road", "The Crescent", "Kings Road", "Oak Drive"];

const REVIEW_TEMPLATES: Record<number, { title: string; body: string }[]> = {
  5: [
    { title: "Brilliant from the first session", body: "Took it straight to my Tuesday league and it felt natural immediately. Great sweet spot and plenty of power when I need it. Delivery was next day too." },
    { title: "Exactly what I was after", body: "Upgraded from a beginner racket and the difference is massive. More control on volleys and bandejas feel much more solid." },
    { title: "Great value", body: "Quality is superb for the price. Packaged really well and arrived quickly. Would definitely buy from here again." },
    { title: "Five stars", body: "Consistent, comfortable and looks great. My elbow is much happier than with my old hard-core racket." },
  ],
  4: [
    { title: "Very good, slight adjustment period", body: "Took a couple of games to get used to the balance but now I love it. Would have liked a cover included." },
    { title: "Solid choice", body: "Does everything well. Not the most powerful but very forgiving. Fast dispatch and good communication." },
    { title: "Happy with it", body: "Good feel and spin. Grip was a little thin for me so I added an overgrip — sorted." },
  ],
  3: [
    { title: "Decent but not for me", body: "Nice build quality but a bit too head-heavy for my style. Returns process was easy though." },
  ],
  2: [{ title: "Wore faster than expected", body: "Fine at first but didn't last as long as I'd hoped on our outdoor courts." }],
};

async function wipe() {
  // Order matters for FK constraints.
  await db.$transaction([
    db.analyticsEvent.deleteMany(),
    db.gameListing.deleteMany(),
    db.venue.deleteMany(),
    db.chatMessage.deleteMany(),
    db.chatConversation.deleteMany(),
    db.returnRequest.deleteMany(),
    db.contactMessage.deleteMany(),
    db.newsletterSubscriber.deleteMany(),
    db.emailLog.deleteMany(),
    db.shipment.deleteMany(),
    db.orderEvent.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.cartItem.deleteMany(),
    db.cart.deleteMany(),
    db.backInStockAlert.deleteMany(),
    db.wishlistItem.deleteMany(),
    db.review.deleteMany(),
    db.productVariant.deleteMany(),
    db.product.deleteMany(),
    db.category.deleteMany(),
    db.brand.deleteMany(),
    db.discount.deleteMany(),
    db.giftCard.deleteMany(),
    db.address.deleteMany(),
    db.account.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
  ]);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "true") {
    throw new Error("Refusing to seed in production (this wipes data). Set SEED_FORCE=true to override.");
  }
  console.log("Wiping existing data…");
  await wipe();

  console.log("Brands & categories…");
  const brandIds = new Map<string, string>();
  for (const b of BRANDS) brandIds.set(b.slug, (await db.brand.create({ data: b })).id);
  const catIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const first = PRODUCTS.find((p) => p.category === c.slug);
    catIds.set(c.slug, (await db.category.create({ data: { ...c, image: first ? `/images/products/${first.slug}-1.svg` : null } })).id);
  }

  console.log("Users…");
  const adminPass = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "CourtlineAdmin!2026", 10);
  const demoPass = await bcrypt.hash("PadelDemo!2026", 10);
  const adminEmail = (process.env.ADMIN_EMAILS ?? "admin@courtline.test").split(",")[0]!.trim().toLowerCase();
  await db.user.create({ data: { email: adminEmail, name: "Store Admin", role: "ADMIN", passwordHash: adminPass, emailVerified: new Date() } });
  const demo = await db.user.create({
    data: {
      email: "demo@courtline.test",
      name: "Sam Carter",
      passwordHash: demoPass,
      emailVerified: new Date(),
      marketingOptIn: true,
      addresses: {
        create: [
          { label: "Home", name: "Sam Carter", line1: "14 Ancoats Street", city: "Manchester", postcode: "M4 6DE", phone: "07700 900123", isDefault: true },
          { label: "Work", name: "Sam Carter", line1: "2 Spinningfields Square", line2: "Floor 5", city: "Manchester", postcode: "M3 3AP" },
        ],
      },
    },
  });
  const community = await Promise.all(
    ["Priya Patel", "Tom Hughes", "Niamh Murphy"].map((name, i) =>
      db.user.create({ data: { email: `player${i + 1}@courtline.test`, name, passwordHash: demoPass, emailVerified: new Date() } }),
    ),
  );

  console.log("Products…");
  const variantIndex: { id: string; productId: string; sku: string; name: string; productName: string; price: number; image: string; weight: number; category: string; best: boolean }[] = [];
  for (const p of PRODUCTS) {
    const created = await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        categoryId: catIds.get(p.category)!,
        brandId: brandIds.get(p.brand)!,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        images: [1, 2, 3].map((n) => `/images/products/${p.slug}-${n}.svg`),
        specs: p.specs as Prisma.InputJsonValue,
        weightGrams: p.weightGrams,
        shape: p.shape,
        skillLevel: p.skillLevel,
        balance: p.balance,
        shippingWeight: p.shippingWeight,
        isFeatured: p.isFeatured ?? false,
        isBestSeller: p.isBestSeller ?? false,
        isNew: p.isNew ?? false,
        isPlaceholder: CATEGORIES.find((c) => c.slug === p.category)!.isPlaceholder,
        createdAt: daysAgo(p.daysOld, 9),
        variants: { create: p.variants.map((v, i) => ({ ...v, sortOrder: i })) },
      },
      include: { variants: true },
    });
    for (const v of created.variants) {
      variantIndex.push({
        id: v.id, productId: created.id, sku: v.sku, name: v.name, productName: created.name, price: v.price ?? created.price,
        image: created.images[0]!, weight: created.shippingWeight, category: p.category, best: created.isBestSeller,
      });
    }

    // Reviews
    const count = p.category === "rackets" || p.category === "balls" ? int(3, 11) : int(0, 3);
    const reviews: Prisma.ReviewCreateManyInput[] = [];
    for (let i = 0; i < count; i++) {
      const r = rand();
      const rating = r < 0.62 ? 5 : r < 0.88 ? 4 : r < 0.96 ? 3 : 2;
      const t = pick(REVIEW_TEMPLATES[rating]!);
      reviews.push({
        productId: created.id,
        authorName: `${pick(FIRST)} ${pick(LAST)[0]}.`,
        rating,
        title: t.title,
        body: t.body,
        verified: rand() < 0.85,
        status: "APPROVED",
        createdAt: daysAgo(int(1, Math.max(2, p.daysOld))),
      });
    }
    if (reviews.length) {
      await db.review.createMany({ data: reviews });
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await db.product.update({ where: { id: created.id }, data: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: reviews.length } });
    }
  }
  await db.review.create({
    data: {
      productId: variantIndex[0]!.productId,
      authorName: "Pending P.",
      rating: 4,
      title: "Awaiting moderation example",
      body: "This review is pending approval — approve or reject it in Admin → Reviews.",
      status: "PENDING",
    },
  });

  console.log("Discounts & gift cards…");
  await db.discount.createMany({
    data: [
      { code: "WELCOME10", description: "10% off your first order", type: "PERCENT", value: 10 },
      { code: "FREESHIP", description: "Free delivery on any order", type: "FREE_SHIPPING", value: 0 },
      { code: "SAVE15", description: "£15 off orders over £100", type: "FIXED", value: 1500, minSubtotal: 10000 },
      { code: "SUMMER25", description: "Expired summer promo", type: "PERCENT", value: 25, endsAt: daysAgo(40), active: true },
    ],
  });
  await db.giftCard.createMany({
    data: [
      { code: "GIFT-DEMO-25", initialBalance: 2500, balance: 2500, note: "Demo gift card" },
      { code: "GIFT-DEMO-500", initialBalance: 50000, balance: 50000, note: "Demo card large enough to cover a full order" },
    ],
  });

  console.log("Venues & community…");
  await db.venue.createMany({ data: VENUES.map((v) => ({ ...v, isDemo: true })) });
  const levels = ["Beginner (0–2)", "Improver (2–3)", "Intermediate (3–4)", "Advanced (4–5)"];
  const games = [
    { title: "Need a 4th for Saturday doubles", city: "Manchester", venueName: "Northern Quarter Padel (demo)", level: levels[2]!, players: 1 },
    { title: "Friendly mixed game after work", city: "London", venueName: "Thames Riverside Padel (demo)", level: levels[1]!, players: 2 },
    { title: "Beginners welcome — Sunday morning", city: "Leeds", venueName: "Leeds Dock Padel (demo)", level: levels[0]!, players: 2 },
    { title: "Competitive 2v2, looking for a pair", city: "Glasgow", venueName: "Glasgow Clyde Padel (demo)", level: levels[3]!, players: 2 },
  ];
  for (const [i, g] of games.entries()) {
    const when = new Date();
    when.setDate(when.getDate() + 2 + i * 2);
    when.setHours(18 + (i % 3), 0, 0, 0);
    await db.gameListing.create({
      data: {
        userId: community[i % community.length]!.id,
        title: g.title,
        city: g.city,
        venueName: g.venueName,
        level: g.level,
        playDate: when,
        playersNeeded: g.players,
        description: "Court is booked — just split the cost on the day. Bring your own racket, balls provided.",
        contact: "Message me on the community board or email via my profile",
      },
    });
  }

  console.log("Demo order history…");
  const inStock = variantIndex.filter((v) => v.category === "rackets" || v.category === "balls");
  const weighted = inStock.flatMap((v) => (v.best ? [v, v, v] : [v]));
  const salesByProduct = new Map<string, number>();
  const ordersByDay = new Map<number, number>();
  for (let n = 0; n < 145; n++) {
    const age = Math.floor(Math.pow(rand(), 1.3) * 75);
    const created = daysAgo(age);
    const first = pick(FIRST), last = pick(LAST);
    const [city, postcode] = pick(CITIES);
    const isDemoUser = n % 40 === 0;
    const lines = new Map<string, { v: (typeof inStock)[number]; qty: number }>();
    const nLines = rand() < 0.55 ? 1 : rand() < 0.8 ? 2 : 3;
    for (let i = 0; i < nLines; i++) {
      const v = pick(weighted);
      const ex = lines.get(v.id);
      lines.set(v.id, { v, qty: (ex?.qty ?? 0) + (v.category === "balls" ? int(1, 3) : 1) });
    }
    const method = rand() < 0.65 ? SHIPPING_METHODS[0]! : rand() < 0.6 ? SHIPPING_METHODS[1]! : SHIPPING_METHODS[2]!;
    const discount = rand() < 0.12 ? { code: "WELCOME10", type: "PERCENT" as const, value: 10, minSubtotal: 0, startsAt: null, endsAt: null, usageLimit: null, usageCount: 0, active: true } : null;
    const items = [...lines.values()];
    const totals = computeTotals({ lines: items.map((l) => ({ unitPrice: l.v.price, quantity: l.qty })), shippingMethodId: method.id, discount });
    const status: OrderStatus = age > 7 ? (rand() < 0.04 ? "REFUNDED" : "DELIVERED") : age > 3 ? "SHIPPED" : age > 0 ? (rand() < 0.5 ? "PACKED" : "SHIPPED") : "PAID";
    const plus = (d: number) => new Date(created.getTime() + d * 86400000);
    const tracking = status === "PAID" ? null : `${method.carrier === "Evri" ? "H01" : "RM"}${String(int(100000000, 999999999))}GB`;
    await db.order.create({
      data: {
        userId: isDemoUser ? demo.id : null,
        email: isDemoUser ? demo.email : `${first}.${last}${n}@example.com`.toLowerCase(),
        status,
        source: "seed",
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        shippingTotal: totals.shippingTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        shippingMethod: method.name,
        carrier: method.carrier,
        discountCode: discount?.code,
        paymentProvider: "stripe",
        paymentMethodSummary: pick(["VISA •••• 4242", "MASTERCARD •••• 4444", "VISA •••• 1881 (apple pay)", "AMEX •••• 0005", "link"]),
        shippingAddress: isDemoUser
          ? { name: "Sam Carter", line1: "14 Ancoats Street", city: "Manchester", postcode: "M4 6DE", country: "GB" }
          : { name: `${first} ${last}`, line1: `${int(1, 180)} ${pick(STREETS)}`, city, postcode, country: "GB" },
        trackingNumber: tracking,
        createdAt: created,
        paidAt: created,
        packedAt: status === "PAID" ? null : plus(0.2),
        shippedAt: ["SHIPPED", "DELIVERED", "REFUNDED"].includes(status) ? plus(0.4) : null,
        deliveredAt: status === "DELIVERED" ? plus(2) : null,
        refundedAt: status === "REFUNDED" ? plus(6) : null,
        items: {
          create: items.map((l) => ({
            productId: l.v.productId, variantId: l.v.id, name: l.v.productName, variantName: l.v.name,
            sku: l.v.sku, image: l.v.image, unitPrice: l.v.price, quantity: l.qty,
          })),
        },
        events: { create: [{ type: "paid", message: "Payment received (seeded demo order)", createdAt: created }] },
      },
    });
    for (const l of items) salesByProduct.set(l.v.productId, (salesByProduct.get(l.v.productId) ?? 0) + l.qty);
    ordersByDay.set(age, (ordersByDay.get(age) ?? 0) + 1);
  }
  for (const [productId, salesCount] of salesByProduct) await db.product.update({ where: { id: productId }, data: { salesCount } });

  console.log("Analytics events…");
  const products = await db.product.findMany({ select: { id: true, slug: true, category: { select: { slug: true } } } });
  const events: Prisma.AnalyticsEventCreateManyInput[] = [];
  for (let d = 75; d >= 0; d--) {
    const visitors = Math.round(70 + (75 - d) * 1.4 + rand() * 50);
    for (let v = 0; v < visitors; v++) {
      const hash = createHash("sha256").update(`seed-${d}-${v}`).digest("hex").slice(0, 32);
      const at = daysAgo(d);
      const views = int(1, 5);
      for (let i = 0; i < views; i++) {
        const pr = pick(products);
        const path = i === 0 ? "/" : rand() < 0.5 ? `/products/${pr.slug}` : `/c/${pr.category.slug}`;
        events.push({ type: "page_view", path, visitorHash: hash, createdAt: at });
        if (path.startsWith("/products")) events.push({ type: "product_view", path, productId: pr.id, visitorHash: hash, createdAt: at });
      }
      if (rand() < 0.07) events.push({ type: "add_to_cart", visitorHash: hash, createdAt: at });
      if (rand() < 0.035) events.push({ type: "checkout_started", visitorHash: hash, createdAt: at });
    }
    for (let o = 0; o < (ordersByDay.get(d) ?? 0); o++) {
      events.push({ type: "purchase", visitorHash: `seed-purchase-${d}-${o}`, createdAt: daysAgo(d) });
    }
  }
  for (let i = 0; i < events.length; i += 5000) await db.analyticsEvent.createMany({ data: events.slice(i, i + 5000) });

  await db.newsletterSubscriber.createMany({
    data: Array.from({ length: 24 }, (_, i) => ({ email: `subscriber${i + 1}@example.com`, source: i % 3 ? "footer" : "checkout", createdAt: daysAgo(int(0, 60)) })),
  });
  await db.contactMessage.create({
    data: { name: "Lucy Green", email: "lucy@example.com", subject: "Racket recommendation", message: "Hi — I'm an intermediate player with a sore elbow. Would the Glide Control or Fusion Control suit me better?" },
  });

  console.log(`Seeded ${PRODUCTS.length} products, ${variantIndex.length} variants, 145 demo orders, ${events.length} analytics events.`);
  console.log(`Admin login: ${adminEmail} / ${process.env.SEED_ADMIN_PASSWORD ? "(SEED_ADMIN_PASSWORD)" : "CourtlineAdmin!2026"}`);
  console.log("Customer login: demo@courtline.test / PadelDemo!2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
