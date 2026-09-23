import { expect, test, type Page } from "@playwright/test";
import validAnswers from "../tests/fixtures/valid-client-answers.json";
import { emmanuelOnboardingV1 } from "../lib/onboarding/schemas/emmanuel-onboarding-v1";

const schemaFields = emmanuelOnboardingV1.sections.flatMap((section) => section.fields);
const answers: Record<string, unknown> = validAnswers;
async function fillPage(page: Page) {
  const keys = await page.locator('[data-field-key]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-field-key')!));
  for (const key of keys) {
    const field = schemaFields.find((item) => item.key === key);
    if (!field) throw new Error('Unexpected published field: ' + key);
    const row = page.locator(`[data-field-key="${key}"]`);
    const value = answers[key];
    if (field.type === 'unit_number') {
      await row.getByRole('button', { name: field.units.find((unit) => unit.value === answers[field.unitKey])!.label, exact: true }).click();
      await row.locator('input').first().fill(String(value ?? ''));
      if (await row.locator('input').count() > 1) await row.locator('input').nth(1).fill(String(answers[field.companionKey!] ?? '0'));
    } else if (field.type === 'single_select') {
      if (value) await row.getByRole('button', { name: field.options.find((option) => option.value === value)!.label, exact: true }).click();
    } else if (field.type === 'multi_select') {
      for (const selected of value as string[]) await row.getByRole('button', { name: field.options.find((option) => option.value === selected)!.label, exact: true }).click();
    } else if (field.type === 'scale') await row.getByRole('button', { name: String(value), exact: true }).click();
    else if (field.type === 'acknowledgement') await row.getByRole('checkbox').setChecked(value === true);
    else if (field.type === 'boolean') await row.getByRole('button', { name: value ? 'Yes' : 'No', exact: true }).click();
    else await row.locator('input,textarea').fill(String(value ?? ''));
  }
  // Choices can reveal a new dependent question after the first pass.
  for (const row of await page.locator('[data-conditional="true"]').all()) {
    const key = await row.getAttribute('data-field-key');
    const control = row.locator('input,textarea');
    if (await control.count() && !(await control.first().inputValue())) await control.first().fill(String(answers[key!] || 'Context supplied for this test.'));
  }
}

test('guided renderer validates, restores exact page, and preserves Back answers', async ({ page }) => {
  await page.goto('/dev/legacy-onboarding');
  await page.getByRole('button', { name: 'Start Onboarding' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toBeFocused();
  await expect(page.locator('.flow-error-summary')).toContainText('Check the highlighted');
  await fillPage(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Part 2 of 3', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Your saved answers are ready.', { exact: false })).toBeVisible();
  await expect(page.getByText('Part 2 of 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toHaveValue('Marisol Keene');
});

test('complete published flow, failure, retry, and duplicate protection', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const slug = process.env.PUBLIC_FORM_SLUG ?? 'emmanuel-onboarding';
  await page.goto('/f/' + slug);
  test.skip(await page.getByRole('heading', { name: 'This form is unavailable' }).isVisible(), 'A published form is required; set PUBLIC_FORM_SLUG.');
  await page.getByRole('button', { name: /start/i }).click();
  let visited = 0;
  while (true) {
    await fillPage(page);
    expect(await page.locator('.public-flow').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(Number(await page.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(100);
    visited++;
    if (await page.getByRole('button', { name: 'Submit Onboarding' }).count()) break;
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('.flow-error-summary')).toHaveCount(0);
    if (visited > 30) throw new Error('Flow failed to advance');
  }
  expect(visited).toBeGreaterThan(10);
  let attempt: string | undefined;
  let requests = 0;
  await page.route('**/api/public/forms/**/submit', async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    attempt = body.submissionAttemptId;
    expect(body.answers.full_name).toBe('Marisol Keene');
    expect(body.answers.accuracy_acknowledgement).toBe(true);
    expect(body.startedAt).toBeLessThan(Date.now());
    await route.fulfill({ status: 502, json: { error: 'Test failure' } });
  });
  await page.getByRole('button', { name: 'Submit Onboarding' }).click();
  await expect(page.locator('.flow-error-summary')).toContainText('still here');
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('onboarding_draft:')))).toBe(true);
  await page.unroute('**/api/public/forms/**/submit');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/public/forms/**/submit', async (route) => {
    requests++;
    expect(route.request().postDataJSON().submissionAttemptId).toBe(attempt);
    await gate;
    await route.fulfill({ json: { ok: true, submission_id: 'test-only' } });
  });
  await page.getByRole('button', { name: 'Submit Onboarding' }).click();
  await expect(page.getByRole('button', { name: 'Sending answers…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
  await page.screenshot({ path: 'artifacts/redesign/public-success-390.png', fullPage: true, style: 'nextjs-portal{display:none}' });
  expect(requests).toBe(2);
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('onboarding_draft:')))).toBe(false);
});

test('optional controls, explicit boolean, full scale range, long conditional answer, keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/dev/onboarding-controls');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  const details = page.getByRole('textbox', { name: /Tell your coach/ });
  await expect(details).toBeVisible();
  await details.fill('A long personal answer. '.repeat(100));
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await expect(details).toHaveCount(0);
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(details).toHaveValue('A long personal answer. '.repeat(100));
  await expect(page.locator('[data-field-key="scale"]').getByRole('button')).toHaveCount(11);
  await page.locator('[data-field-key="scale"]').getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Finish preview' }).click();
  await expect(page.getByRole('heading', { name: 'Preview complete' })).toBeVisible();
});

for (const width of [320, 390, 768, 1280, 1440]) {
  test('public layout at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(process.env.PUBLIC_FORM_SLUG ? '/f/' + process.env.PUBLIC_FORM_SLUG : '/dev/legacy-onboarding');
    await page.getByRole('button', { name: 'Start Onboarding' }).waitFor();
    await page.screenshot({ path: 'artifacts/redesign/public-welcome-' + width + '.png', fullPage: true, style: 'nextjs-portal{display:none}' });
    await page.getByRole('button', { name: 'Start Onboarding' }).click();
    await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toBeVisible();
    expect(await page.locator('body').evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'artifacts/redesign/public-questions-' + width + '.png', fullPage: true, style: 'nextjs-portal{display:none}' });
    const input = await page.getByRole('textbox', { name: 'Full name', exact: true }).boundingBox();
    expect(input!.width).toBeLessThanOrEqual(600);
    expect(input!.height).toBeGreaterThanOrEqual(48);
    await expect(page.locator('.flow-outline')).toBeVisible({ visible: width >= 1040 });
  });
}

test('legacy saved final section still submits', async ({ page }) => {
  let posted: unknown;
  await page.route('**/api/onboarding', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { ok: true, submission_id: 'test-id' } }); });
  await page.addInitScript((data) => localStorage.setItem('emmanuel_onboarding_v1', JSON.stringify({ step: 10, data })), validAnswers);
  await page.goto('/dev/legacy-onboarding');
  await expect(page.getByRole('heading', { name: 'Almost done.' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit Onboarding' }).click();
  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
  expect(posted).toMatchObject({ full_name: 'Marisol Keene', accuracy_acknowledgement: true });
});
