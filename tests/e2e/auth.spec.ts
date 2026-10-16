import { expect, test } from "@playwright/test";
import { createManagedServer } from "./support/server.ts";

// With EDITOR_TOKEN set, the tools and every write need the token; displays and reads do not.
test.describe("editor token", () => {
  const TOKEN = "set-secret-e2e";
  const server = createManagedServer(3013, { EDITOR_TOKEN: TOKEN });

  test.beforeAll(async () => {
    await server.start();
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("protects the operator console and the API, not the displays", async ({ page, request }) => {
    await page.goto(`${server.url}/d/test`);
    await expect(page.getByRole("heading", { name: /bridge operations/i })).toBeVisible();

    expect((await request.post(`${server.url}/api/state`, { data: { state: "red-alert" } })).status()).toBe(401);
    expect((await request.get(`${server.url}/api/show`)).ok()).toBe(true);

    await page.goto(`${server.url}/operator`);
    await page.getByLabel("Editor token").fill("not-the-token");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("That token was not accepted.")).toBeVisible();

    await page.getByLabel("Editor token").fill(TOKEN);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Demo Show" })).toBeVisible();
    await page.getByRole("button", { name: /Red alert/ }).click();
    await expect(page.getByRole("button", { name: /Red alert/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("takes the token from a link once and keeps it", async ({ page }) => {
    await page.goto(`${server.url}/builder?token=${TOKEN}`);
    await expect(page.getByRole("heading", { name: "Demo Show" })).toBeVisible();
    await expect(page).toHaveURL(`${server.url}/builder`);

    await page.goto(`${server.url}/builder/bridge`);
    await expect(page.locator(".editor__bar").getByRole("heading", { name: "Bridge operations" })).toBeVisible();
  });
});
