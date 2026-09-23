import { expect, test } from "@playwright/test";

const completeBrief = {
  status: "complete",
  payload: {
    summary: {
      text: "The client reported current knee pain and wants to build muscle.",
      sourceFieldKeys: ["current_injuries", "primary_goal"],
    },
    goals: [{ text: "Build muscle.", sourceFieldKeys: ["primary_goal"] }],
    thingsToReview: [
      { text: "Clarify when the reported knee pain occurs.", sourceFieldKeys: ["current_injuries"] },
    ],
    kickoffTopics: [{ text: "Ask which three training days are realistic.", sourceFieldKeys: ["primary_goal"] }],
  },
};

test("coach intelligence routes require a session", async ({ request }) => {
  const response = await request.post("/api/submissions/00000000-0000-4000-8000-000000000001/coach-brief/generate", {
    data: {},
  });
  expect([401, 302, 307]).toContain(response.status());
});

test("mocked submission intelligence, sources, review, and retry", async ({ page }) => {
  let mode: "complete" | "failed" = "complete";
  await page.route("**/api/submissions/**/coach-brief/generate", async (route) => {
    if (mode === "failed") {
      await route.fulfill({ json: { status: "failed", payload: null } });
      return;
    }
    await route.fulfill({ json: completeBrief });
  });

  await page.goto("/dev/intelligence-sandbox");
  await expect(page.getByText("Needs Review")).toBeVisible();
  await expect(page.getByTestId("original-answer")).toBeVisible();
  await expect(page.getByText("Current injury or pain reported")).toBeVisible();
  await expect(page.getByText("The client reported current knee pain")).toBeVisible();
  await page.getByRole("button", { name: /Based on 2 answers/i }).first().click();
  await expect(page.getByText("Current injuries", { exact: true })).toBeVisible();
  await expect(page.getByText("Review flag", { exact: true })).toBeVisible();
  await expect(page.getByText("AI clarification")).toBeVisible();
  await page.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(page.getByText("Reviewed")).toBeVisible();
  await expect(page.getByText("Current injury or pain reported")).toBeVisible();
  await expect(page.getByTestId("original-answer")).toBeVisible();

  mode = "failed";
  await page.reload();
  await expect(page.getByText("Coach Brief couldn't be generated.")).toBeVisible();
  await expect(page.getByTestId("original-answer")).toBeVisible();
  mode = "complete";
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("The client reported current knee pain")).toBeVisible();
});
