import { readFile, writeFile, readdir, mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Layout } from "./types.js";

const DATA_DIR = join(process.cwd(), "data", "layouts");

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

function layoutPath(id: string): string {
  return join(DATA_DIR, `${id}.json`);
}

export async function getLayout(id: string): Promise<Layout | null> {
  try {
    const content = await readFile(layoutPath(id), "utf-8");
    return JSON.parse(content) as Layout;
  } catch {
    return null;
  }
}

export async function listLayouts(): Promise<Layout[]> {
  await ensureDataDir();
  try {
    const files = await readdir(DATA_DIR);
    const layouts: Layout[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await readFile(join(DATA_DIR, file), "utf-8");
        layouts.push(JSON.parse(content) as Layout);
      }
    }

    return layouts;
  } catch {
    return [];
  }
}

export async function saveLayout(layout: Layout): Promise<Layout> {
  await ensureDataDir();

  // Ensure layout has an ID
  const layoutToSave: Layout = {
    ...layout,
    id: layout.id || randomUUID(),
  };

  // Atomic write: write to temp file, then rename
  const finalPath = layoutPath(layoutToSave.id);
  const tempPath = `${finalPath}.tmp`;

  await writeFile(tempPath, JSON.stringify(layoutToSave, null, 2), "utf-8");
  await rename(tempPath, finalPath);

  return layoutToSave;
}

export async function deleteLayout(id: string): Promise<boolean> {
  try {
    await unlink(layoutPath(id));
    return true;
  } catch {
    return false;
  }
}

// Create a default layout if none exist
export async function ensureDefaultLayout(): Promise<void> {
  const layouts = await listLayouts();
  if (layouts.length === 0) {
    await saveLayout({
      id: "default",
      name: "Default Layout",
      elements: [
        {
          id: "welcome-text",
          type: "text",
          col: 4,
          row: 5,
          colSpan: 4,
          rowSpan: 1,
          color: "#ff9900",
          label: "INTERACTIVE DISPLAY SYSTEM",
        },
      ],
    });
  }
}
