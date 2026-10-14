import path from "node:path";
import { z } from "zod";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(3010),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATA_DIR: z.string().min(1).default(path.join(repoRoot, "data")),
  APP_DIST: z.string().min(1).default(path.join(repoRoot, "packages/app/dist")),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  appDist: string;
  logLevel: z.infer<typeof EnvSchema>["LOG_LEVEL"];
}

// All configuration comes from environment variables, so Docker and local runs work the same way.
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid configuration\n${problems.join("\n")}`);
  }
  const { PORT, HOST, DATA_DIR, APP_DIST, LOG_LEVEL } = parsed.data;
  return {
    port: PORT,
    host: HOST,
    dataDir: path.resolve(DATA_DIR),
    appDist: path.resolve(APP_DIST),
    logLevel: LOG_LEVEL,
  };
};
