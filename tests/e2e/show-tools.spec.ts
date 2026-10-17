import { expect, test } from "@playwright/test";
import { assignDisplay, setState } from "./support/api.ts";

// Phase 6 show tooling from the operator console: re-skinning, sizing for large panels and the running order.
const DISPLAY = "tools-e2e";

test.describe("show tools", () => {
  test.afterEach(async ({ request }) => {
    expect((await request.put("/api/show/theme", { data: { id: "lcars" } })).ok()).toBe(true);
    expect((await request.put("/api/show/scale", { data: { scale: 0.7 } })).ok()).toBe(true);
    expect((await request.put("/api/show/sound-pack", { data: { pack: null } })).ok()).toBe(true);
    expect((await request.post("/api/cues/reset")).ok()).toBe(true);
    await assignDisplay(request, "corridor-1", "standby");
    await assignDisplay(request, DISPLAY, null);
    await setState(request, "normal");
  });

  test("re-skins every display, with LCARS ornaments drawn by the new theme's stand-ins", async ({ page, browser }) => {
    const display = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await display.goto(`/d/${DISPLAY}`);
    await expect(display.locator('.screen[data-theme="lcars"]')).toBeVisible();

    await page.goto("/operator");
    const look = page.getByRole("region", { name: "Look" });
    await look.getByRole("combobox", { name: "Theme" }).selectOption({ label: "Holo HUD" });
    await expect(display.locator('.screen[data-theme="hud"]')).toBeVisible();
    await expect(display.getByRole("heading", { name: /bridge operations/i })).toBeVisible();
    await expect(display.locator('.decor-slot[data-kind="lcars.bar"] .hud-scale')).toHaveCount(1);

    await look.getByRole("combobox", { name: "Theme" }).selectOption({ label: "Terminal" });
    await look.getByRole("combobox", { name: "Variant" }).selectOption({ label: "Amber phosphor" });
    await expect(display.locator('.screen[data-theme="crt"][data-variant="amber"]')).toBeVisible();
    await expect(display.locator('.decor-slot[data-kind="lcars.bar"] .crt-rule[data-style="double"]')).toHaveCount(1);
    await display.close();
  });

  test("sizes the show for a 4K panel and one display apart from the rest", async ({ page, browser }) => {
    const display = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await display.goto(`/d/${DISPLAY}`);
    const screen = display.locator(".screen");
    await expect(screen).toHaveCSS("--ui-scale", "0.7");
    const unit = () => screen.evaluate((element) => getComputedStyle(element).getPropertyValue("--u"));
    expect(await unit()).toBe("7.56px");

    await page.goto("/operator");
    await page.getByRole("region", { name: "Look" }).getByLabel("Size").selectOption({ label: "50%" });
    await expect(screen).toHaveCSS("--ui-scale", "0.5");
    expect(await unit()).toBe("5.4px");

    const card = page.getByRole("listitem", { name: DISPLAY });
    await card.getByLabel("Size").selectOption({ label: "100%" });
    await expect(screen).toHaveCSS("--ui-scale", "1");
    await card.getByLabel("Size").selectOption({ label: "Show size (50%)" });
    await expect(screen).toHaveCSS("--ui-scale", "0.5");
    await display.close();
  });

  test("runs the running order with GO and the space bar", async ({ page, browser }) => {
    const corridor = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await corridor.goto("/d/corridor-1");
    const effect = corridor.locator(".screen");

    await page.goto("/operator");
    const cues = page.getByRole("region", { name: "Cues" });
    await expect(cues.getByText("Top of scene").first()).toBeVisible();
    await cues.getByRole("button", { name: "GO" }).click();
    await expect(cues.getByRole("listitem", { name: "Top of scene" })).toHaveAttribute("data-current", "true");
    await cues.getByRole("button", { name: "GO" }).click();
    await expect(effect).toHaveAttribute("data-effect", "warning");

    // The space bar is GO, unless someone is typing.
    await page.locator("body").press("Space");
    await expect(effect).toHaveAttribute("data-effect", "alert");
    await expect(page.getByRole("slider", { name: "Shield strength" })).toHaveValue("40");

    await cues.getByRole("listitem", { name: "Hull breach" }).getByRole("button", { name: "Run" }).click();
    await expect(effect).toHaveAttribute("data-effect", "damaged");
    await expect(corridor.getByText(/master systems display/i).first()).toBeVisible();

    await cues.getByRole("button", { name: "Back to top" }).click();
    await expect(cues.locator("#go-next")).toContainText("Top of scene");
    await corridor.close();
  });

  test("offers the content pack written for the show's theme first and generates a native screen", async ({ page, request }) => {
    expect((await request.put("/api/show/theme", { data: { id: "hud" } })).ok()).toBe(true);
    await page.goto("/builder");
    await page.getByRole("button", { name: "Generate" }).click();
    const dialog = page.getByRole("dialog", { name: "Generate a screen" });
    const section = dialog.getByLabel("Section");
    expect(await section.locator("optgroup").first().getAttribute("label")).toBe("Patrol corvette");
    await section.selectOption({ label: "Cockpit" });
    await expect(dialog.locator('.thumbnail .screen[data-theme="hud"]')).toHaveCount(3);
    await dialog.getByRole("button", { name: "Create and edit" }).click();
    await expect(page).toHaveURL(/\/builder\/cockpit$/);
    expect((await request.delete("/api/screens/cockpit")).ok()).toBe(true);
  });

  test("records what is on air as a new cue", async ({ page, request }) => {
    await page.goto("/operator");
    await page.getByRole("button", { name: /Red alert/ }).click();
    const cues = page.getByRole("region", { name: "Cues" });
    await cues.getByRole("textbox", { name: "New cue name" }).fill("Ambush");
    await cues.getByRole("button", { name: "Record what is on air" }).click();
    await expect(cues.getByRole("listitem", { name: "Ambush" })).toContainText("Red alert");

    await cues.getByRole("button", { name: "Delete Ambush" }).click();
    await expect(cues.getByRole("listitem", { name: "Ambush" })).toHaveCount(0);
    const show = (await (await request.get("/api/show")).json()) as { show: { cues: { id: string }[] } };
    expect(show.show.cues.map((cue) => cue.id)).toEqual(["top", "contact", "first-hit", "breach", "all-clear"]);
  });

  test("a display installs as a fullscreen app and hides a resting cursor", async ({ page, request }) => {
    const manifest = (await (await request.get("/manifest.webmanifest")).json()) as { display: string; start_url?: string };
    expect(manifest.display).toBe("fullscreen");
    expect(manifest.start_url).toBeUndefined();
    await page.goto(`/d/${DISPLAY}`);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator("body")).toHaveAttribute("data-kiosk", "true");
    await expect(page.locator("body")).toHaveAttribute("data-idle", "true", { timeout: 6000 });
    await page.mouse.move(10, 10);
    await expect(page.locator("body")).not.toHaveAttribute("data-idle", "true");
  });
});
