import { expect, test } from "@playwright/test";
import { dismissConsent, fillAddress } from "./helpers";

test.describe("guest checkout (simulated payments)", () => {
  test("browse → add to basket → discount → pay → confirmation @mobile", async ({ page, context, baseURL }) => {
    await dismissConsent(context, baseURL!);
    await page.goto("/products/vantis-hybrid-teardrop");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vantis Hybrid Teardrop");
    await page.getByRole("button", { name: "Add to basket", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: /Your basket/ });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("free UK delivery");
    await drawer.getByRole("link", { name: "Checkout securely" }).click();

    await expect(page).toHaveURL(/\/checkout/);
    await page.getByLabel("Discount or gift card code").fill("welcome10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Discount applied")).toBeVisible();

    await page.getByLabel("Email for order updates").fill(`e2e+${Date.now()}@example.com`);
    await fillAddress(page);
    await page.getByRole("button", { name: "Continue to payment" }).click();

    await expect(page.getByText("Demo payment mode")).toBeVisible();
    await page.getByRole("button", { name: /^Pay £/ }).click();

    await expect(page).toHaveURL(/\/checkout\/complete\?order=/);
    await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible();
    await expect(page.getByText(/CL-\d{5}/).first()).toBeVisible();
    await expect(page.getByText("WELCOME10").or(page.getByText("Discount")).first()).toBeVisible();
  });

  test("declined card shows an error and keeps the basket", async ({ page, context, baseURL }) => {
    await dismissConsent(context, baseURL!);
    await page.goto("/products/courtline-tour-ball");
    await page.getByRole("button", { name: "Add to basket", exact: true }).click();
    await page.getByRole("dialog", { name: /Your basket/ }).getByRole("link", { name: "Checkout securely" }).click();
    await page.getByLabel("Email for order updates").fill("decline@example.com");
    await fillAddress(page);
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByRole("button", { name: "Simulate a declined card" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "declined" })).toBeVisible();
  });
});
