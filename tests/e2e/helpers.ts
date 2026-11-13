import type { BrowserContext, Page } from "@playwright/test";

/** Pre-set a "reject all" consent cookie so the banner doesn't cover the page. */
export async function dismissConsent(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: "cl_consent",
      value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, functional: false, marketing: false, ts: new Date().toISOString() })),
      url: baseURL,
    },
  ]);
}

export async function fillAddress(page: Page) {
  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Address line 1").fill("1 Test Street");
  await page.getByLabel("Town / city").fill("Manchester");
  await page.getByLabel("Postcode").fill("m4 6de");
}
