import { randomBytes } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const exists = async (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

export const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));

const pending = new Map<string, Promise<void>>();

// Temp file + rename, so a crash or power cut never leaves half a document. Writes to the same file
// are queued, so the last write requested is the last one on disk.
export const writeJsonAtomic = (file: string, value: unknown): Promise<void> => {
  const previous = pending.get(file) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const temp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
      await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
      await rename(temp, file);
    });
  pending.set(file, next);
  void next.finally(() => {
    if (pending.get(file) === next) pending.delete(file);
  });
  return next;
};
