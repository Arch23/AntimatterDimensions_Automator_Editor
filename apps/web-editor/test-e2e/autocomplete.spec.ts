import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator(".cm-content").click();
});

test("typing auto i suggests and inserts infinity", async ({ page }) => {
  const editor = page.locator(".cm-content");
  await page.keyboard.type("auto i");

  const infinity = page.locator(".cm-tooltip-autocomplete li").filter({ hasText: "infinity" });
  await expect(infinity).toBeVisible();
  await infinity.click();
  await expect(editor).toHaveText("auto infinity");
});

test("selecting on after auto infinity preserves the autobuyer type", async ({ page }) => {
  const editor = page.locator(".cm-content");
  await page.keyboard.type("auto infinity ");

  const on = page.getByRole("option", { name: /^on/ });
  await expect(on).toBeVisible();
  await on.click();
  await expect(editor).toHaveText("auto infinity on");
});

test("typing auto infinity o filters settings to on and off", async ({ page }) => {
  const editor = page.locator(".cm-content");
  await page.keyboard.type("auto infinity o");

  const options = page.locator(".cm-tooltip-autocomplete li");
  await expect(options).toHaveCount(2);
  const on = page.getByRole("option", { name: /^on/ });
  const off = page.getByRole("option", { name: /^off/ });
  await expect(on).toBeVisible();
  await expect(off).toBeVisible();
  await on.click();
  await expect(editor).toHaveText("auto infinity on");
});
