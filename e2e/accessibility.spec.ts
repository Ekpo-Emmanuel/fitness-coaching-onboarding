import { expect, test } from "@playwright/test";

test("login is labelled for keyboard use", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByLabel("Email").focus();
  await expect(page.getByLabel("Email")).toBeFocused();
});
