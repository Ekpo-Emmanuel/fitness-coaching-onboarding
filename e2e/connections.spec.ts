import { expect, test } from "@playwright/test";

test("connections page requires a session", async ({ page }) => {
  await page.goto("/settings/connections");
  await expect(page).toHaveURL(/\/login/);
});

test("mocked connections cards, webhook, failure, and retry", async ({ page }) => {
  await page.goto("/dev/connections-sandbox");
  await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
  await expect(page.getByText("Not connected").or(page.getByText("Connected")).first()).toBeVisible();
  await page.getByRole("button", { name: "Add webhook" }).click();
  await expect(page.getByText("test-secret-once")).toBeVisible();
  await expect(page.getByText("onboarding.submitted · Failed")).toBeVisible();
  await expect(page.getByText(/onboarding is safely stored/i)).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("onboarding.submitted · Sent")).toBeVisible();
});
