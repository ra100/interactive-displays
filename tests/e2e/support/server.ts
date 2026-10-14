import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// A server the test controls, for flows that stop and start it (the shared webServer must stay up).
export interface ManagedServer {
  url: string;
  dataDir: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const waitForHealth = async (url: string, timeoutMs = 15_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server at ${url} did not become healthy`);
};

export const createManagedServer = (port: number): ManagedServer => {
  const url = `http://127.0.0.1:${port}`;
  const dataDir = mkdtempSync(path.join(tmpdir(), "displays-e2e-managed-"));
  let child: ChildProcess | undefined;

  return {
    url,
    dataDir,
    start: async () => {
      child = spawn(process.execPath, ["packages/server/src/index.ts"], {
        env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATA_DIR: dataDir, LOG_LEVEL: "warn" },
        stdio: "inherit",
      });
      await waitForHealth(url);
    },
    stop: async () => {
      const running = child;
      if (!running || running.exitCode !== null) return;
      const exited = new Promise((resolve) => running.once("exit", resolve));
      running.kill("SIGTERM");
      await exited;
      child = undefined;
    },
  };
};
