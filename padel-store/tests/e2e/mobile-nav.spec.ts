import { expect, test } from "@playwright/test";

// Regression: the drawer used to render inside the blurred sticky header, which trapped it
// under the cookie banner / chat button. No consent cookie here, so the banner is showing.
test("mobile menu covers the page and its links work @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/c/rackets");
  await page.getByRole("button", { name: "Open menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  const box = (await drawer.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(660);
  const onTop = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[aria-label="Menu"]')), { x: box.x + 60, y: box.y + box.height - 40 });
  expect(onTop).toBe(true);
  await drawer.locator("summary", { hasText: "Rackets" }).click();
  await drawer.getByRole("link", { name: "Diamond (power)" }).click();
  await expect(page).toHaveURL(/shape=Diamond/);
  await expect(drawer).toBeHidden();
});
