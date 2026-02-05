import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
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
    // Invalid ID format - let ZodError propagate
    if ((error as Error).name === "ZodError") {
      throw error;
    }
    // JSON parse error
    if (error instanceof SyntaxError) {
      throw new Error(`Corrupted layout file for ${id}: ${error.message}`);
    }
    // Re-throw unexpected errors
    throw error;
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
