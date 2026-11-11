import { expect, test } from "@playwright/test";
import { dismissConsent, fillAddress } from "./helpers";

test("register → checkout with saved address → order history → buy again", async ({ page, context, baseURL }) => {
  await dismissConsent(context, baseURL!);
  const email = `e2e-user+${Date.now()}@example.com`;
  await page.goto("/account/register");
  await page.getByLabel("Full name").fill("Robin Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("CourtTest2026x");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: /Hi Robin/ })).toBeVisible();

  await page.goto("/products/solara-breeze-lite");
  await page.getByRole("button", { name: "Add to basket", exact: true }).click();
  await page.getByRole("dialog", { name: /Your basket/ }).getByRole("link", { name: "Checkout securely" }).click();
  await expect(page.getByLabel("Email for order updates")).toHaveValue(email);
  await fillAddress(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("button", { name: /^Pay £/ }).click();
  await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible();

  await page.goto("/account/orders");
  await expect(page.getByText(/CL-\d{5}/).first()).toBeVisible();
  await page.getByRole("button", { name: "Buy again" }).first().click();
  await expect(page).toHaveURL(/\/checkout/);
  // Saved address from the first order is pre-selected
  await expect(page.getByLabel("Saved addresses")).toBeVisible();
  await expect(page.getByLabel("Address line 1")).toHaveValue("1 Test Street");
});

test("wrong password is rejected", async ({ page, context, baseURL }) => {
  await dismissConsent(context, baseURL!);
  await page.goto("/account/login");
  await page.getByLabel("Email", { exact: true }).fill("demo@courtline.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
});

test("admin area is protected", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/login/);
});
