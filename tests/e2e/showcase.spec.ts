import path from "node:path";
import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";
import { identify, setState } from "./support/api.ts";

// Screenshots for the PR and docs/showcase. Run with: SHOWCASE=phase-1 pnpm test:e2e showcase
// Each phase captures what it added; earlier phases' images stay in their own folders.
const phase = process.env["SHOWCASE"];
const out = (name: string) => path.join("docs", "showcase", phase ?? "", `${name}.png`);

const shoot = async (page: Page, name: string, url: string, ready: RegExp | string) => {
  await page.goto(url);
  await expect(page.getByText(ready).first()).toBeVisible();
  // Let the self-hosted font settle before capturing.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out(name) });
};

test.describe("showcase phase 1", () => {
  test.skip(phase !== "phase-1", "set SHOWCASE=phase-1 to capture screenshots");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async ({ request }) => {
    await setState(request, "normal");
  });

  test("screens", async ({ page }) => {
    await shoot(page, "bridge-sidebar", "/d/test", /bridge operations/i);
    await shoot(page, "engineering-header-main", "/d/engineering-1", /main engineering/i);
    await shoot(page, "tactical-dashboard", "/d/tactical-1", /long range sensors/i);
    await shoot(page, "standby-canvas", "/d/corridor-1", /please stand by/i);
  });

  test("states", async ({ page, request }) => {
    for (const [state, text] of [
      ["yellow-alert", /shields up/i],
      ["red-alert", /battle stations/i],
      ["damaged", /hull breach/i],
    ] as const) {
      await setState(request, state);
      await shoot(page, `bridge-${state}`, "/d/test", text);
    }
    await setState(request, "red-alert");
    await shoot(page, "tactical-red-alert", "/d/tactical-1", /firing solution/i);
  });

  test("themes and variants", async ({ page }) => {
    await shoot(page, "bridge-base-theme", "/d/test?theme=base", /bridge operations/i);
    await shoot(page, "engineering-nemesis", "/d/engineering-1?variant=nemesis", /main engineering/i);
    await shoot(page, "tactical-picard", "/d/tactical-1?variant=picard", /long range sensors/i);
  });

  test("identify", async ({ page, request }) => {
    await page.goto("/d/engineering-1");
    await expect(page.getByText(/main engineering/i)).toBeVisible();
    await identify(request, "engineering-1");
    await expect(page.getByRole("alert")).toBeVisible();
    await page.screenshot({ path: out("identify") });
  });

  test("portrait", async ({ page }) => {
    await page.setViewportSize({ width: 540, height: 960 });
    await shoot(page, "bridge-9x16", "/d/test", /bridge operations/i);
  });

  test("gallery", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/gallery");
    await expect(page.locator(".frame").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // The gallery scrolls inside its own box; grow the viewport to fit it all in one image.
    const height = await page.locator(".gallery").evaluate((element) => element.scrollHeight);
    await page.setViewportSize({ width: 1280, height });
    await page.screenshot({ path: out("gallery") });
  });
});

// Displays that are on, so the operator console has live cards.
const openDisplays = async (browser: Browser, ids: string[]) =>
  Promise.all(
    ids.map(async (id) => {
      const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
      await page.goto(`/d/${id}`);
      await expect(page.locator(".screen")).toBeVisible();
      return page;
    }),
  );

// Tool pages scroll inside their own box; grow the viewport so one image shows all of it.
const shootTall = async (page: Page, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  const height = await page.locator(".tool").evaluate((element) => element.scrollHeight);
  const width = page.viewportSize()?.width ?? 1280;
  await page.setViewportSize({ width, height });
  await page.screenshot({ path: out(name) });
};

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
};

test.describe("showcase phase 2", () => {
  test.skip(phase !== "phase-2", "set SHOWCASE=phase-2 to capture screenshots");

  test.afterEach(async ({ request }) => {
    await setState(request, "normal");
    await request.delete("/api/displays/test/preview");
    await request.delete("/api/screens/showcase-bridge");
  });

  test("operator console", async ({ browser, page }) => {
    const displays = await openDisplays(browser, ["test", "engineering-1", "tactical-1"]);
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/operator");
    await expect(page.getByRole("heading", { name: "Demo Show" })).toBeVisible();
    await page.getByRole("button", { name: /Yellow alert/ }).click();
    await expect(page.getByRole("button", { name: /Yellow alert/ })).toHaveAttribute("aria-pressed", "true");
    await shootTall(page, "operator-phone");

    await page.setViewportSize({ width: 1180, height: 820 });
    await page.getByRole("button", { name: /Red alert/ }).click();
    await settle(page);
    await page.screenshot({ path: out("operator-tablet") });
    await Promise.all(displays.map((display) => display.close()));
  });

  test("screen library", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/builder");
    await expect(page.getByRole("heading", { name: "Demo Show" })).toBeVisible();
    await expect(page.locator(".screen-card .thumbnail")).toHaveCount(5);
    await settle(page);
    await page.screenshot({ path: out("library") });

    await page.getByRole("button", { name: "New screen" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("Warp core");
    await page.getByRole("dialog").getByText("Header and main").click();
    await settle(page);
    await page.screenshot({ path: out("new-screen") });
  });

  test("editor", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/builder/bridge");
    await page.locator(".preview-stage").getByText("SENSOR SWEEP").click();
    await expect(page.locator(".selection-box")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out("editor") });

    await page.getByLabel("State").selectOption("red-alert");
    await page.locator(".preview-stage").getByText("STAND DOWN").click();
    await page.getByRole("radio", { name: "Only in Red alert" }).click();
    await settle(page);
    await page.screenshot({ path: out("editor-per-state") });

    await page.getByLabel("State").selectOption("normal");
    await page.getByRole("radio", { name: "9:16" }).click();
    await page.getByLabel("Theme").selectOption("base");
    await page.getByRole("tab", { name: "Screen" }).click();
    await settle(page);
    await page.screenshot({ path: out("editor-portrait-base") });
  });

  test("canvas editing and assets", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/builder/standby");
    await page.locator(".preview-stage").getByText(/please stand by/i).click();
    await expect(page.locator(".selection-box__handle")).toHaveCount(4);
    await settle(page);
    await page.screenshot({ path: out("editor-canvas") });

    await page.goto("/builder/schematic");
    await page.getByRole("tree", { name: "Outline" }).getByRole("treeitem", { name: /Image/ }).click();
    await page.getByRole("tab", { name: "Assets" }).click();
    await settle(page);
    await page.screenshot({ path: out("editor-assets") });
  });

  test("history and send to display", async ({ page, request, browser }) => {
    const copy = await request.post("/api/screens/bridge/duplicate", { data: { id: "showcase-bridge", name: "Bridge (rehearsal)" } });
    expect(copy.ok()).toBe(true);
    for (const [revision, text] of [
      [0, "Bridge rehearsal"],
      [1, "Battle bridge"],
    ] as const) {
      const edit = await request.post("/api/screens/showcase-bridge/ops", {
        data: { baseRevision: revision, ops: [{ op: "update", id: "title", props: { text } }] },
      });
      expect(edit.ok()).toBe(true);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/builder/showcase-bridge");
    await page.getByRole("tab", { name: "History" }).click();
    const history = page.getByRole("tabpanel", { name: "History" });
    await history.getByRole("listitem").filter({ hasText: "Revision 1" }).getByRole("button", { name: "View" }).click();
    await expect(page.getByText("Viewing revision 1")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out("editor-history") });
    await page.getByRole("button", { name: "Back to the draft" }).click();

    const [display] = await openDisplays(browser, ["test"]);
    await page.getByRole("button", { name: "Send to display" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Preview on Test display" }).click();
    await settle(page);
    await page.screenshot({ path: out("send-to-display") });
    await display?.setViewportSize({ width: 1280, height: 720 });
    await expect(display?.getByText("DRAFT PREVIEW") ?? page).toBeVisible();
    await display?.evaluate(() => document.fonts.ready);
    await display?.screenshot({ path: out("display-draft-preview") });
    await display?.close();
  });
});

test.describe("showcase phase 3", () => {
  test.skip(phase !== "phase-3", "set SHOWCASE=phase-3 to capture screenshots");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async ({ request }) => {
    await setState(request, "normal");
    for (const [id, value] of [
      ["shields", 0],
      ["hull", 100],
    ] as const) {
      await request.put(`/api/signals/${id}/value`, { data: { value } });
    }
    await request.put("/api/displays/test", { data: { screen: null } });
  });

  test("live screens", async ({ page }) => {
    await shoot(page, "bridge-live", "/d/test", /bridge operations/i);
    await shoot(page, "engineering-live", "/d/engineering-1", /main engineering/i);
    await shoot(page, "tactical-live", "/d/tactical-1", /long range sensors/i);
    await shoot(page, "engineering-base-theme", "/d/engineering-1?theme=base", /main engineering/i);

    await page.goto("/d/viewscreen-1");
    await expect.poll(() => page.locator("video").evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(2);
    await page.screenshot({ path: out("viewscreen-video") });
  });

  test("controls on the displays", async ({ page }) => {
    await page.goto("/d/test");
    await page.getByRole("button", { name: /red alert/i }).click();
    await expect(page.getByRole("button", { name: /stand down/i })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out("bridge-red-alert-from-button") });
    await page.getByRole("button", { name: /stand down/i }).click();

    await page.getByRole("button", { name: /engineering/i }).click();
    await expect(page.getByRole("heading", { name: /main engineering/i })).toBeVisible();
    await page.getByRole("button", { name: /core eject/i }).click();
    await expect(page.locator(".screen")).toHaveAttribute("data-state", "damaged");
    await settle(page);
    await page.screenshot({ path: out("engineering-core-eject") });

    await page.getByRole("button", { name: /damage control/i }).click();
    await expect(page.getByRole("button", { name: /back/i })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out("schematic-with-back") });
  });

  test("operator live values", async ({ browser, page, request }) => {
    const displays = await openDisplays(browser, ["test", "engineering-1", "tactical-1", "viewscreen-1"]);
    await request.put("/api/signals/shields/value", { data: { value: 65 } });
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/operator");
    await expect(page.getByRole("slider", { name: "Shield strength" })).toHaveValue("65");
    await shootTall(page, "operator-phone-live");

    await page.setViewportSize({ width: 1280, height: 900 });
    await settle(page);
    await page.screenshot({ path: out("operator-tablet-live") });
    await Promise.all(displays.map((display) => display.close()));
  });

  test("editor live values and actions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/builder/tactical");
    await page.getByRole("tree", { name: "Outline" }).getByRole("treeitem", { name: /Gauge · Strength/ }).click();
    await expect(page.getByRole("region", { name: "Live value" })).toBeVisible();
    await page.getByRole("region", { name: "Live value" }).scrollIntoViewIfNeeded();
    await settle(page);
    await page.screenshot({ path: out("editor-live-value") });

    await page.getByRole("tree", { name: "Outline" }).getByRole("treeitem", { name: /Button · Raise shields/ }).click();
    await page.getByRole("region", { name: "When used" }).scrollIntoViewIfNeeded();
    await settle(page);
    await page.screenshot({ path: out("editor-actions") });

    await page.goto("/builder");
    await page.getByRole("button", { name: "Signals" }).click();
    await page.getByRole("dialog").getByRole("option", { name: /Warp core output/ }).click();
    await settle(page);
    await page.screenshot({ path: out("signals-dialog") });
  });

  test("gallery", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/gallery");
    await expect(page.locator(".frame").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const height = await page.locator(".gallery").evaluate((element) => element.scrollHeight);
    await page.setViewportSize({ width: 1280, height });
    await page.screenshot({ path: out("gallery") });
  });
});

test.describe("showcase phase 4", () => {
  test.skip(phase !== "phase-4", "set SHOWCASE=phase-4 to capture screenshots");
  const DISPLAY = "showcase-generated";

  test.afterEach(async ({ request }) => {
    await setState(request, "normal");
    await request.put(`/api/displays/${DISPLAY}`, { data: { screen: null } });
    const response = await request.get("/api/screens");
    const { screens } = (await response.json()) as { screens: { id: string; tags: string[] }[] };
    for (const screen of screens.filter((each) => each.tags.includes("generated"))) await request.delete(`/api/screens/${screen.id}`);
  });

  const openDialog = async (page: Page, section: string, seed: number) => {
    await page.goto("/builder");
    await page.getByRole("button", { name: "Generate" }).click();
    const dialog = page.getByRole("dialog", { name: "Generate a screen" });
    await dialog.getByLabel("Section").selectOption({ label: section });
    await dialog.getByRole("textbox", { name: "Seed" }).fill(String(seed));
    await expect(dialog.locator(".thumbnail")).toHaveCount(3);
    return dialog;
  };

  // Generates take 1 of a section through the dialog and publishes it.
  const create = async (page: Page, section: string, seed: number, options: { aspect?: string; density?: string } = {}) => {
    const dialog = await openDialog(page, section, seed);
    if (options.aspect) await dialog.getByLabel("Aspect").selectOption(options.aspect);
    if (options.density) await dialog.getByLabel("Density").selectOption({ label: options.density });
    await dialog.getByRole("button", { name: "Create and edit" }).click();
    await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled();
    const id = page.url().split("/").pop() ?? "";
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();
    return id;
  };

  const onDisplay = async (page: Page, request: APIRequestContext, id: string, name: string, size = { width: 1280, height: 720 }) => {
    await request.put(`/api/displays/${DISPLAY}`, { data: { screen: id } });
    await page.setViewportSize(size);
    await page.goto(`/d/${DISPLAY}`);
    await expect(page.locator(".screen")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out(name) });
  };

  test("generate dialog", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const dialog = await openDialog(page, "Engineering", 2024);
    await settle(page);
    await page.screenshot({ path: out("generate-dialog") });
    await dialog.getByLabel("Preview state").selectOption("red-alert");
    await dialog.getByRole("checkbox", { name: /screen for each system/ }).check();
    await settle(page);
    await page.screenshot({ path: out("generate-dialog-red-alert-suite") });
  });

  test("generated sections on a display", async ({ page, request }) => {
    for (const [section, seed] of [
      ["Engineering", 2024],
      ["Tactical", 7],
      ["Science", 31],
      ["Medical", 4242],
      ["Helm", 12],
      ["Operations", 5],
    ] as const) {
      await page.setViewportSize({ width: 1440, height: 900 });
      const id = await create(page, section, seed);
      await onDisplay(page, request, id, `display-${id}`);
    }
    await setState(request, "red-alert");
    await onDisplay(page, request, "engineering-2", "display-engineering-red-alert");
    await onDisplay(page, request, "medical", "display-medical-red-alert");
  });

  test("densities, portrait and another theme", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const sparse = await create(page, "Security", 3, { density: "Sparse" });
    await onDisplay(page, request, sparse, "display-security-sparse");
    const dense = await create(page, "Communications", 3, { density: "Dense" });
    await onDisplay(page, request, dense, "display-communications-dense");
    await page.setViewportSize({ width: 1440, height: 900 });
    const portrait = await create(page, "Environmental", 8, { aspect: "9:16" });
    await onDisplay(page, request, portrait, "display-environmental-9x16", { width: 540, height: 960 });
    await request.put(`/api/displays/${DISPLAY}`, { data: { screen: dense } });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/d/${DISPLAY}?theme=base`);
    await settle(page);
    await page.screenshot({ path: out("display-communications-base-theme") });
  });

  test("editor: regenerate, reroll and placeholders", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const dialog = await openDialog(page, "Science", 31);
    await dialog.getByRole("button", { name: "Create and edit" }).click();
    await expect(page.getByRole("button", { name: "Regenerate", exact: true })).toBeVisible();
    const outline = page.getByRole("tree", { name: "Outline" });
    await outline.getByRole("treeitem", { name: /^Title · / }).first().click();
    await page.getByRole("tabpanel", { name: "Selection" }).getByRole("checkbox", { name: /Locked/ }).check();
    await page.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect(page.getByText(/Regenerated everything that is not locked/)).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out("editor-regenerated") });

    // A panel heading, then Esc to select the panel that holds it.
    await page.locator(".preview-stage h2").first().click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Reroll" })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out("editor-reroll") });

    await page.getByRole("button", { name: /Placeholder/ }).click();
    await settle(page);
    await page.screenshot({ path: out("editor-placeholder") });
  });
});
