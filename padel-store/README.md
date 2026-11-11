# Courtline Padel — UK padel e-commerce store

A production-style online shop for padel equipment: Next.js 15 (App Router) + TypeScript + Tailwind v4, Postgres via Prisma, Auth.js, Stripe, Resend, Royal Mail Click & Drop / ShipStation, PrintNode, and Twilio WhatsApp. Deploys to Vercel.

**Every integration is optional.** With no keys at all, the store runs in demo mode: payments are simulated, emails go to an in-app outbox, labels are generated as demo PDFs, and printing is skipped. Add a key and that piece switches to the real service.

> This app lives in the `padel-store/` folder of the repository. The Discord bot in the repository root is unrelated.

---

## Contents

1. [Quick start (local)](#1-quick-start-local)
2. [Deploy to Vercel](#2-deploy-to-vercel)
3. [Environment variables](#3-environment-variables)
4. [Connect Stripe](#4-connect-stripe)
5. [Email (Resend)](#5-email-resend)
6. [Shipping labels: Royal Mail Click & Drop or ShipStation](#6-shipping-labels)
7. [Auto-printing labels with PrintNode](#7-auto-printing-with-printnode)
8. [Live chat → WhatsApp (Twilio), or Crisp / Tawk.to](#8-live-chat)
9. [Analytics](#9-analytics)
10. [Google sign-in](#10-google-sign-in)
11. [Admin guide](#11-admin-guide)
12. [Tests & quality checks](#12-tests--quality)
13. [Project structure](#13-project-structure)
14. [Going live checklist](#14-going-live-checklist)

---

## 1. Quick start (local)

Requirements: Node 20.9+ and Postgres 14+ (local, Docker, Neon or Supabase).

```bash
cd padel-store
cp .env.example .env            # then edit DATABASE_URL and AUTH_SECRET
npm install
npx prisma migrate deploy       # create tables
npm run db:seed                 # demo catalogue, users, orders, analytics (WIPES the DB)
npm run dev                     # http://localhost:3000
```

Docker Postgres one-liner:
`docker run -d --name padel-pg -e POSTGRES_USER=padel -e POSTGRES_PASSWORD=padel -e POSTGRES_DB=padel -p 5432:5432 postgres:16`

**Demo logins** (created by the seed):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@courtline.test` (or the first of `ADMIN_EMAILS`) | `CourtlineAdmin!2026` (or `SEED_ADMIN_PASSWORD`) |
| Customer | `demo@courtline.test` | `PadelDemo!2026` |

**Demo codes:** `WELCOME10` (10%), `FREESHIP`, `SAVE15` (£15 off £100+), `SUMMER25` (expired). Gift cards: `GIFT-DEMO-25`, `GIFT-DEMO-500`.

Set `NEXT_PUBLIC_DEMO_MODE=true` to show a demo banner and a step-by-step test guide at `/demo`.

Other scripts: `npm run images` regenerates the SVG product art; `npm run db:studio` opens Prisma Studio.

---

## 2. Deploy to Vercel

1. **Import the repo:** Vercel → *Add New → Project* → choose this repository and set **Root Directory = `padel-store`**. The framework is detected as Next.js. `vercel.json` sets the build command (`npm run vercel-build`) and the crons.
2. **Add a database:** *Project → Storage → Create Database → Neon (Postgres)* → connect it to the project. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically. Supabase also works; it sets `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`, which the build script also accepts.
3. **Add environment variables** (*Settings → Environment Variables*). The minimum is:
   - `AUTH_SECRET`: generate with `npx auth secret`
   - `CRON_SECRET`: any long random string
   - `ADMIN_EMAILS`: your email
   - For a demo: `DEMO_AUTO_SEED=true` and `NEXT_PUBLIC_DEMO_MODE=true`
4. **Deploy.** Each build runs `prisma migrate deploy`. With `DEMO_AUTO_SEED=true` it also seeds demo data, but only if the database is empty, so existing data is never wiped.
5. **Optional:** set `NEXT_PUBLIC_SITE_URL` once you add a custom domain. Until then it falls back to the Vercel production URL.

**Crons** (`vercel.json`): abandoned-basket emails run daily at 10:17 UTC. The "orders to pack" summary runs weekdays at 06:43 UTC. On a Pro plan you can make the abandoned-basket cron hourly (`17 * * * *`). Vercel authenticates cron calls with `CRON_SECRET`.

---

## 3. Environment variables

Every variable is listed and commented in [`.env.example`](./.env.example). Summary:

| Group | Variables | Needed for |
|---|---|---|
| Core | `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAILS`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL` | Required (site URL is auto on Vercel) |
| Business | `NEXT_PUBLIC_STORE_NAME`, `NEXT_PUBLIC_COMPANY_*`, `NEXT_PUBLIC_VAT_NUMBER`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_SUPPORT_*`, `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD` | Footer, invoices, emails, legal pages |
| Demo | `DEMO_AUTO_SEED`, `NEXT_PUBLIC_DEMO_MODE`, `SEED_ADMIN_PASSWORD` | Test deployments |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `DISABLE_SIMULATED_PAYMENTS` | Real payments |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `OWNER_NOTIFICATION_EMAIL` | Sending emails |
| Google | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | "Continue with Google" |
| Shipping | `SHIPPING_PROVIDER`, `FULFILMENT_AUTO_LABELS`, `SHIP_FROM_*`, `ROYALMAIL_*`, `SHIPSTATION_*` | Real labels |
| Printing | `PRINTNODE_API_KEY`, `PRINTNODE_PRINTER_ID`, `PRINTNODE_SLIP_PRINTER_ID`, `FULFILMENT_AUTO_PRINT`, `PRINT_DAILY_SLIPS` | Auto-print |
| Chat | `NEXT_PUBLIC_CHAT_PROVIDER`, `TWILIO_*`, `OWNER_WHATSAPP_TO`, `NEXT_PUBLIC_CRISP_WEBSITE_ID`, `NEXT_PUBLIC_TAWK_PROPERTY_ID` | WhatsApp / 3rd-party chat |
| Analytics | `NEXT_PUBLIC_VERCEL_ANALYTICS`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `ANALYTICS_SALT` | Traffic analytics |
| Tests | `TEST_DATABASE_URL` (must end in `_test`) | `npm test` |

*Admin → Integrations* shows which services are connected and which are stubbed.

---

## 4. Connect Stripe

1. Create a Stripe account, stay in **Test mode**, and go to *Developers → API keys*. Copy them into `STRIPE_SECRET_KEY` (`sk_test_…`) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`).
2. **Webhook:** go to *Developers → Webhooks → Add endpoint* and enter `https://YOUR_DOMAIN/api/webhooks/stripe`. Subscribe to `payment_intent.succeeded`, `payment_intent.payment_failed` and `charge.refunded`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   Locally, use `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the `whsec_…` secret it prints.
3. **Wallets:** under *Settings → Payment methods*, enable Apple Pay, Google Pay and Link (and Klarna/Clearpay if you want). For Apple Pay, also register your domain under *Payment method domains*.
4. Redeploy. Checkout now uses the Stripe **Payment Element**:
   - Signed-in customers can tick "save for future purchases".
   - Next time, saved cards appear as **one-click "Pay with Visa •••• 4242"** buttons. These confirm server-side, with 3-D Secure handled when the bank requires it.
   - Customers manage saved cards in *Account → Payment methods*.
5. Test cards: `4242 4242 4242 4242` (success), `4000 0027 6000 3184` (3-D Secure), `4000 0000 0000 9995` (declined).

How the flow works:
1. Checkout creates a `PENDING_PAYMENT` order with totals calculated on the server, plus a PaymentIntent.
2. The `payment_intent.succeeded` webhook verifies the signature and the amount, then marks the order paid exactly once. Paying decrements stock, redeems the discount and gift card, and clears the basket.
3. The webhook then sends the confirmation email, alerts the owner, creates the shipping label and sends it to the printer.
4. If the webhook is slow, the confirmation page also verifies the PaymentIntent itself. Both paths are idempotent.
5. Refunds issued from the admin go through the Stripe Refunds API. Refunds made in the Stripe dashboard sync back via `charge.refunded`.

Set `DISABLE_SIMULATED_PAYMENTS=true` in production so demo payments can never be used.

---

## 5. Email (Resend)

1. Create a [Resend](https://resend.com) account and verify your domain (*Domains → Add*, then add the DNS records).
2. Set `RESEND_API_KEY` and `EMAIL_FROM="Courtline Padel <orders@yourdomain.co.uk>"`.
3. Set `OWNER_NOTIFICATION_EMAIL` to receive new-order alerts, the daily packing summary and chat/contact notifications.

Emails sent:
- order confirmation (doubles as a VAT receipt)
- shipped (with tracking), delivered, refunded and cancelled
- magic-link sign-in
- abandoned basket
- back in stock
- newsletter welcome
- contact and return acknowledgements
- owner alerts

Every email is also logged in *Admin → Email outbox* with a preview.

---

## 6. Shipping labels

Labels are created automatically when an order is paid (`FULFILMENT_AUTO_LABELS=true`). They can also be created or recreated from the admin order page. Choose the provider with `SHIPPING_PROVIDER`:

- **`stub`** (default): generates a realistic 4×6" PDF marked "DEMO — not valid for postage".
- **`royalmail`**: Royal Mail Click & Drop API (`POST /api/v1/orders` with `includeLabelInResponse`).
  1. In Click & Drop: *Settings → Integrations → Add → Click & Drop API*. Copy the key into `ROYALMAIL_API_KEY`.
  2. Make sure **label printing via API** is enabled on your account. OLP (Online Postage) accounts can't fetch labels by API, so you need a Click & Drop / OBA account.
  3. Set `ROYALMAIL_SERVICE_TRACKED24` and `ROYALMAIL_SERVICE_TRACKED48` to the service codes shown in your account. The defaults are placeholders: **check them**.
  4. Note: Evri orders are sent as Tracked 48 via Click & Drop. Use ShipStation if you want real Evri labels.
- **`shipstation`**: ShipStation v1 API (`/shipments/createlabel`).
  1. In ShipStation: *Settings → Account → API Settings*. Copy the key and secret into `SHIPSTATION_API_KEY` and `SHIPSTATION_API_SECRET`.
  2. Connect Royal Mail and Evri carriers in ShipStation, then set the `SHIPSTATION_CARRIER_*` and `SHIPSTATION_SERVICE_*` codes (list them via `GET /carriers`).
  3. Leave `SHIPSTATION_TEST_LABELS=true` until you're ready to buy postage.

Parcel format is chosen automatically:
- rackets and bags → medium parcel
- grips and accessories only → large letter
- everything else → small parcel

Weight is the sum of each product's "packed weight" plus 150 g of packaging.

---

## 7. Auto-printing with PrintNode

The goal is that labels are printed and waiting when you get home.

1. Sign up at [printnode.com](https://www.printnode.com) and install the **PrintNode client** on a computer that stays on and is connected to your label printer (e.g. a 4×6" thermal printer). Optionally connect an A4 printer for packing slips too.
2. *Account → API Keys*: create a key and set `PRINTNODE_API_KEY`.
3. Copy the printer ID shown in the PrintNode client into `PRINTNODE_PRINTER_ID`. Optionally set `PRINTNODE_SLIP_PRINTER_ID` for the A4 printer.
4. With `FULFILMENT_AUTO_PRINT=true` (the default), every paid order sends its **label and packing slip** to the printer. If a print fails, it shows in the order's activity log and you can reprint from admin.
5. Optional: `PRINT_DAILY_SLIPS=true` also prints all outstanding packing slips each morning with the summary cron.

Without PrintNode you can print everything from admin:
- per-order label and packing slip PDFs
- all packing slips in one PDF
- a printable daily summary with a pick list

---

## 8. Live chat

The built-in chat widget (`NEXT_PUBLIC_CHAT_PROVIDER=internal`) stores conversations and shows them in *Admin → Live chat*. The admin area is mobile-friendly, so **this works from your phone with no setup**.

**Recommended: route chats to WhatsApp via Twilio**
1. Create a [Twilio](https://twilio.com) account and enable WhatsApp:
   - For testing, use the *WhatsApp Sandbox* (*Messaging → Try it out → Send a WhatsApp message*) and join it from your phone.
   - For production, register a WhatsApp sender (*Messaging → Senders → WhatsApp senders*). This needs a Meta Business account.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_FROM` (the Twilio WhatsApp number). Set `OWNER_WHATSAPP_TO` to your own mobile, e.g. `+447700900456`.
3. In Twilio, set the sender's (or sandbox's) **incoming message webhook** to `https://YOUR_DOMAIN/api/chat/whatsapp` (HTTP POST). If your URL differs from `NEXT_PUBLIC_SITE_URL`, set `TWILIO_WEBHOOK_URL` to exactly what Twilio calls; signatures are verified against it.
4. Visitor messages now arrive on your WhatsApp as `💬 #AB12 Sam: …`.
   - **Reply to that WhatsApp message** (swipe to reply) and your answer goes straight back to that visitor's chat window.
   - Alternatively, start your message with `#AB12`.
   - A plain message goes to the most recent open chat.
5. WhatsApp rule: you can only send free-form messages within 24 hours of *you* messaging the business number. To get notifications outside that window, create an approved **template** with one `{{1}}` variable and set `TWILIO_WHATSAPP_TEMPLATE_SID` (`HX…`).

If WhatsApp isn't configured or fails, the first message of each chat is emailed to `OWNER_NOTIFICATION_EMAIL`.

**Alternatives:** set `NEXT_PUBLIC_CHAT_PROVIDER=crisp` (with `NEXT_PUBLIC_CRISP_WEBSITE_ID`) or `tawk` (with `NEXT_PUBLIC_TAWK_PROPERTY_ID`) to use their widget and free mobile apps. These load only after the visitor accepts functional cookies.

---

## 9. Analytics

- **Sales dashboard** (*Admin*) uses your own data:
  - revenue, orders, AOV, conversion rate
  - revenue by day/week/month
  - funnel and top products
  - a toggle to exclude seeded demo data
- **Visitor counts** come from a first-party, **cookieless** counter: a daily-rotating salted hash of IP and user agent. Nothing is stored on the device, so no consent is needed.
- **Traffic sources and devices:**
  - **Vercel Web Analytics:** enable it in *Project → Analytics*. It's on by default (`NEXT_PUBLIC_VERCEL_ANALYTICS`).
  - **Plausible:** add your site at plausible.io and set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
  - Both are injected only after the visitor accepts analytics cookies (UK GDPR / PECR).

---

## 10. Google sign-in

1. Go to [Google Cloud Console](https://console.cloud.google.com) → *APIs & Services → OAuth consent screen* (External), then *Credentials → Create OAuth client ID → Web application*.
2. Add the authorised redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local use).
3. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. The "Continue with Google" button appears automatically.

Magic-link sign-in uses the same email setup (Resend). Without a key, the link is printed to the server log in development.

---

## 11. Admin guide

Admin access is restricted to the `ADMIN` role, and the role is re-checked against the database on every request. Emails listed in `ADMIN_EMAILS` are promoted automatically.

- **Dashboard:** KPIs, charts, funnel, low stock.
- **Orders:**
  - search and filter, then open an order to move it through **paid → packed → shipped → delivered → refunded**
  - shipping sends a tracking email; refunds go back via Stripe and restock the items
  - add notes, recreate or print labels, download the packing slip and VAT invoice
- **Fulfilment:** queue of orders to pack, bulk pack/ship, pick list, all packing slips, daily summary.
- **Products:**
  - placeholder products (shoes, bags, clothing, …) carry a **Placeholder** badge and filter. Customers never see it.
  - edit details, images (URLs), specs, filters and variants with stock
- **Stock:** one sheet for all variants. Restocking an item emails anyone who asked to be notified.
- Categories, discounts and gift cards, review moderation, customers, CSV exports (orders and subscribers).
- Live chat, contact and returns queue, community board moderation, email outbox, integration status.

To swap placeholder products for real stock, edit them (untick **Placeholder**) or archive them and add new ones. Images can be any `https://` URL; Vercel Blob URLs are pre-allowed.

---

## 12. Tests & quality

```bash
npm run typecheck     # TypeScript, strict
npm run lint          # ESLint (next/core-web-vitals + typescript), zero warnings
npm test              # Vitest: pricing/VAT unit tests + DB integration tests (needs TEST_DATABASE_URL)
npm run build && npm start
npm run test:e2e      # Playwright against the running server
CHROME_PATH=/path/to/chrome scripts/lighthouse.sh   # Lighthouse (mobile) on 10 key pages
```

Coverage:
- **Integration:** the Stripe webhook (signature check, idempotency, amount mismatch, dashboard refunds), checkout (server-side totals, stock checks, gift cards, refunds and restock, shipping email) and auth (registration, hashing, credentials, admin promotion).
- **End-to-end:** guest checkout on desktop and mobile, a declined card, register → checkout → "Buy again", the admin fulfilment workflow, and the live-chat round trip.

The integration tests truncate the test database. They refuse to run unless its name ends in `_test`.

Last measured Lighthouse scores (mobile, throttled, production build): every storefront page scores ≥ 91 in all four categories, most 94–100. Checkout and admin are intentionally excluded from search indexing.

---

## 13. Project structure

```
padel-store/
├─ prisma/            schema, migrations, demo catalogue (catalog.ts), seed
├─ scripts/           SVG product-art generator, Vercel build, Lighthouse runner
├─ src/app/(shop)/    storefront: home, /c/[slug], /products/[slug], cart, checkout, account, help, find-a-game, policies…
├─ src/app/admin/     admin dashboard
├─ src/app/api/       cart, checkout, Stripe webhook, chat + WhatsApp webhook, crons, PDFs, search
├─ src/lib/           pricing, cart, orders, payments, fulfilment (providers, PDFs, PrintNode), chat, email, analytics
├─ src/content/       legal page templates
└─ tests/             vitest (unit + integration) and Playwright e2e
```

---

## 14. Going live checklist

- [ ] **Legal pages** (`src/content/policies.tsx`) are templates. **Have them reviewed by a solicitor** and fill in the highlighted `[[…]]` placeholders (ICO registration, providers, return postage).
- [ ] Register with the ICO (data protection fee) and add your real company and VAT details via the `NEXT_PUBLIC_*` variables.
- [ ] Switch Stripe to live keys and set `DISABLE_SIMULATED_PAYMENTS=true`. Remove `DEMO_AUTO_SEED` and `NEXT_PUBLIC_DEMO_MODE`.
- [ ] Replace the demo admin password (or delete the seeded users) and set `ADMIN_EMAILS` to your address.
- [ ] Replace placeholder products and demo venues. Product images are generated SVG illustrations, so replace them with real photos.
- [ ] Set up a custom domain with `NEXT_PUBLIC_SITE_URL`, the Stripe Apple Pay domain, and Resend domain verification.
- [ ] Confirm the Royal Mail / ShipStation service codes with a test label.
