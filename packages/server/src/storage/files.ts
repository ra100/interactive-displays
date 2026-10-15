import { randomBytes } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const exists = async (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

export const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));

const pending = new Map<string, Promise<void>>();

// Temp file + rename, so a crash or power cut never leaves half a file. Writes to the same file
// are queued, so the last write requested is the last one on disk.
export const writeFileAtomic = (file: string, data: string | Buffer): Promise<void> => {
  const previous = pending.get(file) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const temp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
      try {
        await writeFile(temp, data);
        await rename(temp, file);
      } catch (error) {
        // A failed write must not leave its temp file behind, one more on every retry.
        await rm(temp, { force: true }).catch(() => undefined);
        throw error;
      }
    });
  pending.set(file, next);
  // Cleans up whether the write worked or not; a failure reaches the caller through `next` only (a bare
  // finally() would re-throw it as an unhandled rejection, which stops Node).
  const settle = () => {
    if (pending.get(file) === next) pending.delete(file);
  };
  next.then(settle, settle);
  return next;
};

export const writeJsonAtomic = (file: string, value: unknown): Promise<void> =>
  writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
