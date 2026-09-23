import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

async function saved(page: Page) { await expect(page.locator('.bw-save')).toHaveText('Saved', { timeout: 20_000 }); }
async function mode(page: Page, name: string) { await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: new RegExp('^' + name) }).click(); }
async function overview(page: Page) { await mode(page, 'Build'); const back = page.getByRole('button', { name: 'All sections' }); if (await back.isVisible()) await back.click(); }
async function openFormTool(page: Page, name: 'Review rules' | 'Form settings') {
  const tools = page.getByRole('button', { name: 'Form tools' });
  if (await tools.isVisible()) {
    await tools.click();
    await page.getByRole('menuitem', { name, exact: true }).click();
    return;
  }
  await page.getByRole('button', { name, exact: true }).click();
}
async function addQuestion(page: Page, type: string, question: string) {
  await overview(page);
  await page.locator('.bw-section').filter({ has: page.locator('summary', { hasText: 'Training context' }) }).getByRole('button', { name: 'Add question', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Answer type').selectOption(type); await dialog.getByLabel('Question', { exact: true }).fill(question);
  await dialog.getByRole('button', { name: 'Add question', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit question' })).toBeVisible();
}

test('real builder: manual edits, conditions, rules, persistence, publish, conflict, and responsive modes', async ({ page, context }) => {
  test.skip(process.env.BUILDER_LIVE_TEST !== '1', 'Opt-in creates and cleans a dedicated QA workspace in the configured database.');
  test.setTimeout(600_000);
  const email = `builder-qa-${randomUUID()}@example.test`;
  let userId: string | undefined;
  let workspaceCreated = false;
  try {
    const signup = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: 'http://127.0.0.1:3000' }, data: { name: 'Builder QA', email, password: randomUUID() + 'Aa1!' } });
    expect(signup.ok()).toBe(true); userId = (await signup.json()).user.id;
    await page.goto('/onboarding');
    await page.getByLabel('Business name', { exact: true }).fill('Coaching QA');
    await page.getByLabel('Coach name', { exact: true }).fill('Test coach');
    await page.getByLabel('Online', { exact: true }).check();
    await page.getByLabel('Who do you primarily help?').fill('Synthetic test clients only.');
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 60_000 }); workspaceCreated = true;
    await page.goto('/forms/new'); await page.getByLabel('Form name').fill('Foundations onboarding');
    await page.getByRole('radio', { name: /Start manually/ }).check();
    await page.getByRole('button', { name: 'Create onboarding', exact: true }).click();
    await expect(page).toHaveURL(/\/build/, { timeout: 60_000 }); const builderUrl = page.url();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Add section', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Section name').fill('Training context');
    await page.getByRole('dialog').getByRole('button', { name: 'Add section', exact: true }).click();
    await page.getByLabel('Section introduction').fill('A few questions about your routine.');
    await saved(page); await page.getByRole('button', { name: 'Move up', exact: true }).click(); await saved(page);
    await addQuestion(page, 'boolean', 'Any current injury?'); await saved(page);
    await page.getByRole('button', { name: 'Done editing' }).click();
    await addQuestion(page, 'long_text', 'Tell me about it');
    await page.locator('summary').filter({ hasText: 'Conditional visibility' }).click();
    await page.getByRole('checkbox', { name: 'Only show this question for certain answers' }).check();
    await page.getByLabel('Answer to', { exact: true }).selectOption({ label: 'Any current injury?' });
    await page.getByLabel('Answer', { exact: true }).selectOption('true'); await saved(page);
    await page.getByRole('button', { name: 'Done editing' }).click();
    await addQuestion(page, 'single_select', 'Preferred training time');
    await page.getByLabel('Choice 1', { exact: true }).fill('Morning'); await page.getByLabel('Choice 2', { exact: true }).fill('Evening'); await saved(page);
    await page.getByRole('button', { name: 'Move up', exact: true }).click(); await saved(page);
    await page.getByRole('button', { name: 'Duplicate question', exact: true }).click(); await saved(page);
    await overview(page);
    const copies = page.getByRole('button', { name: /Preferred training time/ }); await copies.last().click();
    await page.getByRole('button', { name: 'Delete question', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Remove from draft' }).click(); await saved(page);
    await openFormTool(page, 'Review rules');
    await page.getByRole('button', { name: 'Add review rule' }).click();
    await page.getByLabel('Flag message').fill('Current injury or pain reported');
    await page.getByLabel('Answer to', { exact: true }).selectOption({ label: 'Any current injury?' });
    await page.getByLabel('Answer', { exact: true }).selectOption('true'); await saved(page);
    await page.reload(); await expect(page.getByRole('button', { name: /Any current injury/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Preferred training time/ })).toHaveCount(1);
    await mode(page, 'Preview'); await expect(page.getByRole('heading', { name: 'Preview your draft' })).toBeVisible();
    await page.locator('.bw-preview').getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.locator('.bw-preview').getByRole('textbox', { name: 'Full name', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish onboarding' }).click();
    await expect(page.locator('.bw-banner')).toContainText('Published.', { timeout: 20_000 });
    await expect(page.locator('.bw-identity')).toContainText('Up to date');
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await overview(page);
      expect(await page.locator('body').evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `artifacts/redesign/builder-build-${width}.png`, style: 'nextjs-portal{display:none}', fullPage: true });
      await mode(page, 'Agent'); await expect(page.getByLabel('Message the Agent')).toBeVisible();
      await page.screenshot({ path: `artifacts/redesign/builder-agent-${width}.png`, style: 'nextjs-portal{display:none}', fullPage: true });
      await mode(page, 'Preview'); await expect(page.getByRole('heading', { name: 'Preview your draft' })).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 }); await overview(page);
    const other = await context.newPage(); await other.goto(builderUrl); await other.setViewportSize({ width: 390, height: 844 });
    await openFormTool(page, 'Form settings'); await page.getByLabel('Intro title', { exact: true }).fill('Welcome to your next step'); await saved(page);
    await expect(page.locator('.bw-identity')).toContainText('Unpublished changes');
    await openFormTool(other, 'Form settings'); await other.getByLabel('Intro title', { exact: true }).fill('My local draft');
    await expect(other.locator('.bw-save')).toHaveText('Draft conflict', { timeout: 20_000 });
    await expect(other.getByLabel('Intro title', { exact: true })).toHaveValue('My local draft');
    await expect(other.getByRole('button', { name: 'Download my edits' })).toBeVisible(); await other.close();
    if (process.env.BUILDER_LIVE_AGENT === '1') {
      await mode(page, 'Agent'); await page.getByLabel('Message the Agent').fill('Add one optional long-text question named What helps you stay consistent? to Training context. Propose only this change.');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Proposed changes' }).last()).toBeVisible({ timeout: 90_000 });
      await page.getByRole('button', { name: 'Preview proposed form' }).last().click();
      await expect(page.getByRole('dialog').getByRole('heading', { name: 'Preview proposed changes' })).toBeVisible();
      await page.getByRole('dialog').getByRole('button', { name: 'Close preview' }).click();
      await page.getByRole('button', { name: 'Reject', exact: true }).last().click();
      await expect(page.getByText('Rejected. The draft was not changed.')).toBeVisible();
      await page.getByLabel('Message the Agent').fill('Propose that same single optional question again: What helps you stay consistent?'); await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Apply changes', exact: true }).last()).toBeVisible({ timeout: 90_000 });
      await page.getByRole('button', { name: 'Apply changes', exact: true }).last().click();
      await expect(page.getByText('Applied to the draft. Publish when you want clients to see this.')).toBeVisible();
      await overview(page); await expect(page.getByRole('button', { name: /What helps you stay consistent/ })).toBeVisible(); await page.reload();
      await expect(page.getByRole('button', { name: /What helps you stay consistent/ })).toBeVisible();
    }
  } finally {
    if (workspaceCreated) { const removed = await page.request.delete('/api/workspace', { data: { confirm: 'DELETE' } }); expect(removed.ok()).toBe(true); }
    if (userId) {
      loadEnvConfig(process.cwd()); const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      try { await pool.query('DELETE FROM "user" WHERE id = $1 AND email = $2', [userId, email]); } finally { await pool.end(); }
    }
  }
});
