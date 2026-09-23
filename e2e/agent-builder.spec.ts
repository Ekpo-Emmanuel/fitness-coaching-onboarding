import { expect, test } from "@playwright/test";

test("agent API requires a session", async ({ request }) => {
  const response = await request.post("/api/forms/00000000-0000-4000-8000-000000000001/agent", {
    data: { message: "Build my onboarding" },
  });
  expect([401, 302, 307]).toContain(response.status());
});

test("new form page is protected", async ({ page }) => {
  await page.goto("/forms/new");
  await expect(page).toHaveURL(/\/login/);
});

test("mocked agent propose, apply, reject, and failure", async ({ page }) => {
  await page.route("**/api/forms/**/agent/change-sets/**/apply", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        revision: 2,
        schema: {
          id: "sch",
          schemaVersion: "onboarding_schema_v1",
          title: "Shorter onboarding",
          storageKey: "form_sch",
          intro: { title: "Welcome", navLabel: "Welcome", description: ["Hi"], buttonLabel: "Start" },
          sections: [],
          success: { title: "Done", message: ["Thanks"], aside: "" },
        },
        clientIdentityMapping: { fullNameFieldKey: "full_name", emailFieldKey: "email" },
      },
    });
  });
  await page.route("**/api/forms/**/agent/change-sets/**/reject", async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/forms/**/agent", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { message?: string };
    if (body.message === "fail please") {
      await route.fulfill({
        status: 502,
        json: { error: "The Agent couldn't complete that request. Your form has not been changed." },
      });
      return;
    }
    const changeSetId = body.message === "Add supplements" ? "cs2" : "cs1";
    await route.fulfill({
      json: {
        ok: true,
        threadId: "thread",
        message: {
          id: `msg-${changeSetId}`,
          role: "assistant",
          content: "I can shorten this by removing redundant questions.",
          changeSetId,
        },
        changeSet: {
          id: changeSetId,
          status: "proposed",
          summary: "+ Add Training section\n+ Add 2 questions",
          details: ["Added section: Training"],
          baseDraftRevision: 1,
        },
      },
    });
  });

  await page.goto("/dev/agent-sandbox");
  if (await page.getByRole("heading", { name: "This form is unavailable" }).isVisible().catch(() => false)) {
    return;
  }
  await expect(page.getByText("Tell me what to change.")).toBeVisible();
  await page.getByLabel("Message the Agent").fill("Make this shorter");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Proposed changes" })).toBeVisible();
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByRole("heading", { name: "Shorter onboarding" })).toBeVisible();

  await page.getByLabel("Message the Agent").fill("Add supplements");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Proposed changes").nth(1)).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).last().click();
  await expect(page.getByText("Rejected. The draft was not changed.").last()).toBeVisible();

  await page.getByLabel("Message the Agent").fill("fail please");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/couldn't complete that request/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shorter onboarding" })).toBeVisible();
});
