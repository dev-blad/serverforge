import { expect, test } from "@playwright/test";
import { dismissConsent, fillAddress } from "./helpers";

const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? "admin@courtline.test", password: process.env.E2E_ADMIN_PASSWORD ?? "CourtlineAdmin!2026" };

test("a real order shows in admin and moves through the fulfilment workflow", async ({ page, context, baseURL }) => {
  await dismissConsent(context, baseURL!);
  // Place an order as a guest
  await page.goto("/products/ondo-fusion-control");
  await page.getByRole("button", { name: "Add to basket", exact: true }).click();
  await page.getByRole("dialog", { name: /Your basket/ }).getByRole("link", { name: "Checkout securely" }).click();
  await page.getByLabel("Email for order updates").fill(`admin-flow+${Date.now()}@example.com`);
  await fillAddress(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("button", { name: /^Pay £/ }).click();
  await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible();
  const orderNo = (await page.getByText(/CL-\d{5}/).first().textContent())!.match(/CL-\d{5}/)![0];

  // Admin sign in
  await page.goto("/account/login?callbackUrl=/admin");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Sales dashboard" })).toBeVisible();

  // Real-orders-only view still shows revenue from this test order
  await page.goto("/admin?seed=0");
  await expect(page.getByText("Revenue").first()).toBeVisible();

  // Find the order, check the label was auto-created, then pack + ship it
  await page.goto(`/admin/orders?q=${orderNo}`);
  await page.getByRole("link", { name: orderNo }).click();
  await expect(page.getByText(/Label created via stub/)).toBeVisible();
  await expect(page.getByText(/Order confirmation email sent/)).toBeVisible();
  await page.getByRole("button", { name: "Mark packed" }).click();
  await expect(page.getByText(/Status changed PAID → PACKED/)).toBeVisible();
  await page.getByRole("button", { name: "Mark shipped" }).click();
  await expect(page.getByText(/Status changed PACKED → SHIPPED/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Shipping notification email sent/)).toBeVisible();

  // Label PDF is downloadable
  const res = await page.request.get(page.url().replace(/\/admin\/orders\/(.+)$/, "/api/admin/orders/$1/label"));
  expect(res.headers()["content-type"]).toContain("application/pdf");
});

test("live chat message reaches the admin inbox and the reply comes back", async ({ page, context, baseURL, browser }) => {
  await dismissConsent(context, baseURL!);
  await page.goto("/help");
  await page.getByRole("button", { name: "Open live chat" }).click();
  await page.getByLabel("Your name").fill("Chat Tester");
  const text = `Is the Glide Control good for tennis elbow? ${Date.now()}`;
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(text)).toBeVisible();

  const admin = await browser.newContext();
  await dismissConsent(admin, baseURL!);
  const ap = await admin.newPage();
  await ap.goto("/account/login?callbackUrl=/admin/chat");
  await ap.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await ap.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await ap.getByRole("button", { name: "Sign in" }).click();
  await ap.getByText(text).click();
  await ap.getByRole("textbox", { name: "Reply" }).fill("Yes — it's one of our most arm-friendly rackets.");
  await ap.getByRole("button", { name: "Send" }).click();
  await admin.close();

  await expect(page.getByText("arm-friendly")).toBeVisible({ timeout: 15_000 });
});
