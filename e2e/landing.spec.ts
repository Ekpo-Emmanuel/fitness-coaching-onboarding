import { expect, test } from "@playwright/test";

test("root is the SaaS landing page, not client onboarding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Client onboarding/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Build your onboarding" })).toHaveAttribute("href", "/signup");
  await expect(page.getByRole("link", { name: "Get started" }).first()).toHaveAttribute("href", "/signup");
  await expect(page.getByRole("link", { name: "Log in" }).first()).toHaveAttribute("href", "/login");
  await expect(page.getByRole("button", { name: "Start Onboarding" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Start Onboarding");
});

test("landing CTAs open signup and login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Build your onboarding" }).click();
  await expect(page).toHaveURL(/\/signup/);
  await expect(page.getByRole("heading", { name: /Create your workspace/i })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Log in" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Sign in to your workspace/i })).toBeVisible();
});
