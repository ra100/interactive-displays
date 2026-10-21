import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

// The director page (director.html) with the app's own fonts, whose built file names carry a hash.
export const directorPage = (): string => {
  const assets = readdirSync(path.join("packages", "app", "dist", "assets"));
  const font = (prefix: string) => assets.find((name) => name.startsWith(prefix) && name.endsWith(".woff2")) ?? "";
  return readFileSync(path.join("tests", "e2e", "support", "director.html"), "utf8")
    .replace("__ANTONIO700__", font("antonio-latin-700-normal"))
    .replace("__ANTONIO400__", font("antonio-latin-400-normal"))
    .replace("__RAJDHANI600__", font("rajdhani-latin-600-normal"))
    .replace("__RAJDHANI400__", font("rajdhani-latin-400-normal"));
};

// A box in the app's own pixels, or in the picture's.
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The smallest box around all of them.
export const union = (boxes: Box[]): Box => {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

// Calls one of the director page's commands and waits for what it returns.
export const directorOf =
  (page: Page) =>
  (name: string, ...args: unknown[]): Promise<unknown> =>
    page.evaluate(
      ([fn, values]) => (window as unknown as { director: Record<string, (...rest: unknown[]) => unknown> }).director[fn]?.(...values),
      [name, args] as const,
    );
