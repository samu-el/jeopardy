import { expect, test } from "@playwright/test";

test("health route reports foundation phase", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);

  const body = (await response.json()) as {
    ok: boolean;
    service: string;
    phase: string;
    uiImplemented: boolean;
  };

  expect(body).toMatchObject({
    ok: true,
    service: "jeopardy-modern",
    phase: "foundation",
    uiImplemented: false,
  });
});
