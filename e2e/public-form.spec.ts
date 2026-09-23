import { expect, test } from "@playwright/test";
import validAnswers from "../tests/fixtures/valid-client-answers.json";

test("unknown public slug is unavailable without leaking internals", async ({ page }) => {
  await page.goto("/f/this-slug-does-not-exist-zz9");
  await expect(page.getByRole("heading", { name: "This form is unavailable" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("workspace");
  await expect(page.locator("body")).not.toContainText("DATABASE");
});

test("unpublished public form stays unavailable", async ({ page }) => {
  await page.goto("/f/not-published-phase4");
  await expect(page.getByRole("heading", { name: "This form is unavailable" })).toBeVisible();
});

test("coach client routes require a session", async ({ page }) => {
  await page.goto("/clients");
  await expect(page).toHaveURL(/\/login/);
});

test("canonical public submit succeeds and failure keeps answers", async ({ page }) => {
  await page.goto("/f/" + (process.env.PUBLIC_FORM_SLUG ?? "emmanuel-onboarding"));
  const unavailable = page.getByRole("heading", { name: "This form is unavailable" });
  if (await unavailable.isVisible().catch(() => false)) {
    test.info().annotations.push({ type: "note", description: "Seeded V1 public form not present; skip fill." });
    return;
  }
  await expect(page.getByRole("button", { name: /start/i })).toBeVisible();

  const draftKey = await page.evaluate(() =>
    Object.keys(localStorage).find((key) => key.startsWith("onboarding_draft:")),
  );
  expect(draftKey).toBeTruthy();
  if (!draftKey) return;

  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(key, JSON.stringify({ step: 10, data }));
    },
    { key: draftKey, data: validAnswers },
  );

  await page.route("**/api/public/forms/**/submit", async (route) => {
    await route.fulfill({
      status: 502,
      json: { error: "We couldn't submit your onboarding just yet. Your answers are still here. Please try again." },
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Almost done." })).toBeVisible();
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText(/still here|try submitting again/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "You're all set" })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeTruthy();

  await page.unroute("**/api/public/forms/**/submit");
  await page.route("**/api/public/forms/**/submit", async (route) => {
    const body = route.request().postDataJSON() as { submissionAttemptId?: string };
    expect(body.submissionAttemptId).toMatch(/^[0-9a-f-]{36}$/i);
    await route.fulfill({ json: { ok: true, submission_id: "sub_test" } });
  });
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();
});

test("privacy delete confirmation", async ({ page }) => {
  await page.goto("/dev/privacy-sandbox");
  await expect(page.getByRole("heading", { name: "Ada" })).toBeVisible();
  await page.locator("#confirm-delete").fill("DELETE");
  await page.getByRole("button", { name: "Delete client data" }).click();
  await expect(page.getByText("Ada removed. Beau remains.")).toBeVisible();
});
