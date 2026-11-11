import Link from "next/link";
import { store } from "@/lib/config";

/**
 * Legal page TEMPLATES for a UK online retailer.
 * ⚠️ These are starting points only and MUST be reviewed by a qualified
 * professional (solicitor / data-protection adviser) before going live.
 * Search for "[[" to find placeholders that need your real details.
 */

export interface Policy {
  slug: string;
  title: string;
  description: string;
  updated: string;
  body: React.ReactNode;
}

const UPDATED = "11 November 2026";
const co = store.companyName;

const Placeholder = ({ children }: { children: React.ReactNode }) => <mark className="rounded bg-amber-100 px-1">[[{children}]]</mark>;

export const POLICIES: Policy[] = [
  {
    slug: "privacy",
    title: "Privacy policy",
    description: "How we collect, use and protect your personal data under UK GDPR and the Data Protection Act 2018.",
    updated: UPDATED,
    body: (
      <>
        <h2>1. Who we are</h2>
        <p>
          {co} (company number {store.companyNumber}, registered office {store.address}) is the controller of your personal data. Contact our data
          protection lead at <a href={`mailto:${store.email}`}>{store.email}</a>. ICO registration number: <Placeholder>ICO registration number</Placeholder>.
        </p>
        <h2>2. The data we collect</h2>
        <ul>
          <li><strong>Identity & contact:</strong> name, email, phone, delivery and billing addresses.</li>
          <li><strong>Account:</strong> login details (passwords are stored only as one-way hashes), saved addresses, wishlist, marketing preferences.</li>
          <li><strong>Orders:</strong> products bought, amounts, delivery method, order history, returns.</li>
          <li><strong>Payment:</strong> processed by Stripe. We receive only the card brand, last four digits and expiry — never full card numbers.</li>
          <li><strong>Communications:</strong> live-chat messages, contact-form and returns requests, reviews, community board posts.</li>
          <li><strong>Technical:</strong> a daily-rotating, anonymised visitor identifier (a one-way hash of IP address and browser, reset every 24 hours) used to count visits; security logs.</li>
          <li><strong>Analytics (with consent only):</strong> aggregated usage statistics via Vercel Web Analytics and/or Plausible.</li>
        </ul>
        <h2>3. How and why we use it (lawful bases)</h2>
        <table>
          <thead><tr><th>Purpose</th><th>Lawful basis</th></tr></thead>
          <tbody>
            <tr><td>Processing and delivering orders, returns and refunds; order emails</td><td>Contract</td></tr>
            <tr><td>Keeping accounting and VAT records (6 years)</td><td>Legal obligation</td></tr>
            <tr><td>Fraud prevention and site security</td><td>Legitimate interests</td></tr>
            <tr><td>Reminding you about a basket you started checking out</td><td>Legitimate interests (you can opt out at any time)</td></tr>
            <tr><td>Marketing emails</td><td>Consent, or “soft opt-in” for existing customers with an easy opt-out (PECR reg. 22)</td></tr>
            <tr><td>Anonymous visit counting to improve the shop</td><td>Legitimate interests</td></tr>
            <tr><td>Optional analytics and chat cookies</td><td>Consent</td></tr>
          </tbody>
        </table>
        <h2>4. Who we share it with</h2>
        <p>We use trusted processors under written contracts: Stripe (payments), Royal Mail / Evri and our label provider <Placeholder>Click &amp; Drop or ShipStation</Placeholder> (delivery), PrintNode (label printing), Resend (email), Vercel (hosting and analytics), <Placeholder>database host, e.g. Supabase/Neon</Placeholder> (database), Twilio/Meta (if you use live chat and we reply via WhatsApp), Google (if you sign in with Google). We never sell your data.</p>
        <h2>5. International transfers</h2>
        <p>Some processors are based in, or access data from, the USA. Transfers are protected by the UK International Data Transfer Addendum, the UK Extension to the EU-US Data Privacy Framework, or equivalent safeguards.</p>
        <h2>6. How long we keep it</h2>
        <ul>
          <li>Order and invoice records: 6 years after the end of the financial year (HMRC).</li>
          <li>Accounts: until you delete your account, or after <Placeholder>3</Placeholder> years of inactivity.</li>
          <li>Chat and contact messages: 12 months. Abandoned baskets: 60 days.</li>
          <li>Marketing preferences: until you unsubscribe (we keep a suppression record so we don&apos;t contact you again).</li>
        </ul>
        <h2>7. Your rights</h2>
        <p>You have the right to access, rectify, erase, restrict or object to processing of your data, and to data portability. Signed-in customers can download their data and delete their account from <Link href="/account/settings">account settings</Link>. Otherwise email us — we respond within one month. You can complain to the Information Commissioner&apos;s Office (ico.org.uk, 0303 123 1113).</p>
        <h2>8. Children</h2>
        <p>Our shop is not directed at children under 13 and we don&apos;t knowingly collect their data. Junior rackets must be purchased by an adult.</p>
        <h2>9. Changes</h2>
        <p>We&apos;ll post any changes here and, where significant, tell you by email.</p>
      </>
    ),
  },
  {
    slug: "cookies",
    title: "Cookie policy",
    description: "The cookies and similar technologies we use, and how to control them.",
    updated: UPDATED,
    body: (
      <>
        <p>Under the Privacy and Electronic Communications Regulations (PECR) we only store information on your device without consent where it is <strong>strictly necessary</strong> to provide the service you&apos;ve asked for. Everything else is off until you opt in via our cookie banner, and you can change your mind any time using “Cookie settings” in the footer.</p>
        <h2>Strictly necessary (always on)</h2>
        <table>
          <thead><tr><th>Name</th><th>Provider</th><th>Purpose</th><th>Expires</th></tr></thead>
          <tbody>
            <tr><td>cl_cart</td><td>Courtline</td><td>Remembers your basket</td><td>60 days</td></tr>
            <tr><td>cl_consent</td><td>Courtline</td><td>Stores your cookie choices</td><td>6 months</td></tr>
            <tr><td>authjs.session-token, authjs.csrf-token, authjs.callback-url</td><td>Courtline</td><td>Keeps you signed in securely; protects forms</td><td>Session – 30 days</td></tr>
            <tr><td>cl_chat</td><td>Courtline</td><td>Links you to your live-chat conversation (only if you start a chat)</td><td>30 days</td></tr>
            <tr><td>cl_wishlist (local storage)</td><td>Courtline</td><td>Saves items you add to your wishlist</td><td>Until cleared</td></tr>
            <tr><td>__stripe_mid, __stripe_sid</td><td>Stripe</td><td>Fraud prevention during checkout</td><td>1 year / 30 minutes</td></tr>
          </tbody>
        </table>
        <h2>Functional (opt-in)</h2>
        <table>
          <thead><tr><th>Name</th><th>Provider</th><th>Purpose</th><th>Expires</th></tr></thead>
          <tbody>
            <tr><td>cl_recent (local storage)</td><td>Courtline</td><td>Shows products you recently viewed</td><td>Until cleared</td></tr>
            <tr><td>crisp-client/* or Tawk cookies</td><td>Crisp / Tawk.to</td><td>Third-party live chat, only if we enable it instead of our built-in chat</td><td>Up to 6 months</td></tr>
          </tbody>
        </table>
        <h2>Analytics (opt-in)</h2>
        <p>With consent we load Vercel Web Analytics and/or Plausible. Both are designed to be cookieless and don&apos;t track you across sites, but we still ask first.</p>
        <h2>Cookieless visit counting</h2>
        <p>Our own sales dashboard counts visits using a one-way hash of your IP address and browser combined with a secret that changes every day. Nothing is stored on your device and you can&apos;t be recognised from one day to the next.</p>
        <h2>Maps</h2>
        <p>The court-finder map loads map images from OpenStreetMap only when you click “Show map”. OpenStreetMap receives your IP address to deliver the images.</p>
      </>
    ),
  },
  {
    slug: "terms",
    title: "Terms & conditions",
    description: "The terms that apply when you buy from Courtline Padel.",
    updated: UPDATED,
    body: (
      <>
        <h2>1. About us</h2>
        <p>This website is operated by {co}, a company registered in England and Wales (no. {store.companyNumber}), registered office {store.address}, VAT no. {store.vatNumber}. Contact: <a href={`mailto:${store.email}`}>{store.email}</a>.</p>
        <h2>2. These terms</h2>
        <p>These terms apply to every order placed by consumers in the UK. Please read them before ordering. Nothing in these terms affects your statutory rights under the Consumer Rights Act 2015 or the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013.</p>
        <h2>3. Ordering and contract</h2>
        <p>When you place an order you&apos;ll receive an email confirming we&apos;ve received it. The contract is formed when we dispatch the goods and email you to confirm. If we can&apos;t accept your order (for example the item is out of stock or there&apos;s a pricing error) we&apos;ll tell you and won&apos;t charge you (or will refund you in full).</p>
        <h2>4. Prices and payment</h2>
        <p>Prices are in pounds sterling and include VAT at the current rate. Delivery charges are shown at checkout. Payment is taken when you place your order and processed securely by Stripe. If we discover an obvious pricing error we&apos;ll contact you before processing.</p>
        <h2>5. Delivery</h2>
        <p>See our <Link href="/policies/shipping">delivery policy</Link>. Risk passes to you on delivery. If your order hasn&apos;t arrived within 30 days we&apos;ll refund you in full.</p>
        <h2>6. Your right to cancel</h2>
        <p>You may cancel your order for any reason within 14 days of the day after you receive the goods. Tell us using our <Link href="/returns">returns form</Link> or by email, then return the goods within 14 days of telling us. We&apos;ll refund the price and standard delivery cost within 14 days of receiving the goods (or proof of return). You pay the cost of returning goods unless they&apos;re faulty. We may reduce a refund if goods have been handled more than necessary to establish their nature, characteristics and functioning (e.g. a racket used on court). A model cancellation form is available on request. Our <Link href="/policies/returns">30-day returns policy</Link> is in addition to these rights.</p>
        <h2>7. Faulty goods</h2>
        <p>Under the Consumer Rights Act 2015 goods must be as described, fit for purpose and of satisfactory quality. If they&apos;re not, you&apos;re entitled to a full refund within 30 days, and to a repair or replacement after that (or a refund if repair/replacement fails). Normal wear and tear, impact damage (e.g. hitting the wall or floor) and misuse are not faults.</p>
        <h2>8. Our liability</h2>
        <p>We are responsible for loss or damage you suffer that is a foreseeable result of our breaking these terms or failing to use reasonable care. We don&apos;t exclude liability for death or personal injury caused by our negligence, fraud, or breach of your statutory rights. We supply products for private use only.</p>
        <h2>9. Discount codes and gift cards</h2>
        <p>One discount code per order; codes can&apos;t be exchanged for cash and may have conditions shown at checkout. Gift cards are valid for 24 months from issue, can be used across multiple orders, and are not refundable or exchangeable for cash except where required by law.</p>
        <h2>10. Reviews and community content</h2>
        <p>Content you post (reviews, community listings) must be honest, lawful and not offensive. We moderate content and may remove anything that breaches these terms. You&apos;re responsible for arrangements you make with other players through the community board.</p>
        <h2>11. Disputes</h2>
        <p>Please contact us first and we&apos;ll do our best to resolve any problem. These terms are governed by the law of England and Wales; you may bring proceedings in the courts of England and Wales, or of Scotland or Northern Ireland if you live there.</p>
      </>
    ),
  },
  {
    slug: "returns",
    title: "Returns & refunds policy",
    description: "30-day returns plus your statutory 14-day right to cancel under the Consumer Contracts Regulations.",
    updated: UPDATED,
    body: (
      <>
        <h2>Your legal right to cancel (14 days)</h2>
        <p>Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 you can cancel your order within 14 days, starting the day after you receive your goods, without giving a reason. You then have a further 14 days to send the goods back. We&apos;ll refund the item price and the cost of standard delivery (if you paid for faster delivery we only refund the standard rate) within 14 days of receiving the goods back or proof of return.</p>
        <h2>Our 30-day returns promise</h2>
        <p>On top of your legal rights, you can return unused items in their original condition and packaging within <strong>30 days of delivery</strong> for a full refund or exchange.</p>
        <h2>How to return</h2>
        <ol>
          <li>Complete our <Link href="/returns">returns form</Link> (or email us) with your order number.</li>
          <li>We&apos;ll email instructions within one working day.</li>
          <li>Pack items securely, ideally in the original packaging, with racket protective film still attached.</li>
          <li>Send it back using a tracked service and keep your proof of postage.</li>
        </ol>
        <h2>Return postage</h2>
        <p>Change-of-mind returns: you pay return postage (<Placeholder>or: we provide a prepaid label for £X deducted from your refund</Placeholder>). Faulty, damaged or incorrect items: we pay and will send a prepaid label or arrange collection.</p>
        <h2>Condition of returned goods</h2>
        <p>You can inspect items as you would in a shop. If a racket has been used on court, or items show wear, we may reduce your refund to reflect the loss in value, as the law allows. Hygiene-sealed items (e.g. overgrips) can only be returned unopened unless faulty.</p>
        <h2>Faulty items</h2>
        <p>Your rights under the Consumer Rights Act 2015 apply: full refund within 30 days of delivery, or repair/replacement after that. Rackets carry a 2-year manufacturer warranty covering manufacturing defects (not impact damage or normal wear). Please email photos of any fault so we can help quickly.</p>
        <h2>Refunds</h2>
        <p>Refunds go back to your original payment method within 5 working days of receiving your return (and always within the 14-day legal limit). Gift-card payments are refunded to a gift card.</p>
      </>
    ),
  },
  {
    slug: "shipping",
    title: "Delivery policy",
    description: "UK delivery options, costs and dispatch times.",
    updated: UPDATED,
    body: (
      <>
        <table>
          <thead><tr><th>Service</th><th>Cost</th><th>Delivery time</th></tr></thead>
          <tbody>
            <tr><td>Royal Mail Tracked 48</td><td>£3.99 — FREE over £50</td><td>2–3 working days</td></tr>
            <tr><td>Evri Standard</td><td>£3.49 — FREE over £50</td><td>2–4 working days</td></tr>
            <tr><td>Royal Mail Tracked 24</td><td>£5.99</td><td>Next working day (order by 2pm)</td></tr>
          </tbody>
        </table>
        <h2>Dispatch</h2>
        <p>Orders placed before 2pm Monday–Friday (excluding bank holidays) are dispatched the same working day. Orders after 2pm or at weekends are dispatched the next working day.</p>
        <h2>Where we deliver</h2>
        <p>We currently deliver to UK addresses only. Deliveries to the Scottish Highlands, islands and Northern Ireland may take 1–2 extra days. We can&apos;t deliver to BFPO addresses at present.</p>
        <h2>Tracking</h2>
        <p>All parcels are tracked. You&apos;ll get an email with your tracking link when your order ships, and you can check progress any time on our <Link href="/track">order tracking page</Link>.</p>
        <h2>Missing or damaged parcels</h2>
        <p>If your parcel hasn&apos;t arrived within 5 working days of the estimated date, or arrives damaged, contact us and we&apos;ll put it right — the goods remain our responsibility until they&apos;re delivered to you.</p>
      </>
    ),
  },
  {
    slug: "accessibility",
    title: "Accessibility statement",
    description: "Our commitment to making Courtline Padel usable by everyone.",
    updated: UPDATED,
    body: (
      <>
        <p>We want everyone to be able to shop with us. This website aims to meet the <strong>Web Content Accessibility Guidelines (WCAG) 2.1 at level AA</strong>.</p>
        <h2>What we&apos;ve done</h2>
        <ul>
          <li>Semantic HTML with landmarks, headings and a “skip to content” link.</li>
          <li>Full keyboard support, visible focus states and focus management in menus, dialogs and the basket.</li>
          <li>Text and controls meet AA colour-contrast ratios; the site works at 200% zoom and on small screens.</li>
          <li>Images have text alternatives; decorative images are hidden from screen readers.</li>
          <li>Form fields have labels, and errors and status updates are announced to assistive technology.</li>
          <li>Motion is reduced when your device asks for it (prefers-reduced-motion).</li>
        </ul>
        <h2>Known limitations</h2>
        <ul>
          <li>The court-finder map is a visual aid; the same information is available as a text list beneath it.</li>
          <li>Third-party payment fields are provided by Stripe, which maintains its own accessibility programme.</li>
          <li>Product illustrations are generated artwork and may not show every product detail — specifications are listed in text.</li>
        </ul>
        <h2>Feedback</h2>
        <p>If you have difficulty using any part of the site, please email <a href={`mailto:${store.email}`}>{store.email}</a> or use live chat and we&apos;ll help you complete your order another way. We aim to respond within 2 working days.</p>
        <h2>Testing</h2>
        <p>This statement was prepared on {UPDATED} using automated testing (Lighthouse/axe) and manual keyboard and screen-reader checks. <Placeholder>Arrange an independent audit before launch</Placeholder>.</p>
      </>
    ),
  },
];
