import { readFile, writeFile, readdir, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Layout } from "./types.js";
import { validateLayoutId, validateLayout } from "./validation.js";

const DATA_DIR = join(process.cwd(), "data", "layouts");

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

/**
 * Get safe file path for a layout ID.
 * Validates ID to prevent path traversal attacks.
 */
function layoutPath(id: string): string {
  // Validate ID format - throws ZodError if invalid
  const safeId = validateLayoutId(id);
  return join(DATA_DIR, `${safeId}.json`);
}

export async function getLayout(id: string): Promise<Layout | null> {
  try {
    const safePath = layoutPath(id);
    const content = await readFile(safePath, "utf-8");
    return JSON.parse(content) as Layout;
  } catch (error) {
    // File not found is expected
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Invalid ID format - treat as not found
    if ((error as Error).name === "ZodError") {
      console.warn(`Invalid layout ID requested: ${id}`);
      return null;
    }
    // Log and re-throw unexpected errors
    console.error(`Failed to read layout ${id}:`, error);
    throw error;
  }
}

export async function listLayouts(): Promise<Layout[]> {
  await ensureDataDir();
  try {
    const files = await readdir(DATA_DIR);
    const layouts: Layout[] = [];

    for (const file of files) {
      if (file.endsWith(".json") && !file.endsWith(".tmp")) {
        try {
          const content = await readFile(join(DATA_DIR, file), "utf-8");
          layouts.push(JSON.parse(content) as Layout);
        } catch (error) {
          console.warn(`Failed to read layout file ${file}:`, error);
          // Skip corrupted files
        }
      }
    }

    return layouts;
  } catch (error) {
    console.error("Failed to list layouts:", error);
    return [];
  }
}

export async function saveLayout(layout: unknown): Promise<Layout> {
  // Validate layout structure
  const validatedLayout = validateLayout(layout);

  await ensureDataDir();

  // Ensure layout has a valid ID
  // Cast to Layout - Zod has validated the structure
  const layoutToSave = {
    ...validatedLayout,
    id: validatedLayout.id || randomUUID(),
  } as Layout;

  // Validate the final ID (in case it was generated)
  validateLayoutId(layoutToSave.id);

  // Atomic write: write to temp file, then rename
  const finalPath = layoutPath(layoutToSave.id);
  const tempPath = `${finalPath}.tmp`;

  await writeFile(tempPath, JSON.stringify(layoutToSave, null, 2), "utf-8");
  await rename(tempPath, finalPath);

  return layoutToSave;
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
