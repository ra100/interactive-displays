import { expect, test } from "@playwright/test";
import { assignDisplay, createScreen, deleteScreen } from "./support/api.ts";
import { FILL_SUMMARY, startFakeClaude } from "./support/fakeClaude.ts";
import { mcpTool } from "./support/mcp.ts";
import { createManagedServer } from "./support/server.ts";

// AI end to end: an MCP client designing a screen while the editor watches, the operator's switches that keep it
// off the air, and the editor's own Fill with AI against a stand-in for the Messages API.
const DISPLAY = "ai-e2e";

test.describe("MCP", () => {
  test.afterEach(async ({ request }) => {
    await request.put("/api/show/settings", { data: { aiPublish: false, aiLiveControl: false } });
    await assignDisplay(request, DISPLAY, null);
    await deleteScreen(request, "mcp-engineering");
  });

  test("an MCP client generates and edits a screen the editor shows live, and publishes only when allowed", async ({ page, browser, request }) => {
    const generated = await mcpTool(request, "generate_screen", { section: "trek/engineering", id: "mcp-engineering", seed: 1701 });
    expect(generated.isError).toBe(false);

    await page.goto("/builder/mcp-engineering");
    await expect(page.getByRole("heading", { name: "Engineering", level: 1, exact: true })).toBeVisible();

    // An edit over MCP reaches the open editor without a reload.
    const outline = (await mcpTool(request, "get_screen", { id: "mcp-engineering", format: "json" })).data as { revision: number };
    const edited = await mcpTool(request, "apply_ops", {
      id: "mcp-engineering",
      baseRevision: outline.revision,
      ops: [{ op: "update", id: "title", props: { text: "MAIN ENGINEERING" } }],
    });
    expect(edited.isError).toBe(false);
    await expect(page.locator(".preview-stage").getByText("MAIN ENGINEERING")).toBeVisible();

    // Publishing waits for the operator.
    const refused = await mcpTool(request, "publish_screen", { id: "mcp-engineering" });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("AI may publish");

    const operator = await browser.newPage();
    await operator.goto("/operator");
    // The switch follows the server, so it turns on once the show update comes back.
    await operator.getByRole("switch", { name: /AI may publish/ }).click();
    await expect(operator.getByRole("switch", { name: /AI may publish/ })).toBeChecked();
    await operator.close();

    expect((await mcpTool(request, "publish_screen", { id: "mcp-engineering" })).isError).toBe(false);
    // Assigning screens is live control, which is still off.
    expect((await mcpTool(request, "assign_screen", { display: DISPLAY, screen: "mcp-engineering" })).isError).toBe(true);
    await assignDisplay(request, DISPLAY, "mcp-engineering");
    const display = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await display.goto(`/d/${DISPLAY}`);
    await expect(display.getByText("MAIN ENGINEERING")).toBeVisible();
    await display.close();
  });
});

test.describe("Fill with AI", () => {
  const fake = { url: "", close: async () => {} };
  const server = createManagedServer(3014, { ANTHROPIC_API_KEY: "e2e-key", ANTHROPIC_BASE_URL: "http://127.0.0.1:3015" });

  test.beforeAll(async () => {
    const started = await startFakeClaude(3015);
    fake.url = started.url;
    fake.close = started.close;
    await server.start();
  });

  test.afterAll(async () => {
    await server.stop();
    await fake.close();
  });

  test("proposes a change on a copy, applies it as one edit and undoes it", async ({ page, request }) => {
    await createScreen(request, "torpedo", "Torpedo", server.url);
    await page.goto(`${server.url}/builder/torpedo`);
    await page.getByRole("button", { name: "Fill with AI" }).click();
    const dialog = page.getByRole("dialog", { name: "Fill with AI" });
    await dialog.getByLabel("What should change?").fill("Make this the torpedo bay: each tube's status and the firing spread");
    await dialog.getByRole("button", { name: "Ask" }).click();
    await expect(dialog.getByText(FILL_SUMMARY)).toBeVisible();

    // Nothing is saved until Apply.
    const before = (await (await request.get(`${server.url}/api/screens/torpedo`)).json()) as { screen: { revision: number } };
    expect(before.screen.revision).toBe(0);

    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator(".preview-stage").getByText("TORPEDO BAY")).toBeVisible();
    await expect(page.locator(".preview-stage").getByText("TUBE 3 CYCLING")).toBeVisible();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".preview-stage").getByText("TORPEDO", { exact: true })).toBeVisible();
  });
});
